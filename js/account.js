(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  function qs(s) { return document.querySelector(s); }
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
  function escape(s) { return SB.chrome.escapeHtml(s); }
  async function renderHistory() {
    var session = await SB.data.getSession();
    var authPanels = qs("#auth-panels");
    var history = qs("#history");
    if (!session) { authPanels.hidden = false; history.hidden = true; return; }
    authPanels.hidden = true; history.hidden = false;
    qs("#history-user").textContent = session.user.email + (session.user.is_admin ? " (admin)" : "");
    var orders = await SB.data.getMyOrders();
    var list = qs("#history-list"); var empty = qs("#history-empty");
    if (!orders.length) { list.innerHTML = ""; empty.hidden = false; return; }
    empty.hidden = true;
    list.innerHTML = orders.map(function (o) {
      var items = (o.items || o.order_items || []).map(function (i) {
        return escape(i.product_name) + " x " + i.qty + " (" + peso(i.line_total) + ")";
      }).join("<br>");
      return '<article class="card" style="margin-bottom:0.75rem">' +
        '<div class="totals-row"><strong>' + formatWhen(o.created_at) +
        '</strong><span class="pill">' + escape(statusLabel(o.status)) + '</span></div>' +
        '<div class="muted" style="margin:0.5rem 0">' + items + '</div>' +
        '<div class="totals-row"><span>Total</span><strong>' + peso(o.total) + '</strong></div>' +
        '<div class="muted">Ready est.: ' + formatWhen(o.estimated_ready_at) + ' · COD</div></article>';
    }).join("");
  }
  document.addEventListener("DOMContentLoaded", async function () {
    await SB.data.init();
    await SB.chrome.boot();
    if (SB.data.isDemo) {
      var box = qs("#demo-creds"); box.hidden = false;
      var c = SB.data.demoCredentials;
      box.innerHTML = "<strong>Demo admin login</strong> (only shown in demo mode): email <code>" +
        c.email + "</code> · password <code>" + c.password + "</code>";
    }
    qs("#login-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await SB.data.login(qs("#login-email").value, qs("#login-password").value);
        show(qs("#login-msg"), "Logged in.", "ok");
        await SB.chrome.refreshAuthNav();
        var s = await SB.data.getSession();
        if (s.user.is_admin) { location.href = "admin.html"; return; }
        await renderHistory();
      } catch (err) { show(qs("#login-msg"), err.message, "warn"); }
    });
    qs("#register-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await SB.data.register(qs("#reg-email").value, qs("#reg-password").value, qs("#reg-name").value);
        show(qs("#reg-msg"), "Account created.", "ok");
        await SB.chrome.refreshAuthNav();
        await renderHistory();
      } catch (err) { show(qs("#reg-msg"), err.message, "warn"); }
    });
    await renderHistory();
  });
})();
