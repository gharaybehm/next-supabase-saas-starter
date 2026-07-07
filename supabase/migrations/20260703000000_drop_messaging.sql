-- Drop the in-app messaging schema. Replaced by WhatsApp deep-linking
-- ("Message Broker" button on the listing detail page) — no code in the
-- application queries these tables.

DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.conversations;
