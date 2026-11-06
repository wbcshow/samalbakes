(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  function qs(s) { return document.querySelector(s); }
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
  async function renderOrders() {
    var session = await SB.data.getSession();
    qs("#orders-login").hidden = !!session;
    qs("#history").hidden = !session;
    if (!session) return;
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
          '<div class="totals-row"><strong>Ordered on: ' + formatWhen(o.created_at) +
        '</strong><span class="pill">' + escape(statusLabel(o.status)) + '</span></div>' +
        '<div class="muted" style="margin:0.5rem 0">' + items + '</div>' +
        '<div class="totals-row"><span>Total</span><strong>' + peso(o.total) + '</strong></div>' +
        '<div class="muted">' + escape(SB.orderConfirmation.historyLabel(o,formatWhen)) + ' (Philippine time) · COD</div>' +
        (o.confirmed_ready_at ? '<div class="muted">Original estimate: ' + formatWhen(o.estimated_ready_at) + '</div>' : '') +
        (o.confirmed_ready_note ? '<p>' + escape(o.confirmed_ready_note) + '</p>' : '') + '</article>';
    }).join("");
  }
  document.addEventListener("DOMContentLoaded",async function(){
    try { await SB.data.init(); await SB.chrome.boot(); await renderOrders(); }
    catch(error) { var message=qs("#orders-error"); message.hidden=false; message.textContent="Could not load your orders. Please refresh and try again."; }
  });
})();
