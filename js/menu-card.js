/**
 * Customer-facing menu card markup.
 * Bake time and lead/ready timing stay off the card. Checkout estimates
 * and the admin product editor still use those fields.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SAMALBAKES = root.SAMALBAKES || {};
    root.SAMALBAKES.menuCard = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function customerProductCardHtml(p, helpers) {
    var escapeHtml = helpers.escapeHtml;
    var peso = helpers.peso;
    var img = p.image || p.image_url || "";
    var badge = "";
    var media = img
      ? '<div class="product-media"><img src="' +
        escapeHtml(img) +
        '" alt="' +
        escapeHtml(p.name) +
        '" loading="lazy" width="600" height="600"/></div>'
      : "";
    return (
      '<article class="card product-card" data-id="' +
      escapeHtml(p.id) +
      '">' +
      badge +
      media +
      '<div class="product-cat">' +
      escapeHtml(p.category || "") +
      "</div>" +
      "<h3>" +
      escapeHtml(p.name) +
      "</h3>" +
      '<p class="desc">' +
      escapeHtml(p.description || "") +
      "</p>" +
      '<div class="meta"><span class="price">' +
      peso(p.price) +
      "</span></div>" +
      (p.wholesaleNote
        ? '<p class="wholesale">' + escapeHtml(p.wholesaleNote) + "</p>"
        : "") +
      '<div class="qty-row">' +
      '<button type="button" class="btn ghost qty-minus" aria-label="Decrease">−</button>' +
      '<span class="qty" data-qty="' +
      escapeHtml(p.id) +
      '">0</span>' +
      '<button type="button" class="btn ghost qty-plus" aria-label="Increase">+</button>' +
      '<button type="button" class="btn primary add-btn">Add</button></div></article>'
    );
  }

  return { customerProductCardHtml: customerProductCardHtml };
});
