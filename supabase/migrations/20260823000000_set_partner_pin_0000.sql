update public.partner_redemption_pins
set pin_hash = extensions.crypt('0000', extensions.gen_salt('bf')),
    enabled = true,
    updated_at = now()
where partner_id = 'prototype';
