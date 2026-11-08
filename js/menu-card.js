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
      peso((p.sizes || []).length ? p.sizes[0].price : p.price) +
      "</span></div>" +
      ((p.sizes || []).length ? '<label class="product-size-picker">Size<select class="size-select" aria-label="Size for ' + escapeHtml(p.name) + '">' + p.sizes.map(function(s){return '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.label) + ' — ' + peso(s.price) + '</option>';}).join('') + '</select></label>' : '') +
      (p.wholesaleNote
        ? '<p class="wholesale">' + escapeHtml(p.wholesaleNote) + "</p>"
        : "") +
      '<div class="qty-row">' +
      '<div class="bag-quantity" role="group" aria-label="Quantity for ' + escapeHtml(p.name) + '">' +
      '<button type="button" class="qty-minus" aria-label="Decrease">−</button>' +
      '<span class="qty" data-qty="' +
      escapeHtml(p.id) +
      '">0</span>' +
      '<button type="button" class="qty-plus" aria-label="Increase">+</button></div>' +
      '<button type="button" class="btn primary add-btn">Add</button></div></article>'
    );
  }

  return { customerProductCardHtml: customerProductCardHtml };
});
