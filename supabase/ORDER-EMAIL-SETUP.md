# New-order email alerts

Prepared for `samalbakes@gmail.com`. Email sending defaults to OFF. No SMS or social-messaging integration is activated.

## Activation

1. Create a free Resend account at https://resend.com/signup. Account owner completes signup and accepts the provider terms.
2. Add and verify the sending subdomain `notify.samalbakes.com` in Resend using the DNS records Resend supplies. Do not replace the website DNS records or the domain's existing mail records. The proposed sender is `SamalBakes <orders@notify.samalbakes.com>`.
3. Create a sending-only API key restricted to this domain if available. Store it directly in Supabase Vault under the exact name `order_email_resend_api_key`. Never put the key in chat, frontend JavaScript, Git, or the public site settings. Supabase Vault: https://supabase.com/dashboard/project/khfxmgwyqldvzutsnnhb/integrations/vault/secrets
4. After approval of the data flow, run `supabase/order-email-notifications.sql`. It enables pg_net and pg_cron, creates admin-only settings and notification history, and schedules a private worker every minute. New-install instructions should apply schema.sql first, then this migration.
5. Publish the Admin HTML/JS. In Admin > Settings > New-order email alerts, confirm recipient/sender and enable alerts.
6. Place an explicitly identified test order and confirm receipt in the destination inbox. The notification history reports provider acceptance, not final inbox delivery. No live delivery test has been completed yet.

## Information sent

The recipient email address and verified sender, order reference, order time, ordered product names and quantities, line prices, subtotal, discount, delivery fee, total, payment method, customer name/email/phone, delivery address and coordinates/map link, delivery instructions, estimated ready time, and admin-page link. Resend processes this data to send the alert to the bakery's Gmail inbox. The admin link requires normal sign-in; no login token is included.

## Behavior and limits

- Order insertion queues an alert in the same database transaction only while alerts are enabled. Failed/rolled-back orders produce no alerts. Existing orders are not backfilled.
- The worker builds email text from committed order data; it does not accept customer-submitted recipient addresses or arbitrary email bodies.
- Recipients and senders are snapshotted at order placement. Changing settings affects future orders.
- Sending is asynchronous and does not make checkout wait for Resend. Normal provider submission is within about two minutes; retries take longer.
- Provider responses reconcile on the next worker tick. Failures retry after at least five minutes, up to three attempts. Retries reuse identical payloads and the same Resend idempotency key. Automatic retries stop after 23 hours to remain inside Resend's 24-hour duplicate-protection window.
- Turning alerts OFF cancels pending notifications on the next worker tick. An already submitted message cannot be recalled.
- No manual resend button is provided yet. Review failed/uncertain sends in Resend before manually sending a replacement.
- Admin settings say whether a key exists; this does not prove the key is valid, the domain is verified, or the inbox will accept the message.
- The private worker and trigger are SECURITY DEFINER for database-trigger/cron operation. Client roles cannot execute them or access the private schema. The readiness function explicitly checks admin access and returns only a boolean.
- The existing customer share buttons are preserved until automatic delivery has been verified end to end.

## Tests

Run `node tests/order-email-database.test.js`. Tests use a local PostgreSQL-compatible engine and a mocked network service; they never send email. Covers repeatable migration, disabled default, RLS, worker restrictions, credential gating, order items/map content, in-flight duplicate prevention, retry payload/key stability, and provider acceptance.
