/**
 * Account menu model (Node).
 * Run: node tests/account-menu.test.js
 */
const path = require("path");
const chrome = require(path.join(__dirname, "..", "js", "chrome.js"));

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  OK  " + msg);
  } else {
    failed++;
    console.error("  FAIL  " + msg);
  }
}

console.log("logged out");
{
  const html = chrome.renderAuthNav(null);
  assert(html === '<a href="account.html">Log in</a>', "logged-out nav is the Log in link");
  assert(html.indexOf("account-menu") === -1, "logged-out nav has no account menu");
  assert(html.indexOf("Log out") === -1, "logged-out nav has no log out");
}

console.log("identity");
{
  const demo = chrome.accountIdentity({
    full_name: "Demo Admin",
    email: "admin@demo.local",
  });
  assert(demo.label === "Demo", "first name is the button label");
  assert(demo.initials === "DA", "two-word name → first and last initials");
  assert(demo.hasName === true, "named user has a name");

  const single = chrome.accountIdentity({ full_name: "Ana", email: "ana@x.test" });
  assert(single.initials === "A", "single name → one initial");
  assert(single.label === "Ana", "single name label is kept as typed");

  const three = chrome.accountIdentity({ full_name: "Juan Dela Cruz", email: "j@x.test" });
  assert(three.label === "Juan", "first word is the label");
  assert(three.initials === "JC", "three-word name uses first and last initials");

  const spaced = chrome.accountIdentity({ full_name: "  maria   santos  ", email: "m@x.test" });
  assert(spaced.label === "maria", "extra spaces are ignored; case is kept");
  assert(spaced.initials === "MS", "initials are uppercase");

  const nameless = chrome.accountIdentity({ full_name: "   ", email: "baker@samal.test" });
  assert(nameless.hasName === false, "blank name is not a name");
  assert(nameless.initials === "", "blank name has no initials");
  assert(nameless.label === "baker", "fallback label is the email name");

  const empty = chrome.accountIdentity({ full_name: "", email: "" });
  assert(empty.label === "Account", "missing name and email → Account");
  assert(empty.initials === "", "missing name has no initials");
}

console.log("menu items");
{
  const admin = chrome.menuItems({ is_admin: true });
  assert(
    admin.map(function (i) { return i.label; }).join("|") === "My orders|My account|Admin|Log out",
    "admin sees orders, account, admin, log out"
  );
  assert(admin[0].href === "account.html#history", "orders link is order history");
  assert(admin[1].href === "account.html#profile", "account link is the profile section");
  assert(admin[2].href === "admin.html", "admin link is the admin page");

  const customer = chrome.menuItems({ is_admin: false });
  assert(
    customer.map(function (i) { return i.id; }).join("|") === "orders|account|logout",
    "customer menu has no admin item"
  );
}

console.log("rendered menu");
{
  const html = chrome.renderAuthNav({
    user: { full_name: "Demo Admin", email: "admin@demo.local", is_admin: true },
  });
  assert(html.indexOf('aria-haspopup="menu"') !== -1, "trigger has aria-haspopup");
  assert(html.indexOf('aria-expanded="false"') !== -1, "menu starts closed");
  assert(html.indexOf('aria-controls="account-menu-panel"') !== -1, "trigger controls the panel");
  assert(html.indexOf('role="menu"') !== -1, "panel is a menu");
  assert(html.indexOf('role="menuitem"') !== -1, "actions are menuitems");
  assert(html.indexOf(" hidden>") !== -1 || html.indexOf(" hidden ") !== -1, "panel is hidden until opened");
  assert(html.indexOf(">DA<") !== -1, "avatar shows initials");
  assert(html.indexOf(">Demo<") !== -1, "button shows first name");
  assert(html.indexOf("My orders") !== -1, "menu includes My orders");
  assert(html.indexOf("My account") !== -1, "menu includes My account");
  assert(html.indexOf('href="admin.html"') !== -1, "admin item is present");
  assert(html.indexOf('id="nav-logout"') !== -1, "log out keeps the logout control");
  assert(html.indexOf("Hi,") === -1, "plain Hi greeting is gone");

  const customer = chrome.renderAuthNav({
    user: { full_name: "Maria Santos", email: "maria@x.test", is_admin: false },
  });
  assert(customer.indexOf("admin.html") === -1, "customer markup has no admin link");
  assert(customer.indexOf(">MS<") !== -1, "customer initials render");

  const icon = chrome.renderAuthNav({
    user: { full_name: "", email: "baker@samal.test", is_admin: false },
  });
  assert(icon.indexOf("account-avatar-icon") !== -1, "no name uses the person icon");
  assert(icon.indexOf("<svg") !== -1, "person icon is an svg");
  assert(icon.indexOf(">baker<") !== -1, "email name is the visible label");
  assert(icon.indexOf(">B<") === -1, "email is not turned into an initial");

  const nasty = chrome.renderAuthNav({
    user: { full_name: '<b>"ok"</b>', email: "a@x.test", is_admin: false },
  });
  assert(nasty.indexOf("<b>") === -1, "name is escaped");
  assert(nasty.indexOf("&lt;b&gt;") !== -1, "escaped tags remain visible as text");
  assert(nasty.indexOf("&quot;ok&quot;") !== -1, "quotes in the name are escaped");
}

console.log("");
if (failed) {
  console.error(failed + " failed, " + passed + " passed");
  process.exit(1);
}
console.log(passed + " passed");
