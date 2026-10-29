-- My account stores a delivery address on the customer's profile.
-- The live project was created before this column existed.
-- Safe to re-run.
--
-- Run this once in the Supabase SQL editor:
--   supabase/profile-delivery-address.sql

alter table public.profiles
  add column if not exists delivery_address text;
