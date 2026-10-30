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

  function categoryLabel(cat) {
    var c = String(cat || "").toLowerCase();
    if (c.indexOf("cake") === 0) return "Cake";
    if (c.indexOf("bread") === 0) return "Bread";
    return cat || "—";
  }

  async function renderProducts() {
    var el = qs("#admin-products");
    if (!el) return;
    var list;
    try {
      list = await SB.data.getProducts(true);
    } catch (err) {
      el.innerHTML = '<li class="muted">' + SB.chrome.escapeHtml(err.message || "Could not load products.") + "</li>";
      return;
    }
    if (!list.length) {
      el.innerHTML = '<li class="muted">No products yet. Use + to add one.</li>';
      return;
    }
    el.innerHTML = list.map(function (p) {
      var img = p.image || p.image_url || "";
      var thumb = img
        ? '<img class="admin-thumb" src="' + SB.chrome.escapeHtml(img) + '" alt=""/>'
        : '<span class="admin-thumb admin-thumb-empty" aria-hidden="true">' +
          SB.chrome.escapeHtml(categoryLabel(p.category).charAt(0)) + "</span>";
      var status = p.active ? "Active" : "Hidden";
      var statusClass = p.active ? "is-active" : "is-hidden";
      return '<li><a class="product-row" href="admin-product.html?id=' +
        encodeURIComponent(p.id) + '">' + thumb +
        '<span class="product-row-main"><strong>' + SB.chrome.escapeHtml(p.name) + "</strong>" +
        '<span class="product-row-meta">' + SB.chrome.escapeHtml(categoryLabel(p.category)) +
        " · " + peso(p.price) + "</span></span>" +
        '<span class="product-status ' + statusClass + '">' + status + "</span></a></li>";
    }).join("");
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

  function showTab(name) {
    qsa(".admin-tabs .tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    qsa(".admin-panel").forEach(function (p) { p.hidden = true; });
    var panel = qs("#tab-" + name);
    if (panel) panel.hidden = false;
  }

  function bindTabs() {
    qsa(".admin-tabs .tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        showTab(tab);
        if (history.replaceState) history.replaceState(null, "", "#" + tab);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    await SB.data.init();
    await SB.chrome.boot();
    var session = await SB.data.getSession();
    if (!session) {
      location.replace("account.html");
      return;
    }
    if (!session.user.is_admin) {
      location.replace("index.html");
      return;
    }
    qs("#admin-gate").hidden = true;
    qs("#admin-app").hidden = false;
    bindTabs();
    var hash = (location.hash || "").replace("#", "");
    if (hash === "products" || hash === "orders" || hash === "settings") showTab(hash);
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

  });
})();
