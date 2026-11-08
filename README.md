# SamalBakes.com

Static storefront for a home bakery on **Samal Island** (cakes & breads, bake-to-order, delivery to Samal & Davao).

**Domain:** `samalbakes.com` (Namecheap)  
**Stack:** HTML/CSS/JS + optional **Supabase** (Auth, Postgres, RLS). No build step.  
**Payment:** Cash on Delivery (COD). Hook `#payment-step` for later PayMongo / Xendit.

## Quick start

**Do not double-click `index.html` for full features.** Serve locally:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

`js/supabase-config.js` points at the live Supabase project, so accounts, orders, and the menu use Postgres. There is no demo banner in that mode.

To run **demo mode** instead, put the `YOUR_…` placeholders back in `js/supabase-config.js`. Then:
- Green banner: “Demo mode — data stays in this browser”
- Accounts, orders, and admin settings stay in `localStorage`
- **Demo admin:** `admin@demo.local` / `demo-admin-2026` (shown on the login page only in demo mode)


## Product photos

Real cake photos live in `img/products/` (optimized JPEG + WebP). Originals are kept in `img/products/originals/` (not in the deploy zip). Working cake names are placeholders until the family confirms. Breads are still sample items without photos.

Admin → Products can set an image path (`img/products/….jpg`) or, in **demo mode**, pick a local file (stored as a data URL in localStorage).

## What to edit

| What | Where |
|------|--------|
| Sample products (cakes/breads) | `js/products.js` or Admin → Products |
| Hours / oven / contact defaults | `js/config.js` |
| Live delivery fees, radius, center | Admin → Settings (overrides config when data layer loads) |
| Promos | `js/promos.js` |
| Supabase URL + anon key | `js/supabase-config.js` |

## Features

1. Hero + about (cakes & breads)
2. Delivery checker (geo / area / Nominatim) + Esri map; radius from Admin/settings
3. Menu + cart + ready-time calculator
4. Place order (guest or logged-in) — COD; share via Messenger/WhatsApp/etc.
5. Register / login, account menu, profile (name, phone, delivery address, password), and **order history**
6. **Admin** (admins only): fees (flat / per-km / both), free-delivery threshold, radius & center, products (price, bake times, hide/show), order status
7. Promotions

## Go live with Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run `supabase/schema.sql`, then `supabase/seed.sql`. If the project already exists, run `supabase/profile-delivery-address.sql` once so My account can store a delivery address.
3. Authentication → enable **Email** (password). Magic link optional.
4. Project Settings → API → copy **Project URL** and **anon public** key into `js/supabase-config.js`.
5. Sign up once on the site (or create a user in Auth), then in SQL:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

6. Deploy the `samalbakes/` folder to Netlify / Cloudflare Pages / GitHub Pages.
7. Point **Namecheap** DNS at the host (ALIAS/CNAME or host nameservers). Enable HTTPS on the host.

Orders go through the `place_order` Postgres function so **prices and fees are computed server-side** (customers can’t tamper). Guests can place orders; logged-in customers see history. Admins update products/settings/orders under RLS.

## Demo vs live

| | Demo | Live |
|--|------|------|
| Trigger | `YOUR_SUPABASE_URL` / `YOUR_SUPABASE_ANON_KEY` | Real URL + anon key |
| Storage | `localStorage` | Supabase Auth + Postgres |
| Admin login | `admin@demo.local` / `demo-admin-2026` | Your profile with `is_admin=true` |

## Forms / payments later

- Form backends (Formspree, Basin, Netlify Forms) optional beside chat links.
- Card / GCash / Maya: add UI in `#payment-step` with PayMongo or Xendit + a small serverless function for secrets.

## Tests

After approval, apply `supabase/baking-hours-home-products.sql` before deploying
the new Admin Settings controls. It preserves existing baking hours and adds an
optional ordered list of three home-page product IDs. Fresh installs include
these fields and checks in `schema.sql`.

Under **Admin → Settings → Baking hours**, set one start/finish period per day
in Philippine time, or uncheck a day to mark it closed. At least one baking day
is required; overnight periods are not supported. The weekly schedule is shown
only in the admin interface. The existing estimator uses it alongside bake times,
preparation, packing, oven batches, and minimum lead times. Remaining work moves
to the next open period. These remain estimates rather than reservations against
the incoming-order queue.

Under **Home page: Our top sellers**, choose three different active products
with photos in display order. The photo previews help identify each product.
If a chosen product becomes unavailable or loses its photo, the home page fills
the gap with another active photographed product. Leave all choices blank to use
automatic selection. This also allows schedules to be saved before three product
photos are available. Changes affect subsequent page loads and new estimates;
they do not rewrite timestamps on orders already placed.

New checks: `node tests/bakery-settings.test.js` and
`node tests/bakery-settings-database.test.js` (the latter uses the local PGlite
installation described below).

Product photo uploads: after approval, apply `supabase/product-photo-storage.sql`
once to create the public `product-photos` bucket with admin-only uploads, a 5 MB
limit, and JPG/PNG/WebP file types. Then deploy the updated admin page and scripts.
Choose a photo, check its preview, and Save to upload it and store its address on
the product. Cancelling before Save does not upload. If uploading succeeds but
saving the product fails, retrying reuses the uploaded address. Unused uploaded
photos are retained; this change does not delete or overwrite existing photos.
The standalone bucket migration is also required for fresh projects.

