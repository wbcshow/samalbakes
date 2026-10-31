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
```

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
