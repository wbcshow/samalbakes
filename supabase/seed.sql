-- Sample breads + real-photo cakes + default settings
-- Safe to re-run: upserts products; resets settings row.

insert into public.settings (
  id,
  delivery_center_lat, delivery_center_lng, delivery_radius_km,
  delivery_fee_type, delivery_fee_flat, delivery_fee_per_km,
  free_delivery_min_order
) values (
  1, 7.1280, 125.6930, 25,
  'flat', 80, 15, 1500
)
on conflict (id) do update set
  delivery_center_lat = excluded.delivery_center_lat,
  delivery_center_lng = excluded.delivery_center_lng,
  delivery_radius_km = excluded.delivery_radius_km,
  delivery_fee_type = excluded.delivery_fee_type,
  delivery_fee_flat = excluded.delivery_fee_flat,
  delivery_fee_per_km = excluded.delivery_fee_per_km,
  free_delivery_min_order = excluded.free_delivery_min_order,
  updated_at = now();

-- Ensure columns exist on older projects
alter table public.products add column if not exists image_url text not null default '';
alter table public.products add column if not exists photo_real boolean not null default false;

insert into public.products (
  id, name, description, price, bake_time_minutes, prep_minutes,
  min_lead_minutes, slots, category, wholesale_note, image_url, photo_real,
  active, example, sort_order
) values
  ('chiffon-cake', 'Chiffon Cake',
   'Light golden chiffon ring cakes — soft, airy sponge, classic celebration style.',
   550, 50, 40, 240, 6, 'Cakes', 'Ask about sizes for resorts and gatherings.',
   'img/products/chiffon-cake.jpg', true, true, false, 1),
  ('chocolate-marshmallow-cake', 'Chocolate Marshmallow Cake',
   'Chocolate-frosted cake topped with chocolate-drizzled marshmallows and crushed peanuts.',
   750, 55, 50, 300, 8, 'Cakes', 'Great for birthdays and café specials.',
   'img/products/chocolate-marshmallow-cake.jpg', true, true, false, 2),
  ('chocolate-drip-cake', 'Chocolate Drip Cake',
   'Chocolate frosting with a dark chocolate drip, shavings, and white & chocolate rosettes.',
   850, 55, 60, 300, 8, 'Cakes', 'Custom message toppers on request.',
   'img/products/chocolate-drip-cake.jpg', true, true, false, 3),
  ('white-cherry-cake', 'White Cherry Cake',
   'White frosting with grated white chocolate (or coconut) and bright maraschino cherries.',
   700, 50, 50, 300, 8, 'Cakes', 'Standing orders welcome for coffee shops.',
   'img/products/white-cherry-cake.jpg', true, true, false, 4),
  ('black-forest-cake', 'Black Forest Cake',
   'White frosting, dark chocolate curls and flakes, topped with cream swirls and cherries.',
   900, 60, 70, 360, 8, 'Cakes', 'A popular pick for celebrations — ask for wholesale.',
   'img/products/black-forest-cake.jpg', true, true, false, 5),
  ('pandesal-dozen', 'Pandesal (dozen)',
   'Soft Filipino breakfast rolls — classic and lightly sweet.',
   80, 45, 90, 120, 2, 'Breads', 'Standing orders available for cafés.',
   '', false, true, true, 6),
  ('banana-bread-loaf', 'Banana Bread Loaf',
   'Moist loaf with ripe local bananas — great with coffee.',
   220, 55, 20, 90, 4, 'Breads', 'Slice packs for coffee shops by request.',
   '', false, true, true, 7),
  ('whole-wheat-loaf', 'Whole Wheat Loaf',
   'Hearty sandwich loaf — soft crumb, lightly toasted crust.',
   180, 50, 100, 180, 4, 'Breads', 'Wholesale trays for resorts — ask for a quote.',
   '', false, true, true, 8)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  bake_time_minutes = excluded.bake_time_minutes,
  prep_minutes = excluded.prep_minutes,
  min_lead_minutes = excluded.min_lead_minutes,
  slots = excluded.slots,
  category = excluded.category,
  wholesale_note = excluded.wholesale_note,
  image_url = excluded.image_url,
  photo_real = excluded.photo_real,
  active = excluded.active,
  example = excluded.example,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Hide retired sample cakes if they still exist from an older seed
update public.products set active = false
where id in ('ube-cake-6', 'chocolate-cake-8', 'mango-cream-cake', 'ube-cheesecake-slice', 'ensaymada-box', 'cinnamon-rolls-4', 'chocolate-chip-cookies');

-- After creating your Auth user in the dashboard, promote yourself:
--   update public.profiles set is_admin = true where email = 'you@example.com';
