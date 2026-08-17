# Tester MarchéGo

Guide pour découvrir l’application **sans connaissances techniques**.  
Conception et développement : **MAAYOUD.B**.

MarchéGo livre les courses des marchés belges : vous choisissez un marché, composez un panier chez plusieurs étals, payez, puis suivez la livraison.

---

## Accès

Ouvrez l’adresse du site (en local : [http://localhost:3000](http://localhost:3000), ou l’URL Vercel une fois en ligne).

En **mode démonstration**, le mot de passe n’est pas vérifié. Connectez-vous avec l’un des e-mails ci-dessous.

Page de connexion : `/auth/connexion`.

---

## Comptes de démonstration

| Rôle | E-mail | Ce que vous pouvez faire |
|---|---|---|
| **Client** | `client@marchego.be` | Parcourir les marchés, remplir un panier, passer commande, suivre la livraison, saisir le PIN |
| **Vendeur** | `fromagerie.vandijck@marchego.be` | Voir les commandes de l’étal, accepter, préparer, marquer « prête » |
| **Livreur** | `livreur@marchego.be` | Recevoir une mission, collecter aux étals, livrer, demander le PIN |
| **Admin** | `admin@marchego.be` | Consulter le back-office (marchés, commandes, réglages) |

Autres étals (même principe, rôle vendeur) :

- `maraicher.dubois@marchego.be`
- `boulangerie.lecomte@marchego.be`
- `boucherie.martin@marchego.be`
- `fleurs.peeters@marchego.be`

Déconnectez-vous entre deux rôles (menu Compte) pour changer de profil.

---

## Parcours client (5 minutes)

1. Connectez-vous avec `client@marchego.be`.
2. Sur l’accueil, ouvrez un rendez-vous (Gare du Midi, Flagey, La Batte…).
3. Ajoutez des produits au panier (un seul marché à la fois).
4. Allez au panier, puis à la commande : adresse, créneau, paiement.
5. En démonstration, le paiement est confirmé tout de suite.
6. Suivez la commande : pastilles de statut, PIN de remise affiché à l’arrivée.

---

## Parcours vendeur

1. Connectez-vous avec `fromagerie.vandijck@marchego.be`.
2. Ouvrez **Vendeur**.
3. Traitez les commandes : À traiter → En cours → Prêtes.
4. Quand l’étal est prêt, le livreur peut collecter.

---

## Parcours livreur

1. Connectez-vous avec `livreur@marchego.be`.
2. Ouvrez **Livreur**.
3. Acceptez une offre de mission (délai court).
4. Suivez l’étape demandée : navigation, codes de collecte, PIN client à la porte.

---

## Parcours admin

1. Connectez-vous avec `admin@marchego.be`.
2. Ouvrez **Admin**.
3. Consultez les marchés, commandes et paramètres de la plateforme.

---

## Conseils

- Les marchés ont des jours d’ouverture réels (dimanche au Midi, mercredi au Châtelain, etc.).
- Filtrez par **région** (Bruxelles, Flandre, Wallonie) avant la commune.
- Sur mobile, la barre du bas mène à l’accueil, aux marchés, au panier, au suivi et au compte.

Besoin d’installer le projet en local ou de le déployer ? Consultez le [README.md](./README.md) technique.
