/**
 * Shared header chrome: demo banner + auth nav.
 * Pure helpers are exported for Node tests; DOM behavior runs in the browser.
 */
(function (root, factory) {
  var helpers = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  }
  var SB = (root.SAMALBAKES = root.SAMALBAKES || {});
  if (typeof document === "undefined") return;

  var globalsBound = false;

  function ensureDemoBanner() {
    if (!SB.data || !SB.data.isDemo) return;
    if (document.getElementById("demo-banner")) return;
    var b = document.createElement("div");
    b.id = "demo-banner";
    b.className = "demo-banner";
    b.innerHTML =
      "<strong>Demo mode</strong> — orders stay in this browser and are not sent to the bakery.";
    document.body.insertBefore(b, document.body.firstChild);
  }

  function menuRoot() {
    return document.querySelector("[data-account-menu]");
  }

  function isOpen(menu) {
    var btn = menu && menu.querySelector(".account-trigger");
    return !!(btn && btn.getAttribute("aria-expanded") === "true");
  }

  function menuItemsEls(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
  }

  function placePanel(menu) {
    var panel = menu.querySelector(".account-panel");
    if (!panel) return;
    panel.classList.remove("align-start");
    var rect = panel.getBoundingClientRect();
    if (rect.left < 8) panel.classList.add("align-start");
  }

  function setOpen(menu, open, focusTarget) {
    var btn = menu.querySelector(".account-trigger");
    var panel = menu.querySelector(".account-panel");
    if (!btn || !panel) return;
    if (open) {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      placePanel(menu);
      if (focusTarget === "first" || focusTarget === "last") {
        var items = menuItemsEls(menu);
        var el = focusTarget === "last" ? items[items.length - 1] : items[0];
        if (el) el.focus();
      }
    } else {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (focusTarget === "trigger") btn.focus();
    }
  }

  function wireMenu(slot) {
    var menu = slot.querySelector("[data-account-menu]");
    if (!menu) return;
    var btn = menu.querySelector(".account-trigger");
    if (btn) {
      btn.addEventListener("click", function (e) {
        var open = btn.getAttribute("aria-expanded") === "true";
        if (open) setOpen(menu, false, null);
        else setOpen(menu, true, e.detail === 0 ? "first" : null);
      });
    }
    menu.addEventListener("click", function (e) {
      var item = e.target.closest(".account-item");
      if (!item) return;
      if (item.id === "nav-logout") {
        item.disabled = true;
        Promise.resolve(SB.data.logout())
          .then(function () {
            location.href = "index.html";
          })
          .catch(function () {
            item.disabled = false;
          });
        return;
      }
      setOpen(menu, false, null);
    });
  }

  function isTyping(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function focusItem(items, index) {
    if (!items.length) return;
    var next = index;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    items[next].focus();
  }

  function onDocumentClick(e) {
    var menu = menuRoot();
    if (!menu || !isOpen(menu)) return;
    if (menu.contains(e.target)) return;
    setOpen(menu, false, null);
  }

  function onDocumentKeydown(e) {
    var menu = menuRoot();
    if (!menu) return;
    var btn = menu.querySelector(".account-trigger");
    var open = isOpen(menu);
    if (!open) {
      if (
        !isTyping(document.activeElement) &&
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        document.activeElement === btn
      ) {
        e.preventDefault();
        setOpen(menu, true, e.key === "ArrowUp" ? "last" : "first");
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(menu, false, "trigger");
      return;
    }
    if (e.key === "Tab") {
      setOpen(menu, false, null);
      return;
    }
    if (isTyping(document.activeElement)) return;
    var items = menuItemsEls(menu);
    var idx = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(items, idx < 0 ? 0 : idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(items, idx < 0 ? items.length - 1 : idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(items, 0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items, items.length - 1);
    } else if (e.key === " " && idx >= 0) {
      e.preventDefault();
      items[idx].click();
    }
  }

  function onResize() {
    var menu = menuRoot();
    if (menu && isOpen(menu)) placePanel(menu);
  }

  function bindGlobals() {
    if (globalsBound) return;
    globalsBound = true;
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);
    window.addEventListener("resize", onResize);
  }

  function refreshCartBadge() {
    var badge = document.getElementById("cart-count");
    if (!badge) return;
    var n = 0;
    try {
      var cart = JSON.parse(localStorage.getItem("sb_cart") || "{}");
      if (cart && typeof cart === "object") {
        Object.keys(cart).forEach(function (id) {
          var qty = parseInt(cart[id], 10);
          if (qty > 0) n += qty;
        });
      }
    } catch (e) {}
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  function bindNavToggle() {
    var btn = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!btn || !nav || btn.getAttribute("data-bound") === "1") return;
    btn.setAttribute("data-bound", "1");
    var label = btn.querySelector(".visually-hidden");
    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) label.textContent = open ? "Close menu" : "Open menu";
    }
    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
  }

  async function refreshAuthNav() {
    var slot = document.querySelector("[data-auth-nav]");
    if (!slot || !SB.data) return;
    var session = await SB.data.getSession();
    slot.innerHTML = helpers.renderAuthNav(session);
    wireMenu(slot);
  }

  SB.chrome = {
    boot: async function () {
      ensureDemoBanner();
      bindGlobals();
      bindNavToggle();
      refreshCartBadge();
      await refreshAuthNav();
    },
    refreshAuthNav: refreshAuthNav,
    refreshCartBadge: refreshCartBadge,
    escapeHtml: helpers.escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var PERSON_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 12.2a4.1 4.1 0 1 0-4.1-4.1 4.1 4.1 0 0 0 4.1 4.1zm0 2.1c-3.4 0-8 1.7-8 5.1V21h16v-1.6c0-3.4-4.6-5.1-8-5.1z"/>' +
    "</svg>";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nameParts(fullName) {
    return String(fullName || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }

  /**
   * Avatar + label for the account button.
   * Initials come from the first and last words of full_name.
   * No name → empty initials (person icon) and a fallback label.
   */
  function accountIdentity(user) {
    var parts = nameParts(user && user.full_name);
    var initials = "";
    if (parts.length === 1) initials = parts[0].charAt(0).toUpperCase();
    else if (parts.length > 1) {
      initials = (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    var label = parts.length ? parts[0] : "";
    if (!label) {
      var email = String((user && user.email) || "").trim();
      var local = email.split("@")[0];
      label = local || "Account";
    }
    return { label: label, initials: initials, hasName: parts.length > 0 };
  }

  function menuItems(user) {
    var items = [
      { id: "orders", label: "My orders", href: "account.html#history" },
      { id: "account", label: "My account", href: "account.html#profile" },
    ];
    if (user && user.is_admin) {
      items.push({ id: "admin", label: "Admin", href: "admin.html" });
    }
    items.push({ id: "logout", label: "Log out" });
    return items;
  }

  function renderAuthNav(session) {
    if (!session || !session.user) {
      return '<a href="account.html">Log in</a>';
    }
    var idn = accountIdentity(session.user);
    var items = menuItems(session.user);
    var avatar = idn.initials
      ? '<span class="account-avatar" aria-hidden="true">' + escapeHtml(idn.initials) + "</span>"
      : '<span class="account-avatar account-avatar-icon" aria-hidden="true">' + PERSON_SVG + "</span>";
    var menu = items
      .map(function (item) {
        if (!item.href) {
          return (
            '<button type="button" class="account-item account-logout" role="menuitem" id="nav-logout" tabindex="-1">' +
            escapeHtml(item.label) +
            "</button>"
          );
        }
        return (
          '<a class="account-item" role="menuitem" tabindex="-1" href="' +
          escapeHtml(item.href) +
          '">' +
          escapeHtml(item.label) +
          "</a>"
        );
      })
      .join("");
    return (
      '<span class="account-menu" data-account-menu>' +
      '<button type="button" class="account-trigger" id="account-menu-button" ' +
      'aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu-panel" ' +
      'aria-label="' +
      escapeHtml("Account menu for " + idn.label) +
      '">' +
      avatar +
      '<span class="account-name">' +
      escapeHtml(idn.label) +
      "</span>" +
      '<svg class="account-caret" viewBox="0 0 12 8" aria-hidden="true" focusable="false">' +
      '<path d="M1 1.5 L6 6.5 L11 1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></button>" +
      '<span class="account-panel" id="account-menu-panel" role="menu" aria-labelledby="account-menu-button" hidden>' +
      menu +
      "</span></span>"
    );
  }

  return {
    escapeHtml: escapeHtml,
    accountIdentity: accountIdentity,
    menuItems: menuItems,
    renderAuthNav: renderAuthNav,
  };
});
