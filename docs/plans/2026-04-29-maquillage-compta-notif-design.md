# Design — Maquillage Prix Sur Place + Notif Compta

**Date :** 2026-04-29
**Statut :** Approuvé

---

## Contexte

Le catalogue maquillage contient 3 services : invitée (300 DH fixe), mariée et fiancée (prix déterminé sur place). Mariée et fiancée n'avaient pas de prix affiché et étaient exclus de la réservation. Le patron veut les ajouter au catalogue, et recevoir une notification dans le dashboard pour les ajouter manuellement à la compta.

---

## Approche retenue : Flag `needs_compta` sur reservations

### 1. Catalogue — reservation.js

Ajout de `m-mariee` et `m-fiancee` dans la sous-catégorie "Maquillage" avec `prixSurPlace: true` et `price: null`.

- Les cartes s'affichent normalement dans le formulaire
- Le champ prix est **masqué** (aucun texte, pas de 0 DH)
- Dans le récapitulatif étape 4, ces services affichent `—`
- Le total exclut ces services (price null → ignoré dans le calcul)
- À l'insertion Supabase : si au moins un service a `prixSurPlace: true` → `needs_compta: true`

### 2. Base de données — Supabase

```sql
ALTER TABLE reservations
ADD COLUMN needs_compta BOOLEAN DEFAULT FALSE;
```

Aucune nouvelle table. La colonne suffit pour tracker l'état.

### 3. Dashboard admin — admin.js

**Bandeau `#compta-pending-banner`** (au-dessus du calendrier) :
- Apparaît si des RDVs ont `needs_compta = true`
- Chaque ligne : nom cliente · service · date · statut (Nouveau / Terminé)
- Statut "Terminé" → style urgent (rouge/orange)
- Bouton "Ajouter à la compta" → ouvre modal CA Manuel pré-rempli (description = "Maquillage mariée — Nom Cliente")
- Après sauvegarde → PATCH `needs_compta = false` → ligne disparaît

**Badge rouge** sur l'onglet/section dashboard avec le compte de notifs en attente.

**Déclencheurs :**
- À la création du RDV (depuis reservation.js) → `needs_compta = true`
- Quand RDV passe à "Terminé" dans admin.js → le bandeau affiche l'urgence (label change)

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `reservation.js` | Ajout m-mariee, m-fiancee avec `prixSurPlace: true`; masquer prix dans UI; `needs_compta: true` à l'insert |
| `admin.js` | `loadComptaPending()`, `renderComptaPendingBanner()`, bouton "Ajouter à la compta", badge count |
| `admin.css` | Styles pour le bandeau + badge |
| Supabase | `ALTER TABLE reservations ADD COLUMN needs_compta BOOLEAN DEFAULT FALSE` |

---

## Ce qui ne change pas

- Logique CA Manuel existante — réutilisée telle quelle
- RH & Stock — non impacté
- Invitée 300 DH — non impacté
