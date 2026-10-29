/** Shared header chrome: demo banner + auth nav link updates */
(function () {
  "use strict";
  var SB = window.SAMALBAKES;

  function ensureDemoBanner() {
    if (!SB.data || !SB.data.isDemo) return;
    if (document.getElementById("demo-banner")) return;
    var b = document.createElement("div");
    b.id = "demo-banner";
    b.className = "demo-banner";
    b.innerHTML =
      "<strong>Demo mode</strong> — data stays in this browser (localStorage). " +
      "Paste real Supabase keys in <code>js/supabase-config.js</code> to go live.";
    document.body.insertBefore(b, document.body.firstChild);
  }

  async function refreshAuthNav() {
    var slot = document.querySelector("[data-auth-nav]");
    if (!slot || !SB.data) return;
    var session = await SB.data.getSession();
    if (!session) {
      slot.innerHTML = '<a href="account.html">Log in</a>';
      return;
    }
    var name = session.user.full_name || session.user.email;
    var bits =
      '<a href="account.html">Hi, ' +
      escapeHtml(name.split("@")[0]) +
      "</a>" +
      ' · <a href="account.html#history">Orders</a>';
    if (session.user.is_admin) {
      bits += ' · <a href="admin.html">Admin</a>';
    }
    bits +=
      ' · <button type="button" class="linkish" id="nav-logout">Log out</button>';
    slot.innerHTML = bits;
    var btn = document.getElementById("nav-logout");
    if (btn) {
      btn.addEventListener("click", async function () {
        await SB.data.logout();
        location.href = "index.html";
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  SB.chrome = {
    boot: async function () {
      ensureDemoBanner();
      await refreshAuthNav();
    },
    refreshAuthNav: refreshAuthNav,
    escapeHtml: escapeHtml,
  };
})();
