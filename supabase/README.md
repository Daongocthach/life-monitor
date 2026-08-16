# Supabase schema

`schema.sql` contains the complete MVP schema, indexes, bootstrap trigger, explicit Data API grants, and Row Level Security policies.

Every user-owned row is isolated with `auth.uid()`. Secret/service-role keys must never be exposed to the browser.
