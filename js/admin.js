(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  function qs(s) { return document.querySelector(s); }
  function qsa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function show(el, text, cls) {
    el.style.display = "block";
    el.className = "msg " + cls;
    el.textContent = text;
  }
  function peso(n) {
    return "\u20b1" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 });
  }
  function statusLabel(s) { return String(s || "new").replace(/_/g, " "); }
  function formatWhen(iso) {
    if (!iso) return "-";
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: (SB.config && SB.config.timezone) || "Asia/Manila",
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      }).format(new Date(iso));
    } catch (e) { return iso; }
  }

  function fillSettingsForm(s) {
    var form = qs("#settings-form");
    Object.keys(s).forEach(function (k) {
      var input = form.elements.namedItem(k);
      if (input && input.tagName) input.value = s[k] == null ? "" : s[k];
    });
  }

  async function renderProducts() {
    var list = await SB.data.getProducts(true);
    var el = qs("#admin-products");
    el.innerHTML = list.map(function (p) {
      var img = p.image || p.image_url || "";
      var thumb = img
        ? '<img class="admin-thumb" src="' + SB.chrome.escapeHtml(img) + '" alt=""/>'
        : "";
      return '<div class="cart-line admin-prod-row">' + thumb +
        "<div><strong>" + SB.chrome.escapeHtml(p.name) + "</strong> " +
        (p.active ? "" : '<span class="badge sample">Hidden</span>') +
        ((p.photoReal || p.photo_real) ? ' <span class="badge photo-real">Photo real</span>' : "") +
        '<div class="muted">' + SB.chrome.escapeHtml(p.category) + " · " + peso(p.price) +
        " · bake " + p.bakeTimeMinutes + "m · id <code>" + SB.chrome.escapeHtml(p.id) +
        "</code></div></div>" +
        '<button type="button" class="btn ghost small" data-edit-product="' +
        SB.chrome.escapeHtml(p.id) + '">Edit</button></div>';
    }).join("") || '<p class="muted">No products.</p>';
    el.onclick = function (e) {
      var id = e.target.getAttribute("data-edit-product");
      if (!id) return;
      var p = list.find(function (x) { return x.id === id; });
      if (!p) return;
      var form = qs("#product-form");
      form.id.value = p.id;
      form.name.value = p.name;
      form.description.value = p.description || "";
      form.price.value = p.price;
      form.bake_time_minutes.value = p.bake_time_minutes || p.bakeTimeMinutes;
      form.prep_minutes.value = p.prep_minutes || p.prepMinutes || 0;
      form.min_lead_minutes.value = p.min_lead_minutes || p.minLeadMinutes || 60;
      form.slots.value = p.slots || 1;
      form.category.value = p.category || "Breads";
      form.active.value = p.active ? "true" : "false";
      form.sort_order.value = p.sort_order || 0;
      form.wholesale_note.value = p.wholesale_note || p.wholesaleNote || "";
      if (form.image_url) form.image_url.value = p.image_url || p.image || "";
      if (form.photo_real) form.photo_real.value = (p.photoReal || p.photo_real) ? "true" : "false";
      var prev = document.getElementById("product-image-preview");
      if (prev) {
        var src = p.image_url || p.image || "";
        prev.src = src || "";
        prev.hidden = !src;
      }
    };
  }

  async function renderOrders() {
    var orders = await SB.data.getAllOrders();
    var el = qs("#admin-orders");
    var statuses = ["new", "baking", "ready", "out_for_delivery", "delivered", "cancelled"];
    if (!orders.length) {
      el.innerHTML = '<p class="muted">No orders yet.</p>';
      return;
    }
    el.innerHTML = orders.map(function (o) {
      var items = (o.items || o.order_items || []).map(function (i) {
        return SB.chrome.escapeHtml(i.product_name) + " x " + i.qty;
      }).join(", ");
      var opts = statuses.map(function (st) {
        return '<option value="' + st + '"' + (o.status === st ? " selected" : "") + ">" +
          statusLabel(st) + "</option>";
      }).join("");
      return '<article class="card" style="margin-bottom:0.75rem">' +
        "<div class=\"totals-row\"><strong>" + formatWhen(o.created_at) +
        "</strong><span>" + peso(o.total) + " COD</span></div>" +
        '<div class="muted">' + items + "</div>" +
        '<div class="muted">' + SB.chrome.escapeHtml(o.guest_name || o.guest_email || o.user_id || "guest") +
        (o.delivery_address ? " · " + SB.chrome.escapeHtml(o.delivery_address) : "") + "</div>" +
        '<div class="row" style="margin-top:0.5rem;align-items:center">' +
        '<label>Status</label> <select data-order-status="' + o.id + '">' + opts + "</select></div></article>";
    }).join("");
    el.onchange = async function (e) {
      var id = e.target.getAttribute("data-order-status");
      if (!id) return;
      try {
        await SB.data.updateOrderStatus(id, e.target.value);
      } catch (err) {
        alert(err.message);
      }
    };
  }

  function bindTabs() {
    qsa(".admin-tabs .tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        qsa(".admin-tabs .tab").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var tab = btn.getAttribute("data-tab");
        qsa(".admin-panel").forEach(function (p) { p.hidden = true; });
        qs("#tab-" + tab).hidden = false;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    await SB.data.init();
    await SB.chrome.boot();
    var session = await SB.data.getSession();
    if (!session || !session.user.is_admin) {
      qs("#admin-gate").hidden = false;
      qs("#admin-app").hidden = true;
      return;
    }
    qs("#admin-gate").hidden = true;
    qs("#admin-app").hidden = false;
    bindTabs();
    fillSettingsForm(await SB.data.getSettings());
    await renderProducts();
    await renderOrders();

    qs("#settings-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var partial = {};
      fd.forEach(function (v, k) {
        if (["delivery_center_lat","delivery_center_lng","delivery_radius_km","delivery_fee_flat","delivery_fee_per_km","free_delivery_min_order","oven_batch_slots","packing_buffer_minutes","delivery_buffer_minutes"].indexOf(k) >= 0) {
          partial[k] = Number(v);
        } else {
          partial[k] = v;
        }
      });
      try {
        await SB.data.saveSettings(partial);
        show(qs("#settings-msg"), "Settings saved — storefront will use these values.", "ok");
      } catch (err) {
        show(qs("#settings-msg"), err.message, "warn");
      }
    });

    var fileInput = qs("#product-image-file");
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        if (!SB.data.isDemo) {
          show(qs("#product-msg"), "In live mode, upload images to the site img/ folder (or storage) and paste the path. Demo mode can store a local file as a data URL.", "info");
          return;
        }
        if (f.size > 900000) {
          show(qs("#product-msg"), "Please choose an image under ~900KB for demo storage.", "warn");
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var form = qs("#product-form");
          form.image_url.value = reader.result;
          var prev = document.getElementById("product-image-preview");
          if (prev) { prev.src = reader.result; prev.hidden = false; }
          show(qs("#product-msg"), "Image loaded for demo (saved with product).", "ok");
        };
        reader.readAsDataURL(f);
      });
    }

    qs("#product-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var prod = {};
      fd.forEach(function (v, k) { prod[k] = v; });
      prod.price = Number(prod.price);
      prod.bake_time_minutes = Number(prod.bake_time_minutes);
      prod.prep_minutes = Number(prod.prep_minutes || 0);
      prod.min_lead_minutes = Number(prod.min_lead_minutes || 60);
      prod.slots = Number(prod.slots || 1);
      prod.sort_order = Number(prod.sort_order || 0);
      prod.active = prod.active === "true";
      prod.photo_real = prod.photo_real === "true";
      prod.example = !prod.photo_real;
      prod.image_url = prod.image_url || "";
      prod.image = prod.image_url;
      try {
        await SB.data.saveProduct(prod);
        show(qs("#product-msg"), "Product saved.", "ok");
        await renderProducts();
      } catch (err) {
        show(qs("#product-msg"), err.message, "warn");
      }
    });
  });
})();
