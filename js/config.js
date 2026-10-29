/**
 * SamalBakes.com — site configuration
 * =====================================
 * EDIT THIS FILE to change hours, contact info, delivery zone, and ready-time rules.
 *
 * READY-TIME ASSUMPTIONS (documented for the family):
 * ----------------------------------------------------
 * 1. Each product has a bake/prep time (minutes). Prep can overlap; bake uses oven capacity.
 * 2. Oven has a limited batch size (slots). Items fill slots; when full, another batch starts.
 * 3. Different products can share a batch if they fit (slots), but each batch's duration is
 *    the MAX bake time of items in that batch (simplified model — not true multi-temp baking).
 * 4. Batches run SEQUENTIALLY (one oven). Parallel products in the same batch bake together.
 * 5. Working hours are in Asia/Manila. Orders placed after closing start at next open day.
 * 6. Orders placed during a break (if any) wait until work resumes.
 * 7. Minimum lead time (per product or global) is added as a floor before ready time.
 * 8. Delivery estimate = ready time + delivery buffer minutes (configurable).
 * 9. These are PLACEHOLDERS until the family confirms oven size, real bake times, and hours.
 */

window.SAMALBAKES = window.SAMALBAKES || {};

window.SAMALBAKES.config = {
  businessName: "SamalBakes",
  tagline: "Freshly baked to order on Samal Island",
  timezone: "Asia/Manila",

  // --- CONTACT (PLACEHOLDERS — replace with real channels) ---
  contact: {
    // TODO: replace with real phone / Messenger / email
    phone: "+63 9XX XXX XXXX",           // PLACEHOLDER
    phoneSms: "639XXXXXXXXX",            // digits only for sms: link — PLACEHOLDER
    whatsapp: "639XXXXXXXXX",            // PLACEHOLDER (country code, no +)
    viber: "639XXXXXXXXX",               // PLACEHOLDER
    messenger: "https://m.me/YOUR_PAGE", // PLACEHOLDER Facebook Messenger link
    email: "orders@samalbakes.example",  // PLACEHOLDER
    facebookPage: "https://facebook.com/YOUR_PAGE", // PLACEHOLDER
  },

  // --- WORKING HOURS (Asia/Manila) — PLACEHOLDER ---
  // Format: day 0=Sun … 6=Sat. open/close as "HH:MM" 24h. null = closed.
  workingHours: {
    0: null,                    // Sunday — closed (placeholder)
    1: { open: "08:00", close: "18:00" }, // Monday
    2: { open: "08:00", close: "18:00" },
    3: { open: "08:00", close: "18:00" },
    4: { open: "08:00", close: "18:00" },
    5: { open: "08:00", close: "18:00" },
    6: { open: "08:00", close: "16:00" }, // Saturday — shorter day
  },

  // --- OVEN / PRODUCTION RULES (PLACEHOLDERS) ---
  production: {
    // How many "slots" fit in one oven batch. Each product uses `slots` (default 1).
    ovenBatchSlots: 12,          // PLACEHOLDER — change when you know oven capacity
    // If true, items with different bake times can share a batch; batch duration = max bake time.
    // If false, each product type bakes in its own sequential batch.
    allowMixedBatches: true,
    // Extra minutes after baking for cooling/packing before "ready".
    packingBufferMinutes: 15,    // PLACEHOLDER
    // Minutes from ready → earliest delivery window start.
    deliveryBufferMinutes: 30,   // PLACEHOLDER
    // Global minimum lead time (minutes) even for tiny orders. Per-product can raise this.
    globalMinLeadMinutes: 60,    // PLACEHOLDER — at least 1 hour
  },

  /**
   * DELIVERY ZONE — PLACEHOLDER RADIUS
   * ----------------------------------
   * Center: approximate point on Samal Island near Babak / Davao ferry crossing area.
   * Radius: 25 km — NOT FINAL. Change `radiusKm` below when the family decides the range.
   * Also includes named areas for the dropdown fallback.
   *
   * To change the delivery range: edit radiusKm (and optionally center lat/lng).
   * To use polygons later: add GeoJSON rings to `polygons` (array of [lng,lat] rings).
   */
  delivery: {
    // PLACEHOLDER: ~Babak area, Island Garden City of Samal (near Davao crossing)
    center: { lat: 7.1280, lng: 125.6930 },
    radiusKm: 25, // <<< CHANGE THIS when delivery range is decided
    currency: "PHP",
    freeDeliveryMinOrder: 1500, // PLACEHOLDER — also editable in Admin
    feeType: "flat",            // flat | per_km | flat_plus_per_km — Admin can change
    feeFlat: 80,                // PLACEHOLDER PHP
    feePerKm: 15,               // PLACEHOLDER PHP
    feeNote: "Delivery fee is calculated from Admin settings (COD).",
    // Named areas for dropdown fallback (no GPS needed)
    areas: [
      { id: "babak", name: "Babak (Samal Island)", inZone: true },
      { id: "peñaplata", name: "Peñaplata (Samal Island)", inZone: true },
      { id: "kaputian", name: "Kaputian (Samal Island)", inZone: true },
      { id: "samal-resorts", name: "Samal Island resorts / beach areas", inZone: true },
      { id: "davao-proper", name: "Davao City (proper / downtown)", inZone: true },
      { id: "toril", name: "Toril, Davao City", inZone: true },
      { id: "bunawan", name: "Bunawan, Davao City", inZone: true },
      { id: "calinan", name: "Calinan, Davao City", inZone: false }, // farther — placeholder
      { id: "tagum", name: "Tagum City", inZone: false },
      { id: "digos", name: "Digos City", inZone: false },
      { id: "other", name: "Other / not listed", inZone: false },
    ],
    // Optional: polygon rings later. Empty = use center + radius only.
    polygons: [],
  },
};