For existing Supabase projects, apply `supabase/welcome-code-first-order-only.sql`
after reviewing the change. This makes SAMALWELCOME first-order-only by account,
email (ignoring case and surrounding spaces), or normalized phone number.
Philippine mobile formats `09…`, `9…`, `+639…`, and `00639…` match.
All previous orders, including cancelled orders, count. Guests must supply email
or phone to use the code. The storefront explains the rule; the database enforces
it at checkout, including concurrent submissions. No eligibility lookup is exposed.
Order creation is serialized while each order is saved, suitable for the current
small-store workload. Demo history is limited to the current browser.

```bash
node --check js/*.js
node tests/ready-time.test.js
node tests/account-menu.test.js
node tests/menu-card.test.js
node tests/welcome-promo.test.js
```

Database regression tests run the actual SQL in PGlite (PostgreSQL compiled to
WebAssembly), using synthetic users and orders without any Supabase connection:

```bash
pnpm add --dir .review-tools @electric-sql/pglite@0.5.13
node tests/welcome-database.test.js
```

Create `.review-tools` first if needed. It is ignored by Git. Tests provide a
minimal `auth.users` and `auth.uid()` fixture, load the previous schema, and apply
the migration twice. They cover eligibility, old orders, decimal pricing, rollback,
delivery fee modes, and anonymous/authenticated permissions. They do not simulate
Supabase's full authentication service or simultaneous independent connections;
the order-table lock has been reviewed but concurrency has not been load-tested.

## Project layout

```
samalbakes/
  index.html          storefront
  account.html        login / register / history
  admin.html          admin dashboard
  css/styles.css
  js/…                config, products, data layer, app, account, admin
  supabase/schema.sql
  supabase/seed.sql
  tests/
  README.md
```


### Manage promotions

Admin → Promotions lets bakery admins add, edit, deactivate, or remove offers. Save promotions publishes the full list, including the public card title, description, audience label, code, discount, minimum order and optional dates. Keep descriptions consistent with the numerical terms. Dates are entered in Philippine time; end time is exclusive. New entries start inactive. Percentage and peso discounts apply to merchandise, capped at the subtotal; free delivery codes waive the delivery fee after meeting the minimum. One code per order. Audience labels are descriptive. SAMALWELCOME retains first-order-only enforcement; RESORT50 requires an approved resort partner account.

### Approved resort partners

Run `supabase/resort-partners.sql` after the existing promotions and product-size migrations, before deploying the partner UI. It adds a private approval table, admin-gated management functions, and an order trigger that enforces RESORT50 approval without replacing checkout pricing. Rerunning preserves approvals and the configured minimum.

Under Admin → Promotions → Approved resort partners, enter a partner's registered, verified email and resort name. Partners must sign in with that account. They can use RESORT50 repeatedly whenever the current minimum is met. Change that minimum under Resort partner intro → Minimum order (PHP) → Save promotions. Deactivate/reactivate approvals from the partner list. Existing orders keep their recorded prices. Checkout contact email does not grant approval; customers cannot edit approval records. The initial list is empty; administrators must approve each partner.

Partner tests: `node tests/resort-partners.test.js` and `node tests/admin-partners.test.js` (PGlite and jsdom test dependencies).

**Release dependency:** Run supabase/admin-promotions.sql in the existing Supabase project before deploying these frontend files. It preserves existing delivery/baking/home settings and seeds the five existing offers only when adding the promotions column. The migration is transactional and safe to rerun without resetting saved promotions. Do not rerun the older welcome-code migration afterward, since it replaces the checkout function with the previous static rules.

Verification: node tests/admin-promotions.test.js and node tests/admin-promotions-form.test.js (temporary .review-tools dependencies @electric-sql/pglite and jsdom).


### Product sizes

Admin → Products → edit a product → Sizes and prices. Add a label and price for each size. Bake minutes are optional and otherwise inherit the product bake time. Products without sizes keep a single price. For products with sizes, the regular price field is disabled and the lowest size price is stored for listings. Keep size IDs stable when renaming labels. Removing a size makes that choice unavailable to new orders; historical orders retain their recorded name, size, unit price and bake time. When mixed batches are disabled, sizes are treated as separate production groups.

Release order: run supabase/product-sizes.sql, deploy frontend, then run supabase/consolidate-cake-sizes.sql. The latter combines the four existing cake families (6/8/9 inches), preserves each price/bake time, and hides eight duplicate listings without deleting them. Original product IDs are saved as legacy mappings so existing carts resolve to the correct sizes. Cake photos are shared by the parent product; original duplicate rows remain available for reference. All current homepage selections already refer to the retained parent IDs. Do not rerun older checkout migrations afterward, which would replace size validation.

Size tests: node tests/product-sizes.test.js, node tests/product-sizes-storefront.test.js, node tests/product-size-consolidation.test.js. They use the existing temporary PGlite and jsdom dependencies. No live orders are needed for these tests.
