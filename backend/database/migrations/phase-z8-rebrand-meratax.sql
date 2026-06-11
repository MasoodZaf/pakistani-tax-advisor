-- Phase Z8: Rebrand PakTax / "Pakistani Tax Advisor" -> MeraTax
-- The application display name lives in system_settings (category 'application',
-- key 'app_name') and is shown in the admin System Settings screen. New installs
-- seed 'MeraTax' (createSystemSettingsTable.js); this brings existing databases
-- in line. Only rows still carrying the old default are touched, so an admin who
-- deliberately customised the name is left alone.

UPDATE system_settings
SET setting_value = 'MeraTax',
    updated_at    = NOW()
WHERE category = 'application'
  AND setting_key = 'app_name'
  AND setting_value = 'Pakistani Tax Advisor';
