-- Allow the existing admin-only RLS policy to authorize status changes.
-- Column grants do not permit edits to totals, ownership or delivery details.
grant update (status, updated_at) on public.orders to authenticated;
