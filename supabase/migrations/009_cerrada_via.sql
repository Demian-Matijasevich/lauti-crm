-- New commission scheme (2026-04-25): bono flag para closers que pasen $200k cash mensual
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS at_apto_bono boolean DEFAULT false;

-- Optional: cerrada_via per lead (chat | llamada). Por ahora se infiere por (setter_id == closer_id).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cerrada_via text CHECK (cerrada_via IS NULL OR cerrada_via IN ('chat', 'llamada'));

CREATE INDEX IF NOT EXISTS idx_leads_cerrada_via ON leads(cerrada_via);
