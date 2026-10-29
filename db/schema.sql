-- ==========================================================================
-- MaisonVide — Schéma PostgreSQL (Neon)
-- Version 1.0 · 2026-10-21
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- ENUM
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_tier AS ENUM ('basic','verified','pro','premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('draft','pending','active','sold','removed','flagged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE listing_condition AS ENUM ('neuf','tres-bon','bon','correct','a-renover');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending','escrow','shipped','received','paid','disputed','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_sender AS ENUM ('user','bot','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------
-- UTILISATEURS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  password_hash   TEXT,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  tier            user_tier NOT NULL DEFAULT 'basic',
  kyc_status      TEXT NOT NULL DEFAULT 'pending',   -- pending|approved|rejected
  kyc_verified_at TIMESTAMPTZ,
  siret           TEXT,
  city            TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  trust_score     SMALLINT NOT NULL DEFAULT 50,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  sales_count     INTEGER NOT NULL DEFAULT 0,
  purchases_count INTEGER NOT NULL DEFAULT 0,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_city   ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_tier   ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_trust  ON users(trust_score DESC);

-- --------------------------------------------------------------------------
-- ANNONCES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL,
  condition         listing_condition NOT NULL DEFAULT 'bon',
  brand_tier        TEXT NOT NULL DEFAULT 'milieu',
  age_years         SMALLINT NOT NULL DEFAULT 0,
  price             NUMERIC(10,2) NOT NULL,
  original_price    NUMERIC(10,2),
  status            listing_status NOT NULL DEFAULT 'pending',
  ai_estimate_low   NUMERIC(10,2),
  ai_estimate_high  NUMERIC(10,2),
  ai_confidence     SMALLINT,
  city              TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  dimensions        TEXT,
  delivery_mode     TEXT,
  payment_methods   TEXT[],
  views             INTEGER NOT NULL DEFAULT 0,
  contacts          INTEGER NOT NULL DEFAULT 0,
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_seller   ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_city     ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_pub      ON listings(published_at DESC);

-- Full-text search FR (fallback simple si l'extension n'est pas dispo)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_listings_fts ON listings USING GIN(search_vector);

CREATE OR REPLACE FUNCTION listings_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.category,'')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_search ON listings;
CREATE TRIGGER trg_listings_search BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_search_update();

-- --------------------------------------------------------------------------
-- PHOTOS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  position      SMALLINT NOT NULL DEFAULT 0,
  width         INTEGER,
  height        INTEGER,
  moderation    TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  ai_labels     TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_listing ON listing_photos(listing_id, position);

-- --------------------------------------------------------------------------
-- FAVORIS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- --------------------------------------------------------------------------
-- MESSAGERIE
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     UUID REFERENCES listings(id) ON DELETE SET NULL,
  buyer_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  seller_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  channel        TEXT NOT NULL DEFAULT 'whatsapp',  -- whatsapp|email|web
  external_id    TEXT,                              -- id conversation Meta
  status         TEXT NOT NULL DEFAULT 'open',      -- open|handoff|closed
  handled_by     TEXT,                              -- 'bot' | 'human'
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conv_last   ON conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          message_sender NOT NULL,
  body            TEXT NOT NULL,
  attachments     TEXT[],
  intent          TEXT,          -- estimate|sell|buy|pro|human|other
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

-- --------------------------------------------------------------------------
-- TRANSACTIONS / SÉQUESTRE
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount            NUMERIC(10,2) NOT NULL,
  commission        NUMERIC(10,2) NOT NULL,
  commission_pct    NUMERIC(5,2) NOT NULL,
  status            transaction_status NOT NULL DEFAULT 'pending',
  escrow_provider   TEXT,          -- mangopay|stripe
  escrow_ref        TEXT,
  insurance_pct     NUMERIC(10,2),
  paid_at           TIMESTAMPTZ,
  received_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_buyer  ON transactions(buyer_id);

-- --------------------------------------------------------------------------
-- AVIS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT TRUE,
  moderation    TEXT NOT NULL DEFAULT 'approved',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_subject ON reviews(subject_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RENDEZ-VOUS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'requested', -- requested|confirmed|declined|cancelled|done
  meeting_place  TEXT,
  meeting_note   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appt_seller ON appointments(seller_id, starts_at);

-- --------------------------------------------------------------------------
-- SIGNALEMENTS (anti-arnaque)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type   TEXT NOT NULL,   -- listing|user|message
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,   -- scam|photos_volées|deepfake|usurpation|contrefaçon|Autre
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'open', -- open|reviewing|actioned|dismissed
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- --------------------------------------------------------------------------
-- IA : journal d'estimations (entraînement)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_estimates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID REFERENCES listings(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  photo_url        TEXT,
  detected_category TEXT,
  detected_condition listing_condition,
  detected_brand   TEXT,
  estimate_low     NUMERIC(10,2),
  estimate_high    NUMERIC(10,2),
  confidence       SMALLINT,
  final_price      NUMERIC(10,2),
  latency_ms       INTEGER,
  model_version    TEXT,
  payload          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_cat ON ai_estimates(detected_category, created_at DESC);

-- --------------------------------------------------------------------------
-- CHATBOT : flows
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  traffic_split SMALLINT NOT NULL DEFAULT 100,
  definition  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chatbot_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID REFERENCES chatbot_flows(id) ON DELETE SET NULL,
  node_id     TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  event       TEXT NOT NULL,     -- entered|replied|condition|transferred|error
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_botlogs_time ON chatbot_logs(created_at DESC);

-- --------------------------------------------------------------------------
-- AUDIT (traçabilité admin)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  payload     JSONB,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_log(created_at DESC);

-- --------------------------------------------------------------------------
-- SETTINGS (config plateforme)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('commission_solo_pct',  '8'),
  ('commission_guided_pct','5'),
  ('commission_pro_pct',  '12'),
  ('guided_flat_fee',      '29'),
  ('escrow_threshold',     '300'),
  ('photo_retention_days', '90'),
  ('kyc_required_to_sell', 'true')
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------------------
-- VUESUtILES
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_seller_stats AS
SELECT
  u.id AS seller_id,
  u.display_name,
  u.tier,
  u.trust_score,
  COUNT(l.id)                                            AS total_listings,
  COUNT(l.id) FILTER (WHERE l.status = 'active')         AS active_listings,
  COUNT(l.id) FILTER (WHERE l.status = 'sold')           AS sold_listings,
  COALESCE(SUM(l.views), 0)                              AS total_views,
  COALESCE(SUM(l.contacts), 0)                           AS total_contacts,
  COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'paid'), 0) AS revenue
