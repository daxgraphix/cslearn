update settings
set value = jsonb_set(value, '{name}', '"CSGO"'::jsonb),
    updated_at = now()
where key = 'platform';