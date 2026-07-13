-- Sprint 4: Settings Seed Data
-- Run this after sprint4_schema_updates.sql

-- Seed allowed emails
INSERT INTO settings (key, value) 
VALUES ('allowed_emails', '["tfrsuperfx@gmail.com","tafiejr6@gmail.com","trevisdaradi@gmail.com"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Seed system settings
INSERT INTO settings (key, value) 
VALUES 
  ('system_name', 'Trevis'),
  ('currency_symbol', '$'),
  ('country_code', '263')
ON CONFLICT (key) DO NOTHING;
