'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import { clientEnv } from '@/lib/env';
import { BELGIUM_CENTER } from '@/lib/geo';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  label?: string;
  popupHtml?: string;
};

export type MapRoute = {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
};

const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

export function GeoMap({
  markers = [],
  center,
  zoom = 11,
  route,
  onMarkerClick,
  highlightedId,
  className,
  interactive = true,
}: {
  markers?: MapMarker[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
  route?: MapRoute | null;
  onMarkerClick?: (id: string) => void;
  highlightedId?: string | null;
  className?: string;
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const startCenter = useRef(center ?? BELGIUM_CENTER);
  const startZoom = useRef(zoom);
  const markersDataRef = useRef(markers);
  markersDataRef.current = markers;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const origin = startCenter.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: clientEnv.NEXT_PUBLIC_MAP_STYLE_URL || FALLBACK_STYLE,
      center: [origin.longitude, origin.latitude],
      zoom: startZoom.current,
      attributionControl: { compact: true },
      interactive,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => {
      if (map.getStyle()?.name !== undefined) return;
      try {
        map.setStyle(FALLBACK_STYLE as never);
      } catch {
        /* style déjà dégradé */
      }
    });
    mapRef.current = map;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const marker of markers) {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', marker.label ?? 'Marqueur');
      el.style.cssText = [
        'width:28px',
        'height:28px',
        'border:2px solid white',
        `background:${marker.color ?? '#3d7c2c'}`,
        'border-radius:50% 50% 50% 0',
        'transform:rotate(-45deg)',
        'box-shadow:0 4px 10px rgba(16,24,40,.25)',
        'cursor:pointer',
      ].join(';');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        clickRef.current?.(marker.id);
      });

      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);

      if (marker.popupHtml) {
        m.setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(marker.popupHtml));
      }
      markersRef.current.push(m);
    }

    if (markers.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      markers.forEach((mk) => bounds.extend([mk.longitude, mk.latitude]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 400 });
    } else if (markers.length === 1) {
      map.easeTo({
        center: [markers[0].longitude, markers[0].latitude],
        zoom: Math.max(map.getZoom(), 13),
        duration: 400,
      });
    }
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRoute = () => {
      if (map.getLayer('mg-route')) map.removeLayer('mg-route');
      if (map.getSource('mg-route')) map.removeSource('mg-route');
      if (!route) return;
      map.addSource('mg-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [route.from.longitude, route.from.latitude],
              [route.to.longitude, route.to.latitude],
            ],
          },
        },
      });
      map.addLayer({
        id: 'mg-route',
        type: 'line',
        source: 'mg-route',
        paint: {
          'line-color': '#f97316',
          'line-width': 4,
          'line-dasharray': [1.4, 1.2],
        },
      });
    };

    if (map.isStyleLoaded()) applyRoute();
    else map.once('load', applyRoute);
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightedId) return;
    const mk = markersDataRef.current.find((m) => m.id === highlightedId);
    if (!mk) return;
    map.easeTo({
      center: [mk.longitude, mk.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 450,
    });
  }, [highlightedId]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-[320px] w-full overflow-hidden rounded-2xl border'}
      role="img"
      aria-label="Carte interactive"
    />
  );
}
