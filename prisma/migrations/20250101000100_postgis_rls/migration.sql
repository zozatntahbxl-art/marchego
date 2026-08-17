-- ════════════════════════════════════════════════════════════════════════════
-- MarchéGo — PostGIS, index de proximité, fonctions métier et RLS
--
-- Cette migration complète le schéma Prisma :
--   1. triggers qui synchronisent les colonnes `geography(Point,4326)` depuis
--      les colonnes latitude/longitude gérées par Prisma ;
--   2. index GIST pour les requêtes de proximité (ST_DWithin) ;
--   3. fonctions SQL utilisées par l'algorithme d'assignation ;
--   4. Row Level Security pour l'accès direct via Supabase (client anon/auth).
--
-- Les blocs relatifs à Supabase sont conditionnés à l'existence du schéma
-- `auth`, afin que la migration reste applicable sur un PostgreSQL nu.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Synchronisation latitude/longitude → geography
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mg_sync_location()
RETURNS TRIGGER AS $$
DECLARE
  lat_col TEXT := TG_ARGV[0];
  lng_col TEXT := TG_ARGV[1];
  geo_col TEXT := TG_ARGV[2];
  lat DOUBLE PRECISION;
  lng DOUBLE PRECISION;
BEGIN
  EXECUTE format('SELECT ($1).%I, ($1).%I', lat_col, lng_col)
    INTO lat, lng USING NEW;

  IF lat IS NULL OR lng IS NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(geo_col, NULL));
    RETURN NEW;
  END IF;

  NEW := jsonb_populate_record(
    NEW,
    jsonb_build_object(
      geo_col,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mg_sync_location() IS
  'Trigger générique : recopie (latitude, longitude) dans une colonne geography(Point,4326).';

CREATE TRIGGER trg_addresses_location
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "addresses"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('latitude', 'longitude', 'location');

CREATE TRIGGER trg_markets_location
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "markets"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('latitude', 'longitude', 'location');

CREATE TRIGGER trg_couriers_current_location
  BEFORE INSERT OR UPDATE OF "currentLatitude", "currentLongitude" ON "couriers"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('currentLatitude', 'currentLongitude', 'currentLocation');

CREATE TRIGGER trg_couriers_preferred_location
  BEFORE INSERT OR UPDATE OF "preferredLatitude", "preferredLongitude" ON "couriers"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('preferredLatitude', 'preferredLongitude', 'preferredLocation');

CREATE TRIGGER trg_pings_location
  BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "courier_location_pings"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('latitude', 'longitude', 'location');

CREATE TRIGGER trg_orders_delivery_location
  BEFORE INSERT OR UPDATE OF "deliveryLatitude", "deliveryLongitude" ON "orders"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('deliveryLatitude', 'deliveryLongitude', 'deliveryLocation');

CREATE TRIGGER trg_deliveries_pickup_location
  BEFORE INSERT OR UPDATE OF "pickupLatitude", "pickupLongitude" ON "deliveries"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('pickupLatitude', 'pickupLongitude', 'pickupLocation');

CREATE TRIGGER trg_deliveries_dropoff_location
  BEFORE INSERT OR UPDATE OF "dropoffLatitude", "dropoffLongitude" ON "deliveries"
  FOR EACH ROW EXECUTE FUNCTION mg_sync_location('dropoffLatitude', 'dropoffLongitude', 'dropoffLocation');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index géospatiaux et index de recherche plein texte
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "addresses_location_gist" ON "addresses" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "markets_location_gist" ON "markets" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "couriers_current_location_gist" ON "couriers" USING GIST ("currentLocation");
CREATE INDEX IF NOT EXISTS "couriers_preferred_location_gist" ON "couriers" USING GIST ("preferredLocation");
CREATE INDEX IF NOT EXISTS "pings_location_gist" ON "courier_location_pings" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "orders_delivery_location_gist" ON "orders" USING GIST ("deliveryLocation");
CREATE INDEX IF NOT EXISTS "deliveries_pickup_location_gist" ON "deliveries" USING GIST ("pickupLocation");

-- Index partiel : les livreurs disponibles sont interrogés à chaque assignation.
CREATE INDEX IF NOT EXISTS "couriers_available_gist"
  ON "couriers" USING GIST ("currentLocation")
  WHERE "online" = TRUE AND "verified" = TRUE AND "status" = 'ACTIF';

-- Recherche floue sur les noms de produits, vendeurs et marchés.
CREATE INDEX IF NOT EXISTS "products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vendors_name_trgm" ON "vendors" USING GIN ("businessName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "markets_name_trgm" ON "markets" USING GIN ("name" gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fonctions métier
-- ─────────────────────────────────────────────────────────────────────────────

/*
 * Marchés situés à moins de `radius_km` d'un point, triés par distance.
 * `radius_km` NULL ⇒ on retient le rayon de livraison propre à chaque marché.
 */
CREATE OR REPLACE FUNCTION mg_markets_near(
  in_lat DOUBLE PRECISION,
  in_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT NULL,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (market_id UUID, distance_km DOUBLE PRECISION)
AS $$
  SELECT
    m."id",
    ST_Distance(m."location", ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography) / 1000.0
  FROM "markets" m
  WHERE m."isActive" = TRUE
    AND m."location" IS NOT NULL
    AND ST_DWithin(
      m."location",
      ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography,
      COALESCE(radius_km, m."zoneRadiusKm") * 1000.0
    )
  ORDER BY 2 ASC
  LIMIT max_results;
$$ LANGUAGE sql STABLE;

/*
 * Livreurs éligibles pour une mission au départ d'un marché.
 * Filtre : en ligne, vérifié, actif, position fraîche, dans le rayon de
 * recherche courant ET dans le rayon que le livreur a lui-même défini.
 * Exclut les livreurs déjà sollicités pour cette livraison ou occupés.
 */
CREATE OR REPLACE FUNCTION mg_couriers_available_for(
  in_lat DOUBLE PRECISION,
  in_lng DOUBLE PRECISION,
  search_radius_km DOUBLE PRECISION,
  in_delivery_id UUID,
  location_max_age_seconds INTEGER DEFAULT 300,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  courier_id UUID,
  distance_km DOUBLE PRECISION,
  rating DOUBLE PRECISION,
  vehicle_type TEXT,
  acceptance_rate DOUBLE PRECISION
)
AS $$
  SELECT
    c."id",
    ST_Distance(c."currentLocation", ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography) / 1000.0 AS distance_km,
    c."rating",
    c."vehicleType"::TEXT,
    CASE WHEN c."receivedOffers" = 0 THEN 0.5
         ELSE c."acceptedOffers"::DOUBLE PRECISION / c."receivedOffers"::DOUBLE PRECISION
    END AS acceptance_rate
  FROM "couriers" c
  WHERE c."online" = TRUE
    AND c."verified" = TRUE
    AND c."status" = 'ACTIF'
    AND c."currentLocation" IS NOT NULL
    AND c."lastLocationUpdate" > NOW() - (location_max_age_seconds || ' seconds')::INTERVAL
    AND ST_DWithin(
      c."currentLocation",
      ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography,
      LEAST(search_radius_km, c."radiusKm") * 1000.0
    )
    -- Pas déjà sollicité (offre en cours ou refusée) pour cette livraison
    AND NOT EXISTS (
      SELECT 1 FROM "delivery_offers" o
      WHERE o."deliveryId" = in_delivery_id
        AND o."courierId" = c."id"
        AND o."status" IN ('ENVOYEE', 'REFUSEE', 'ACCEPTEE')
    )
    -- Pas d'offre en attente sur une autre livraison
    AND NOT EXISTS (
      SELECT 1 FROM "delivery_offers" o2
      WHERE o2."courierId" = c."id"
        AND o2."status" = 'ENVOYEE'
        AND o2."expiresAt" > NOW()
    )
    -- Pas de livraison déjà en cours
    AND NOT EXISTS (
      SELECT 1 FROM "deliveries" d
      WHERE d."courierId" = c."id"
        AND d."status" IN ('ASSIGNEE', 'EN_ROUTE_VERS_MARCHE', 'ARRIVE_AU_MARCHE',
                           'EN_RECUPERATION', 'EN_ROUTE_VERS_CLIENT', 'ARRIVE_CHEZ_CLIENT')
    )
  ORDER BY distance_km ASC
  LIMIT max_results;
$$ LANGUAGE sql STABLE;

/* Distance à vol d'oiseau entre deux points, en kilomètres. */
CREATE OR REPLACE FUNCTION mg_distance_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
  SELECT ST_Distance(
    ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
  ) / 1000.0;
$$ LANGUAGE sql IMMUTABLE;

-- Contrainte d'intégrité : une note doit rester entre 1 et 5.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
-- Les quantités et montants ne peuvent pas être négatifs.
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_non_negative" CHECK ("totalCents" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative" CHECK ("priceCents" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("stock" >= 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security (Supabase uniquement)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  public_tables TEXT[] := ARRAY[
    'markets', 'market_schedules', 'market_closures', 'market_vendors',
    'categories', 'products', 'market_product_availabilities',
    'belgian_holidays', 'vendors'
  ];
  owner_tables TEXT[] := ARRAY[
    'profiles', 'addresses', 'carts', 'cart_items', 'notifications',
    'push_subscriptions', 'consent_records', 'data_export_requests',
    'phone_verifications'
  ];
BEGIN
  -- Sans schéma `auth`, on n'est pas sur Supabase : RLS activée sans policy
  -- (Prisma se connecte en propriétaire de table et n'est donc pas filtré).
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE NOTICE 'Schéma auth absent : politiques RLS Supabase non créées.';
    RETURN;
  END IF;

  -- 4.a Tables en lecture publique (catalogue)
  FOREACH tbl IN ARRAY public_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (TRUE)',
      tbl || '_public_read', tbl
    );
  END LOOP;

  -- 4.b Tables strictement personnelles : lecture/écriture par le propriétaire
  FOREACH tbl IN ARRAY owner_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated
         USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid())',
      tbl || '_owner_all', tbl
    );
  END LOOP;

  -- 4.c Commandes : visibles par le client, le livreur assigné et les vendeurs
  ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "orders_client_read" ON "orders"
    FOR SELECT TO authenticated USING ("clientId" = auth.uid());
  CREATE POLICY "orders_courier_read" ON "orders"
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM "deliveries" d
        JOIN "couriers" c ON c."id" = d."courierId"
        WHERE d."orderId" = "orders"."id" AND c."userId" = auth.uid()
      )
    );
  CREATE POLICY "orders_vendor_read" ON "orders"
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM "vendor_orders" vo
        JOIN "vendors" v ON v."id" = vo."vendorId"
        WHERE vo."orderId" = "orders"."id" AND v."userId" = auth.uid()
      )
    );

  -- 4.d Livraisons : le client suit sa livraison, le livreur voit la sienne
  ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "deliveries_participant_read" ON "deliveries"
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM "orders" o WHERE o."id" = "deliveries"."orderId" AND o."clientId" = auth.uid())
      OR EXISTS (SELECT 1 FROM "couriers" c WHERE c."id" = "deliveries"."courierId" AND c."userId" = auth.uid())
    );

  -- 4.e Suivi de position : lisible uniquement pendant une livraison active
  ALTER TABLE "courier_location_pings" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "pings_participant_read" ON "courier_location_pings"
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM "deliveries" d
        JOIN "orders" o ON o."id" = d."orderId"
        WHERE d."id" = "courier_location_pings"."deliveryId"
          AND o."clientId" = auth.uid()
          AND d."status" NOT IN ('LIVREE', 'ANNULEE', 'ECHOUEE')
      )
      OR EXISTS (SELECT 1 FROM "couriers" c WHERE c."id" = "courier_location_pings"."courierId" AND c."userId" = auth.uid())
    );

  -- 4.f Offres de mission : visibles par le livreur destinataire
  ALTER TABLE "delivery_offers" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "offers_courier_read" ON "delivery_offers"
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM "couriers" c WHERE c."id" = "delivery_offers"."courierId" AND c."userId" = auth.uid())
    );

  -- 4.g Messagerie : réservée aux participants de la conversation
  ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "chat_participant_read" ON "chat_messages"
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM "conversation_participants" p
        WHERE p."conversationId" = "chat_messages"."conversationId" AND p."userId" = auth.uid()
      )
    );
  CREATE POLICY "chat_participant_write" ON "chat_messages"
    FOR INSERT TO authenticated WITH CHECK (
      "senderId" = auth.uid()
      AND EXISTS (
        SELECT 1 FROM "conversation_participants" p
        WHERE p."conversationId" = "chat_messages"."conversationId" AND p."userId" = auth.uid()
      )
    );

  ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "conversations_participant_read" ON "conversations"
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM "conversation_participants" p
        WHERE p."conversationId" = "conversations"."id" AND p."userId" = auth.uid()
      )
    );

  -- 4.h Vendeur / livreur : accès à sa propre fiche
  ALTER TABLE "couriers" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "couriers_self_all" ON "couriers"
    FOR ALL TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid());
  CREATE POLICY "vendors_self_write" ON "vendors"
    FOR UPDATE TO authenticated USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid());

  -- 4.i Tables sensibles : aucun accès direct, tout passe par les API routes
  ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_documents" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "courier_documents" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_verifications" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "courier_verifications" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_self_read" ON "users"
    FOR SELECT TO authenticated USING ("id" = auth.uid());
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Publication Realtime (Supabase)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  realtime_tables TEXT[] := ARRAY[
    'orders', 'order_status_history', 'deliveries', 'delivery_offers',
    'courier_location_pings', 'chat_messages', 'notifications', 'vendor_orders'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime absente : étape ignorée.';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
    -- REPLICA IDENTITY FULL : nécessaire pour recevoir l'ancienne valeur des
    -- colonnes lors des UPDATE (filtres Realtime côté client).
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', tbl);
  END LOOP;
END $$;
