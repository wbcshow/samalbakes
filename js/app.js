/**
 * SamalBakes.com — public storefront
 * Order flow: cart → review → place order (saved if logged in) + share links.
 * Payment: Cash on Delivery (COD). #payment-step reserved for PayMongo/Xendit later.
 */
(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  var config = SB.config;
  var products = SB.products;
  var promos = SB.promos || [];
  var CART_KEY = "sb_cart";
  var CART_META_KEY = "sb_cart_meta";
  var cart = {};
  var appliedPromo = null;
  var map = null;
  var mapCircle = null;
  var mapMarker = null;
  var lastOrderText = "";
  var lastDistanceKm = null;
  var session = null;
  var settings = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function peso(n) {
    return "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 });
  }
  function escapeHtml(s) {
    return SB.chrome ? SB.chrome.escapeHtml(s) : String(s);
  }
  function productById(id) {
    for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i];
    return null;
  }
  function cartLines() {
    return Object.keys(cart)
      .filter(function (id) { return cart[id] > 0; })
      .map(function (id) { return { product: productById(id), qty: cart[id] }; })
      .filter(function (l) { return l.product; });
  }
  function subtotal() {
    return cartLines().reduce(function (s, l) { return s + l.product.price * l.qty; }, 0);
  }
  function findPromoByCode(code) {
    if (!code) return null;
    var c = code.trim().toUpperCase();
    for (var i = 0; i < promos.length; i++) {
      var p = promos[i];
      if (p.active && p.code && p.code.toUpperCase() === c) return p;
    }
    return null;
  }

  function persistCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      localStorage.setItem(
        CART_META_KEY,
        JSON.stringify({
          promo: appliedPromo && appliedPromo.code ? appliedPromo.code : "",
          distanceKm: lastDistanceKm,
        })
      );
    } catch (e) {}
    if (SB.chrome && SB.chrome.refreshCartBadge) SB.chrome.refreshCartBadge();
  }

  function restoreCart() {
    cart = {};
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        Object.keys(raw).forEach(function (id) {
          var qty = parseInt(raw[id], 10);
          if (qty > 0) cart[id] = qty;
        });
      }
    } catch (e) {}
    appliedPromo = null;
    lastDistanceKm = null;
    try {
      var meta = JSON.parse(localStorage.getItem(CART_META_KEY) || "{}");
      if (meta && meta.promo) {
        var found = findPromoByCode(meta.promo);
        if (found && found.type !== "info") appliedPromo = found;
      }
      if (meta && meta.distanceKm != null && meta.distanceKm !== "") {
        var dist = Number(meta.distanceKm);
        if (!isNaN(dist)) lastDistanceKm = dist;
      }
    } catch (e2) {}
  }

  function onGridClick(e) {
    var card = e.target.closest(".product-card");
    if (!card) return;
    var id = card.getAttribute("data-id");
    if (e.target.classList.contains("qty-plus") || e.target.classList.contains("add-btn")) {
      cart[id] = (cart[id] || 0) + 1;
      refreshCartUI();
    } else if (e.target.classList.contains("qty-minus")) {
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
      if (!cart[id]) delete cart[id];
      refreshCartUI();
    }
  }

  function renderInto(grid, list) {
    if (!grid || !SB.menuCard) return;
    grid.innerHTML = list
      .map(function (p) {
        return SB.menuCard.customerProductCardHtml(p, { escapeHtml: escapeHtml, peso: peso });
      })
      .join("");
    if (grid.getAttribute("data-cart-bound") === "1") return;
    grid.setAttribute("data-cart-bound", "1");
    grid.addEventListener("click", onGridClick);
  }

  function renderMenu() {
    renderInto($("#menu-grid"), products);
    var featured = $("#featured-grid");
    if (!featured) return;
    var picks = products.filter(function (p) { return p.image || p.image_url; }).slice(0, 3);
    if (!picks.length) picks = products.slice(0, 3);
    renderInto(featured, picks);
  }

  function refreshCartUI() {
    $$("[data-qty]").forEach(function (el) {
      el.textContent = cart[el.getAttribute("data-qty")] || 0;
    });
    var lines = cartLines();
    var list = $("#cart-lines");
    var empty = $("#cart-empty");
    var summary = $("#cart-summary");
    var countBadge = $("#cart-count");
    if (countBadge) {
      var n = lines.reduce(function (s, l) { return s + l.qty; }, 0);
      countBadge.textContent = n;
      countBadge.hidden = n === 0;
    }
    persistCart();
    if (!list) return;
    if (!lines.length) {
      if (list) list.innerHTML = "";
      if (empty) empty.hidden = false;
      if (summary) summary.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (summary) summary.hidden = false;

    list.innerHTML = lines
      .map(function (l) {
        return (
          '<li class="cart-line"><div><strong>' + escapeHtml(l.product.name) +
          "</strong> × " + l.qty +
          '<div class="muted">' + peso(l.product.price) + " each</div></div>" +
          '<div class="line-total">' + peso(l.product.price * l.qty) + "</div>" +
          '<button type="button" class="btn ghost small remove" data-remove="' +
          l.product.id + '">Remove</button></li>'
        );
      })
      .join("");
    list.onclick = function (e) {
      var id = e.target.getAttribute("data-remove");
      if (id) {
        delete cart[id];
        refreshCartUI();
      }
    };

    var sub = subtotal();
    var disc = SB.data.calcDiscount(sub, appliedPromo && appliedPromo.code);
    var after = Math.max(0, sub - disc);
    var delFee = SB.data.calcDeliveryFee(
      settings || {
        free_delivery_min_order: config.delivery.freeDeliveryMinOrder,
        delivery_fee_type: config.delivery.feeType || "flat",
        delivery_fee_flat: config.delivery.feeFlat || 0,
        delivery_fee_per_km: config.delivery.feePerKm || 0,
      },
      after,
      lastDistanceKm
    );
    var total = after + delFee;

    var subEl = $("#cart-subtotal");
    if (!subEl) return;
    subEl.textContent = peso(sub);
    $("#cart-discount").textContent = disc ? "−" + peso(disc) : "—";
    var feeEl = $("#cart-delivery-fee");
    if (feeEl) feeEl.textContent = delFee ? peso(delFee) : "Free";
    $("#cart-total").textContent = peso(total);
    $("#cart-delivery-note").textContent =
      delFee === 0
        ? "Free delivery on this order."
        : lastDistanceKm != null
          ? "Delivery fee for about " + lastDistanceKm + " km."
          : "Delivery fee is included in the total.";
    $("#payment-method-label").textContent = "Cash on Delivery (COD)";

    var est = SB.readyTime.estimate({ lines: lines, config: config, now: new Date() });
    var tz = config.timezone;
    $("#ready-estimate").textContent =
      "Estimated ready: " + SB.readyTime.formatReady(est.readyAt, tz);
    $("#delivery-estimate").textContent =
      "Earliest delivery: " + SB.readyTime.formatReady(est.deliverFrom, tz);
    $("#ready-assumptions").textContent =
      "This is an estimate from our baking hours. We’ll confirm the time when we accept your order.";

    buildOrderSummaryText(lines, sub, disc, delFee, total, est);
    var placeBtn = $("#btn-place-order");
    if (placeBtn) placeBtn.disabled = false;
  }

  function buildOrderSummaryText(lines, sub, disc, delFee, total, est) {
    var tz = config.timezone;
    var linesTxt = lines
      .map(function (l) {
        return "• " + l.product.name + " × " + l.qty + " = " + peso(l.product.price * l.qty);
      })
      .join("\n");
    var promoLine = appliedPromo
      ? "Promo: " + (appliedPromo.code || appliedPromo.title) + " (−" + peso(disc) + ")\n"
      : "";
    lastOrderText =
      "Hi! I'd like to order from SamalBakes:\n\n" +
      linesTxt +
      "\n\nSubtotal: " + peso(sub) + "\n" + promoLine +
      "Delivery fee: " + (delFee ? peso(delFee) : "Free") + "\n" +
      "Total: " + peso(total) + "\nPayment: Cash on Delivery (COD)\n\n" +
      "Estimated ready: " + SB.readyTime.formatReady(est.readyAt, tz) + "\n" +
      "Earliest delivery: " + SB.readyTime.formatReady(est.deliverFrom, tz) +
      "\n\nMy name / address / notes:\n";
    var preview = $("#order-preview");
    if (preview) preview.textContent = lastOrderText;
    updateShareLinks(lastOrderText);
  }

  function updateShareLinks(text) {
    var c = config.contact;
    var enc = encodeURIComponent(text);
    var wa = $("#link-whatsapp");
    var sms = $("#link-sms");
    var mail = $("#link-email");
    var msg = $("#link-messenger");
    var viber = $("#link-viber");
    if (wa) wa.href = "https://wa.me/" + c.whatsapp + "?text=" + enc;
    if (sms) sms.href = "sms:" + c.phoneSms + "?body=" + enc;
    if (mail)
      mail.href =
        "mailto:" + c.email + "?subject=" + encodeURIComponent("SamalBakes order") + "&body=" + enc;
    if (msg) msg.href = c.messenger;
    if (viber) viber.href = "viber://chat?number=%2B" + c.viber;
  }

  function showPromoMsg(msg, text, cls) {
    msg.style.display = "block";
    msg.hidden = false;
    msg.textContent = text;
    msg.className = "msg " + cls;
  }

  function applyPromoCode() {
    var input = $("#promo-code");
    var msg = $("#promo-msg");
    var p = findPromoByCode(input.value);
    if (!p) {
      appliedPromo = null;
      showPromoMsg(msg, "Code not recognized.", "warn");
      refreshCartUI();
      return;
    }
    if (p.type === "info") {
      appliedPromo = null;
      showPromoMsg(msg, "Mention “" + p.code + "” when you message us (no cart discount).", "info");
      refreshCartUI();
      return;
    }
    appliedPromo = p;
    showPromoMsg(msg, "Applied: " + p.title, "ok");
    refreshCartUI();
  }

  function initMap() {
    var el = $("#delivery-map");
    if (!el || typeof L === "undefined") return;
    var d = config.delivery;
    map = L.map(el).setView([d.center.lat, d.center.lng], 10);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19,
      }
    ).addTo(map);
    mapCircle = L.circle([d.center.lat, d.center.lng], {
      radius: d.radiusKm * 1000,
      color: "#c45c26",
      fillColor: "#e8a87c",
      fillOpacity: 0.25,
      weight: 2,
    }).addTo(map);
    L.marker([d.center.lat, d.center.lng])
      .addTo(map)
      .bindPopup("Our bakery");
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function refreshMapZone() {
    if (!map || !mapCircle) return;
    var d = config.delivery;
    mapCircle.setLatLng([d.center.lat, d.center.lng]);
    mapCircle.setRadius(d.radiusKm * 1000);
    map.setView([d.center.lat, d.center.lng], map.getZoom());
  }

  function showDeliveryResult(result, label) {
    var box = $("#delivery-result");
    var d = config.delivery;
    if (result.distanceKm != null) lastDistanceKm = result.distanceKm;
    if (result.inZone) {
      box.className = "msg ok";
      box.innerHTML =
        "<strong>Yes — you're in our delivery area!</strong> " +
        (result.distanceKm != null
          ? "(~" + result.distanceKm + " km; zone " + d.radiusKm + " km.) "
          : "") +
        (label ? escapeHtml(label) + ". " : "");
    } else {
      box.className = "msg warn";
      box.innerHTML =
        "<strong>Outside our current zone.</strong> " +
        (result.distanceKm != null ? "(~" + result.distanceKm + " km; zone " + d.radiusKm + " km.) " : "") +
        "Message us — special delivery may be possible.";
    }
    if (map && result.lat != null) {
      if (mapMarker) map.removeLayer(mapMarker);
      mapMarker = L.marker([result.lat, result.lng]).addTo(map);
      map.setView([result.lat, result.lng], 11);
    }
    refreshCartUI();
  }

  function fillAreaDropdown() {
    var sel = $("#area-select");
    if (!sel) return;
    sel.innerHTML =
      '<option value="">Choose an area…</option>' +
      config.delivery.areas
        .map(function (a) {
          return '<option value="' + a.id + '">' + escapeHtml(a.name) + "</option>";
        })
        .join("");
  }

  function bindDelivery() {
    var geoBtn = $("#btn-geo");
    if (!geoBtn || !SB.delivery) return;
    geoBtn.addEventListener("click", function () {
      var box = $("#delivery-result");
      box.className = "msg info";
      box.textContent = "Checking your location…";
      SB.delivery
        .checkGeolocation(config.delivery)
        .then(function (r) { showDeliveryResult(r, "Based on your device location"); })
        .catch(function () {
          box.className = "msg warn";
          box.textContent =
            "Couldn't get location. Allow access, or pick an area / type an address.";
        });
    });
    $("#btn-area").addEventListener("click", function () {
      var id = $("#area-select").value;
      var box = $("#delivery-result");
      if (!id) {
        box.className = "msg warn";
        box.textContent = "Please choose an area.";
        return;
      }
      var area = config.delivery.areas.find(function (a) { return a.id === id; });
      showDeliveryResult({ inZone: area.inZone, distanceKm: null }, area.name);
    });
    $("#btn-geocode").addEventListener("click", function () {
      var q = $("#address-input").value.trim();
      var box = $("#delivery-result");
      if (!q) {
        box.className = "msg warn";
        box.textContent = "Type an address first.";
        return;
      }
      box.className = "msg info";
      box.textContent = "Looking up address…";
      SB.delivery
        .geocodeAddress(q + ", Davao, Philippines")
        .then(function (loc) {
          if (!loc) {
            box.className = "msg warn";
            box.textContent = "Address not found. Try the area dropdown.";
            return;
          }
          var r = SB.delivery.inDeliveryZone(loc.lat, loc.lng, config.delivery);
          r.lat = loc.lat;
          r.lng = loc.lng;
          showDeliveryResult(r, loc.displayName);
        })
        .catch(function (err) {
          box.className = "msg warn";
          var reason = (err && err.message) || "";
          var viaFile = location.protocol === "file:";
          if (viaFile || /file:\/\/|blocked|403|Failed to fetch|NetworkError|cors/i.test(reason)) {
            box.textContent =
              "Address lookup isn’t available right now. Please pick your area from the list.";
          } else {
            box.textContent = "Address lookup failed. Try the area dropdown.";
          }
        });
    });
  }

  function promoCardHtml(p) {
    return (
      '<article class="card promo-card"><h3>' + escapeHtml(p.title) + "</h3><p>" +
      escapeHtml(p.description) + "</p>" +
      (p.code ? '<p class="code">Code: <code>' + escapeHtml(p.code) + "</code></p>" : "") +
      '<span class="audience">' + escapeHtml(p.audience || "") + "</span></article>"
    );
  }

  function renderPromos() {
    var active = promos.filter(function (p) { return p.active; });
    var el = $("#promo-list");
    if (el) el.innerHTML = active.map(promoCardHtml).join("");
    var teaser = $("#promo-teaser");
    if (teaser) teaser.innerHTML = active.slice(0, 2).map(promoCardHtml).join("");
  }

  function renderDeliveryFees() {
    var el = $("#delivery-fees");
    if (!el) return;
    var d = config.delivery || {};
    var type = d.feeType || "flat";
    var flat = Number(d.feeFlat);
    var per = Number(d.feePerKm);
    var freeMin = Number(d.freeDeliveryMinOrder);
    if (isNaN(flat)) flat = 0;
    if (isNaN(per)) per = 0;
    if (isNaN(freeMin)) freeMin = 0;
    var feeText = peso(flat) + " flat fee";
    if (type === "per_km") feeText = peso(per) + " per km";
    else if (type === "flat_plus_per_km") feeText = peso(flat) + " plus " + peso(per) + " per km";
    el.textContent =
      "Delivery fee: " + feeText + ". Free delivery on orders of " + peso(freeMin) +
      " or more. Payment is cash on delivery.";
  }

  async function placeOrder() {
    var lines = cartLines();
    var msg = $("#place-order-msg");
    if (!lines.length) {
      if (msg) {
        msg.style.display = "block";
        msg.className = "msg warn";
        msg.textContent = "Add items first.";
      }
      return;
    }
    var guestName = ($("#guest-name") && $("#guest-name").value) || "";
    var guestPhone = ($("#guest-phone") && $("#guest-phone").value) || "";
    var guestEmail = ($("#guest-email") && $("#guest-email").value) || "";
    var address = ($("#guest-address") && $("#guest-address").value) || "";
    var notes = ($("#guest-notes") && $("#guest-notes").value) || "";
    if (!session && !guestName.trim()) {
      if (msg) {
        msg.style.display = "block";
        msg.className = "msg warn";
        msg.textContent = "Enter your name for guest checkout, or log in to save order history.";
      }
      return;
    }
    var est = SB.readyTime.estimate({ lines: lines, config: config, now: new Date() });
    try {
      var order = await SB.data.placeOrder({
        items: lines.map(function (l) {
          return { product_id: l.product.id, qty: l.qty };
        }),
        promo_code: appliedPromo && appliedPromo.code,
        guest_name: session ? session.user.full_name || session.user.email : guestName,
        guest_email: session ? session.user.email : guestEmail,
        guest_phone: guestPhone,
        delivery_address: address,
        notes: notes,
        distance_km: lastDistanceKm,
        estimated_ready_at: est.readyAt.toISOString(),
        estimated_delivery_at: est.deliverFrom.toISOString(),
      });
      if (msg) {
        msg.style.display = "block";
        msg.className = "msg ok";
        msg.innerHTML =
          "Order saved" +
          (session ? " to your account" : " (guest)") +
          ". Ref: <code>" +
          escapeHtml(String(order.id).slice(0, 8)) +
          "</code>. Payment: <strong>COD</strong>. " +
          (session
            ? '<a href="account.html#history">View order history</a>.'
            : "Log in next time to keep a history — or send the summary via chat below.");
      }
      cart = {};
      refreshCartUI();
    } catch (err) {
      if (msg) {
        msg.style.display = "block";
        msg.className = "msg warn";
        msg.textContent = err.message || "Could not place order.";
      }
    }
  }

  function prefillCheckoutFromSession() {
    if (!session || !session.user) return;
    var u = session.user;
    function fill(sel, value) {
      var el = $(sel);
      if (el && !String(el.value || "").trim() && value) el.value = value;
    }
    fill("#guest-name", u.full_name || "");
    fill("#guest-phone", u.phone || "");
    fill("#guest-email", u.email || "");
    fill("#guest-address", u.delivery_address || "");
  }

  function bindCheckout() {
    var promoBtn = $("#btn-apply-promo");
    if (promoBtn) promoBtn.addEventListener("click", applyPromoCode);
    var promoInput = $("#promo-code");
    if (promoInput) {
      promoInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          applyPromoCode();
        }
      });
    }
    var copyBtn = $("#btn-copy-order");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!lastOrderText) return;
        function flash(text) {
          var el = $("#copy-msg");
          el.style.display = "block";
          el.textContent = text;
          el.className = "msg ok";
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lastOrderText).then(function () {
            flash("Order text copied.");
          });
        } else {
          var ta = document.createElement("textarea");
          ta.value = lastOrderText;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          flash("Order text copied.");
        }
      });
    }
    var placeBtn = $("#btn-place-order");
    if (placeBtn) placeBtn.addEventListener("click", placeOrder);
  }

  function fillContactPlaceholders() {
    var c = config.contact;
    $$("[data-contact]").forEach(function (el) {
      var key = el.getAttribute("data-contact");
      if (c[key]) el.textContent = c[key];
    });
    $$("a[data-contact-href]").forEach(function (el) {
      var key = el.getAttribute("data-contact-href");
      if (c[key]) el.href = c[key];
    });
  }

  function updateRadiusCopy() {
    var el = $("#radius-copy");
    if (el) el.textContent = String(config.delivery.radiusKm);
  }

  (function redirectLegacyHash() {
    var hash = (location.hash || "").replace(/^#/, "");
    var map = {
      delivery: "delivery.html",
      menu: "menu.html",
      order: "menu.html#order",
      promos: "promotions.html",
      contact: "contact.html",
    };
    if (!map[hash]) return;
    var path = location.pathname || "";
    var onHome = /\/$/.test(path) || /index\.html$/.test(path);
    if (onHome) location.replace(map[hash]);
  })();

  document.addEventListener("DOMContentLoaded", async function () {
    await SB.data.init();
    settings = await SB.data.getSettings();
    products = SB.products;
    config = SB.config;
    promos = SB.promos || [];
    session = await SB.data.getSession();
    await SB.chrome.boot();
    restoreCart();
    var savedPromo = $("#promo-code");
    if (savedPromo && appliedPromo && appliedPromo.code && !savedPromo.value) {
      savedPromo.value = appliedPromo.code;
    }
    prefillCheckoutFromSession();

    var accountHint = $("#account-hint");
    if (accountHint) {
      accountHint.innerHTML = session
        ? "Logged in as <strong>" + escapeHtml(session.user.email) + "</strong> — orders will appear in your history."
        : 'Guest checkout works. <a href="account.html">Register / log in</a> to save past orders.';
    }

    renderMenu();
    renderPromos();
    renderDeliveryFees();
    fillAreaDropdown();
    fillContactPlaceholders();
    bindDelivery();
    bindCheckout();
    updateRadiusCopy();
    refreshCartUI();
    initMap();

    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href").slice(1);
        var target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  });
})();