FROM users u
LEFT JOIN listings l     ON l.seller_id = u.id
LEFT JOIN transactions t ON t.seller_id = u.id
GROUP BY u.id, u.display_name, u.tier, u.trust_score;

CREATE OR REPLACE VIEW v_moderation_queue AS
SELECT l.id, l.slug, l.title, l.category, l.price, l.created_at,
       u.display_name AS seller, u.tier, u.trust_score,
       (SELECT COUNT(*) FROM reports r WHERE r.target_id = l.id AND r.status <> 'dismissed') AS report_count
FROM listings l
JOIN users u ON u.id = l.seller_id
WHERE l.status IN ('pending','flagged')
ORDER BY report_count DESC, l.created_at ASC;

-- --------------------------------------------------------------------------
-- MISE À JOUR auto de updated_at
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_listings_touch ON listings;
CREATE TRIGGER trg_listings_touch BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_tx_touch ON transactions;
CREATE TRIGGER trg_tx_touch BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --------------------------------------------------------------------------
-- DISPONIBILITÉS VENDEUR (créneaux de rendez-vous)
-- weekday : 0 = dimanche … 6 = samedi. start_minute/end_minute : minutes
-- depuis minuit. Le vendeur définit ses créneaux, l'acheteur réserve dedans.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday       SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute  SMALLINT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute    SMALLINT NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  slot_minutes  SMALLINT NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 240),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slots_seller ON availability_slots(seller_id, weekday);

