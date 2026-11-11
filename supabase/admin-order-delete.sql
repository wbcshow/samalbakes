-- Admin-only permanent deletion. Order items and email outbox rows cascade
-- through their existing foreign keys. No customer notification or refund.
begin;
drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete on public.orders
  for delete to authenticated using (public.is_admin());
grant delete on public.orders to authenticated;
commit;
