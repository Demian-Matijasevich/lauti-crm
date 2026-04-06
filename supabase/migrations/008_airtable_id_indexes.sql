-- Unique indexes for airtable_id (migration cross-reference)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_airtable_id ON leads(airtable_id) WHERE airtable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_airtable_id ON clients(airtable_id) WHERE airtable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_history_airtable_id ON renewal_history(airtable_id) WHERE airtable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_sessions_airtable_id ON tracker_sessions(airtable_id) WHERE airtable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_airtable_id ON daily_reports(airtable_id) WHERE airtable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_metrics_airtable_id ON ig_metrics(airtable_id) WHERE airtable_id IS NOT NULL;
