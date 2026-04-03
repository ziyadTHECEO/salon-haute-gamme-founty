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
