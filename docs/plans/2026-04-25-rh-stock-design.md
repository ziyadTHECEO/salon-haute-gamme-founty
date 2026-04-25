# Design — Module RH & Gestion des Produits Consommables
**Date :** 2026-04-25
**Projet :** Salon Haute Gamme Founty
**Statut :** Approuvé

---

## Contexte

Le patron veut gérer ses travailleurs et ses produits consommables directement depuis l'admin. Chaque travailleur reçoit une bouteille/unité d'un produit (ex: protéine = 6 clients). Le système suit la consommation par travailleur et alerte le patron quand le stock est bas ou épuisé.

---

## Architecture

### Approche choisie
**Onglet intégré "RH & Stock"** — 3ème onglet dans la navigation admin existante, cohérent avec l'UI actuelle (Analytique | Calendrier | RH & Stock).

### Stack
- Vanilla JS (cohérent avec le reste du projet)
- Supabase (nouvelles tables)
- CSS champagne/gold existant

---

## Base de données Supabase

### Table `workers`
```sql
id          uuid primary key default gen_random_uuid()
nom         text not null
prenom      text not null
departement text not null  -- 'coiffure' | 'onglerie' | 'esthetique' | 'autre'
created_at  timestamptz default now()
```

### Table `products`
```sql
id                uuid primary key default gen_random_uuid()
nom               text not null
prix              numeric(10,2) not null   -- en DH
capacite_clients  integer not null         -- nb approx de clients par unité
created_at        timestamptz default now()
```

### Table `assignments`
```sql
id              uuid primary key default gen_random_uuid()
worker_id       uuid references workers(id) on delete cascade
product_id      uuid references products(id) on delete cascade
clients_served  integer default 0         -- compteur de consommation
status          text default 'active'     -- 'active' | 'epuisee'
assigned_at     timestamptz default now()
closed_at       timestamptz               -- null si bouteille encore active
```

### Table `consumption_logs`
```sql
id             uuid primary key default gen_random_uuid()
assignment_id  uuid references assignments(id) on delete cascade
clients_count  integer not null           -- nb de clients ajoutés
source         text not null              -- 'auto' | 'manuel'
rdv_id         uuid                       -- nullable, si issu du calendrier
created_at     timestamptz default now()
```

---

## Logique métier

### Calcul du stock restant
```
restant = capacite_clients - clients_served
pourcentage_restant = (restant / capacite_clients) * 100
```

### États de stock

| État     | Condition              | Couleur | Affichage                        |
|----------|------------------------|---------|----------------------------------|
| Bon      | > 30% restant          | 🟢 Vert  | "X clientes restantes"           |
| Bas      | ≤ 30% restant          | 🔴 Rouge | "Attention — X clientes restantes" |
| Épuisé   | 0 restant (ou ≥ 100%) | 🚨 Critique | "ÉPUISÉE — Renouveler"        |

**Exemple :** Protéine, capacité = 6 clients
- 0–4 servis → vert (> 30% restant)
- 5 servis → rouge (1 cliente = 17% < 30%)
- 6 servis → critique (épuisée)

### Seuil d'alerte
**30% de la capacité** — fixe, applicable à tous les produits automatiquement.

### Consommation automatique via RDV
Quand un RDV est marqué "réalisé" dans le calendrier et qu'un travailleur est associé à ce RDV :
1. Chercher les assignments `active` de ce travailleur
2. Si le département du travailleur correspond à la catégorie du RDV → incrémenter `clients_served` de 1
3. Logger dans `consumption_logs` avec `source = 'auto'` et `rdv_id` renseigné

### Consommation manuelle
Le patron peut saisir manuellement un nombre de clients pour n'importe quel assignment actif depuis l'onglet RH & Stock. Log avec `source = 'manuel'`.

---

## Interface utilisateur

### Navigation
```
[Analytique]  [Calendrier]  [RH & Stock 🔴2]
                                     ↑
                          Badge rouge avec nb d'alertes actives
```

### Structure de l'onglet RH & Stock

**1. Bandeau alertes (en haut, si alertes actives)**
```
┌──────────────────────────────────────────────────────┐
│  🚨 Sonia — Kératine : ÉPUISÉE — Renouveler         │
│  ⚠  Marie — Protéine : Attention, 1 cliente restante │
└──────────────────────────────────────────────────────┘
```
Caché si aucune alerte (état vert pour tout le monde).

**2. Section Travailleurs**
- En-tête : "TRAVAILLEURS" + bouton `[+ Ajouter]`
- Tableau : Nom | Prénom | Département | Produits actifs (avec couleur d'état)
- Action sur chaque ligne : `Assigner un produit` (ouvre une modal)

**3. Section Produits consommables**
- En-tête : "PRODUITS CONSOMMABLES" + bouton `[+ Ajouter]`
- Tableau : Nom | Prix (DH) | Capacité | Assignments actifs
- Action : voir les assignments liés à ce produit

**4. Section Historique**
- Tableau des bouteilles épuisées : Travailleur | Produit | Date assignation | Date épuisement | Clients réalisés

### Modals

**Modal "Ajouter travailleur"**
- Champs : Nom*, Prénom*, Département* (select : Coiffure femme / Coiffure homme / Onglerie / Esthétique / Autre)
- Boutons : Annuler | Enregistrer

**Modal "Ajouter produit"**
- Champs : Nom*, Prix DH*, Capacité clients* (nombre entier)
- Boutons : Annuler | Enregistrer

**Modal "Assigner produit à un travailleur"**
- Select : Choisir le produit (dropdown des produits existants)
- Info affichée : Prix, Capacité
- Boutons : Annuler | Assigner

**Modal "+ Clients (saisie manuelle)"**
- Input numérique : Nombre de clients servis à ajouter
- Boutons : Annuler | Valider

---

## Placement des alertes

1. **Badge sur l'onglet** — nombre d'assignments en état bas ou épuisé, visible depuis n'importe quel onglet
2. **Bandeau rouge en haut de l'onglet RH & Stock** — liste des alertes avec détail
3. **Couleur sur les lignes du tableau Travailleurs** — vert/rouge/critique directement visible

---

## Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `admin.html` | Ajouter onglet "RH & Stock" dans la nav + HTML du contenu + modals |
| `admin.js` | Ajouter fonctions : loadWorkers, loadProducts, loadAssignments, addWorker, addProduct, assignProduct, addConsumption, computeAlerts, updateAlertBadge |
| `admin.css` | Styles pour bandeau alertes, badge onglet, états couleur (vert/rouge/critique) |
| Supabase | Créer 4 nouvelles tables via SQL editor |

---

## Non-inclus (YAGNI)

- Pas de notifications push navigateur (bandeau + badge suffisent pour une web app)
- Pas d'export CSV de l'historique (pas demandé)
- Pas de gestion des congés/absences des travailleurs
- Pas de système de commande automatique de produits
