/**
 * SamalBakes.com — PROMOTIONS (PLACEHOLDER FIGURES)
 * =================================================
 * Edit codes, discounts, and copy here. Promo codes are applied in the cart.
 *
 * type: "percent" | "fixed" | "free_delivery" | "info"
 *   percent       — percentOff of subtotal
 *   fixed         — peso off subtotal
 *   free_delivery — waives delivery note (fee still TBD offline)
 *   info          — display-only promo (no cart math)
 */

window.SAMALBAKES = window.SAMALBAKES || {};

window.SAMALBAKES.promos = [
  {
    id: "welcome10",
    code: "SAMALWELCOME",
    title: "First-order welcome",
    description: "10% off your first online order. Use code SAMALWELCOME at checkout.",
    type: "percent",
    percentOff: 10,          // PLACEHOLDER
    audience: "new customers",
    active: true,
  },
  {
    id: "free-del",
    code: "FREESHIP1500",
    title: "Free delivery over ₱1,500",
    description: "Orders of ₱1,500 or more qualify for free delivery within our area.",
    type: "free_delivery",
    minSubtotal: 1500,       // PLACEHOLDER — sync with config.delivery.freeDeliveryMinOrder
    audience: "everyone",
    active: true,
  },
  {
    id: "cafe-wholesale",
    code: null,
    title: "Coffee shop & resort wholesale",
    description: "Standing orders and wholesale pricing for cafés and resorts on Samal & Davao. Message us for a custom quote.",
    type: "info",
    audience: "B2B",
    active: true,
  },
  {
    id: "tasting-box",
    code: "TASTEBOX",
    title: "Free tasting box for businesses",
    description: "New café or resort partners: request a complimentary tasting box (subject to availability). Mention TASTEBOX when you message us.",
    type: "info",
    audience: "B2B",
    active: true,
  },
  {
    id: "resort50",
    code: "RESORT50",
    title: "Resort partner intro",
    description: "₱50 off orders ₱800+ for verified resort / hotel partners. Use code RESORT50.",
    type: "fixed",
    amountOff: 50,           // PLACEHOLDER
    minSubtotal: 800,        // PLACEHOLDER
    audience: "resorts",
    active: true,
  },
];
