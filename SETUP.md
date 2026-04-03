# Setup — Salon Haute Gamme Founty

## 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) et créer un compte
2. Créer un nouveau projet (région : Europe)
3. Noter l'**URL** et les **clés API** (anon + service_role)

## 2. Configurer la base de données

1. Dans le Dashboard Supabase, aller dans **SQL Editor**
2. Copier le contenu de `supabase/schema.sql` et l'exécuter
3. Cela crée la table `reservations` avec les index et les policies RLS

## 3. Créer un utilisateur admin

1. Dans le Dashboard Supabase, aller dans **Authentication > Users**
2. Cliquer **Add user** > **Create new user**
3. Entrer un email et un mot de passe pour l'admin
4. Confirmer l'email (cocher "Auto Confirm" dans Authentication > Settings)

## 4. Configurer les clés

Ouvrir `supabase-config.js` et remplacer les 3 valeurs :

```js
var SUPABASE_URL  = 'https://VOTRE_PROJET.supabase.co';
var SUPABASE_ANON = 'VOTRE_ANON_KEY';
var SUPABASE_SERVICE_ROLE = 'VOTRE_SERVICE_ROLE_KEY';
```

- **SUPABASE_URL** : Settings > API > Project URL
- **SUPABASE_ANON** : Settings > API > anon/public key
- **SUPABASE_SERVICE_ROLE** : Settings > API > service_role key

> **Important** : Le fichier `supabase-config.js` est dans le `.gitignore` — ne le commitez jamais.

## 5. Lancer le site

```bash
cd "haut founty"
python3 -m http.server 8080
```

Puis ouvrir :
- Site vitrine : `http://localhost:8080/index.html`
- Réservation : `http://localhost:8080/reservation.html`
- Admin : `http://localhost:8080/admin.html`

## Structure des fichiers

```
haut founty/
├── index.html            # Site vitrine
├── reservation.html      # Page de réservation
├── reservation.css       # Styles réservation
├── reservation.js        # Logique réservation + Supabase
├── admin.html            # Dashboard admin
├── admin.css             # Styles admin
├── admin.js              # Logique admin (auth, analytics, calendrier)
├── supabase-config.js    # Clés Supabase (GITIGNORE)
├── supabase/
│   └── schema.sql        # Schéma de la base de données
├── .gitignore
└── SETUP.md              # Ce fichier
```

## Notes

- **RLS** : Les visiteurs (anon) peuvent créer des réservations et voir les créneaux pris. Les admins authentifiés ont un accès complet.
- **Service Role Key** : Utilisée dans le dashboard admin pour bypasser le RLS et accéder à toutes les données. Ne jamais exposer cette clé publiquement en production.
- **Avance** : Calculée automatiquement (0 si ≤500 DH, 100 DH si 501-1000 DH, 20% arrondi aux 50 DH si >1000 DH).