-- --------------------------------------------------------------------------
-- RENDEZ-VOUS : enrichissements (mode, durée, annulation, rappel)
-- --------------------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'visite';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes SMALLINT NOT NULL DEFAULT 30;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_appt_buyer  ON appointments(buyer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status, starts_at);

DROP TRIGGER IF EXISTS trg_appt_touch ON appointments;
CREATE TRIGGER trg_appt_touch BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- --------------------------------------------------------------------------
-- ESPACE PRO : état commercial du vendeur
-- --------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_activated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS response_time_min INTEGER;

-- --------------------------------------------------------------------------
-- VUES — vue espace pro (sous-requêtes corrélées : pas de fan-out)
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pro_dashboard AS
SELECT
  u.id            AS seller_id,
  u.display_name,
  u.tier,
  u.trust_score,
  u.rating,
  u.city,
  u.sales_count,
  u.pro_plan,
  u.response_time_min,
  (SELECT count(*) FROM listings l WHERE l.seller_id = u.id)::int AS listings_total,
  (SELECT count(*) FROM listings l WHERE l.seller_id = u.id AND l.status = 'active')::int AS listings_active,
  (SELECT COALESCE(sum(l.views), 0)    FROM listings l WHERE l.seller_id = u.id)::int AS views,
  (SELECT COALESCE(sum(l.contacts), 0) FROM listings l WHERE l.seller_id = u.id)::int AS contacts,
  (SELECT COALESCE(sum(t.amount), 0) FROM transactions t
     WHERE t.seller_id = u.id AND t.status IN ('escrow','shipped','received','paid'))::numeric AS pipeline,
  (SELECT COALESCE(sum(t.amount), 0) FROM transactions t
     WHERE t.seller_id = u.id AND t.status = 'paid')::numeric AS revenue,
  (SELECT COALESCE(sum(t.commission), 0) FROM transactions t
     WHERE t.seller_id = u.id AND t.status = 'paid')::numeric AS commission,
  (SELECT count(*) FROM conversations c WHERE c.seller_id = u.id)::int AS conversations,
  (SELECT count(*) FROM conversations c WHERE c.seller_id = u.id AND c.status = 'open')::int AS conversations_open,
  (SELECT count(*) FROM appointments a WHERE a.seller_id = u.id)::int AS appointments,
  (SELECT count(*) FROM appointments a WHERE a.seller_id = u.id AND a.status = 'requested')::int AS appointments_pending,
  (SELECT count(*) FROM availability_slots s WHERE s.seller_id = u.id AND s.is_active)::int AS slots
FROM users u;

-- Correction du fan-out de v_seller_stats (listings × transactions)
DROP VIEW IF EXISTS v_seller_stats;
CREATE OR REPLACE VIEW v_seller_stats AS
SELECT
  u.id AS seller_id,
  u.display_name,
  u.tier,
  u.trust_score,
  (SELECT count(*) FROM listings l WHERE l.seller_id = u.id)::int AS total_listings,
  (SELECT count(*) FROM listings l WHERE l.seller_id = u.id AND l.status = 'active')::int AS active_listings,
  (SELECT count(*) FROM listings l WHERE l.seller_id = u.id AND l.status = 'sold')::int AS sold_listings,
  (SELECT COALESCE(sum(l.views), 0)    FROM listings l WHERE l.seller_id = u.id)::int AS total_views,
  (SELECT COALESCE(sum(l.contacts), 0) FROM listings l WHERE l.seller_id = u.id)::int AS total_contacts,
  (SELECT COALESCE(sum(t.amount), 0) FROM transactions t
     WHERE t.seller_id = u.id AND t.status = 'paid')::numeric AS revenue
FROM users u;
