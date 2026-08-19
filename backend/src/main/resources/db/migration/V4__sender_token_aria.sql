-- The assistant's message-sender token is ARIA (the app is the TA Portal;
-- "OLIVIA" was the old internal code name). Applies to seed + engine rows.
update message set sender = 'ARIA' where sender = 'OLIVIA';
