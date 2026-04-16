-- ================================================================
-- SCHEMA SUPABASE — Salon Haute Gamme Founty
-- Exécuter ce script dans l'éditeur SQL de Supabase Dashboard
-- ================================================================

-- Table des réservations
CREATE TABLE IF NOT EXISTS reservations (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT now(),
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    note        TEXT,
    services    JSONB NOT NULL,          -- [{id, name, price}]
    date        TEXT NOT NULL,            -- '2026-04-02'
    time        TEXT NOT NULL,            -- '14:00'
    total       INTEGER NOT NULL,
    advance     INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'advance_paid', 'completed', 'cancelled')),
    advance_paid BOOLEAN DEFAULT false
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_reservations_date ON reservations (date);
CREATE INDEX idx_reservations_status ON reservations (status);
CREATE INDEX idx_reservations_created_at ON reservations (created_at);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Les visiteurs (anon) peuvent uniquement INSÉRER + LIRE les créneaux pris
CREATE POLICY "anon_insert"
    ON reservations FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "anon_read_slots"
    ON reservations FOR SELECT
    TO anon
    USING (status IN ('confirmed', 'advance_paid'));

-- Les admins authentifiés ont accès complet
CREATE POLICY "auth_full_access"
    ON reservations FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ════════════════════════════════════════
-- TABLE CA MANUEL
-- CA local (coiffure, esthétique, produits) saisi manuellement par l'admin
-- Exécuter dans Supabase SQL Editor
-- ════════════════════════════════════════
CREATE TABLE ca_manuel (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL,
  categorie  TEXT NOT NULL
             CHECK (categorie IN (
               'Coiffure femme',
               'Esthétique',
               'Coiffure homme',
               'Produits de vente'
             )),
  montant    INTEGER NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ca_manuel_date ON ca_manuel(date);

ALTER TABLE ca_manuel ENABLE ROW LEVEL SECURITY;

-- Accès réservé aux utilisateurs authentifiés (admins connectés)
CREATE POLICY "auth_only_ca_manuel"
  ON ca_manuel
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
