(function () {
  "use strict";
  var SB = window.SAMALBAKES;
  function qs(s) { return document.querySelector(s); }
  function show(el, text, cls) {
    el.style.display = "block";
    el.className = "msg " + cls;
    el.textContent = text;
  }
  function escape(s) { return SB.chrome.escapeHtml(s); }
  function fillProfile(session) {
    var name = qs("#profile-name");
    if (!name || !session) return;
    name.value = session.user.full_name || "";
    qs("#profile-email").value = session.user.email || "";
    qs("#profile-phone").value = session.user.phone || "";
    qs("#profile-address").value = session.user.delivery_address || "";
  }
  async function renderAccount() {
    var session = await SB.data.getSession();
    qs("#auth-panels").hidden = !!session;
    qs("#profile").hidden = !session;
    fillProfile(session);
  }
  document.addEventListener("DOMContentLoaded", async function () {
    if (location.hash === "#history") { location.replace("my-orders.html"); return; }
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
        location.href = s.user.is_admin ? "admin.html" : "index.html";
      } catch (err) { show(qs("#login-msg"), err.message, "warn"); }
    });
    qs("#register-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await SB.data.register(qs("#reg-email").value, qs("#reg-password").value, qs("#reg-name").value);
        show(qs("#reg-msg"), "Account created.", "ok");
        await SB.chrome.refreshAuthNav();
        await renderAccount();
      } catch (err) {
        show(qs("#reg-msg"), err.message, err.code === "email_confirmation_required" ? "ok" : "warn");
      }
    });
    qs("#profile-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = qs("#profile-msg");
      try {
        await SB.data.updateProfile({
          full_name: qs("#profile-name").value,
          phone: qs("#profile-phone").value,
          delivery_address: qs("#profile-address").value,
        });
        show(msg, "Profile saved.", "ok");
      } catch (err) {
        show(msg, err.message || "Could not save profile.", "warn");
      }
      await SB.chrome.refreshAuthNav();
      await renderAccount();
    });
    qs("#password-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = qs("#password-msg");
      var next = qs("#pw-new").value;
      if (next !== qs("#pw-confirm").value) {
        show(msg, "New password and confirmation don’t match.", "warn");
        return;
      }
      try {
        await SB.data.changePassword(qs("#pw-current").value, next);
        qs("#password-form").reset();
        show(msg, "Password updated.", "ok");
      } catch (err) {
        show(msg, err.message || "Could not change password.", "warn");
      }
    });
    await renderAccount();
    if (location.hash === "#profile") {
      var target = qs(location.hash);
      if (target && !target.hidden) target.scrollIntoView();
    }
  });
})();
