/**
 * Customer menu cards hide production timing (Node).
 * Run: node tests/menu-card.test.js
 */
const path = require("path");
const menuCard = require(path.join(__dirname, "..", "js", "menu-card.js"));

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function peso(n) {
  return "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

const product = {
  id: "chiffon-cake",
  name: "Chiffon Cake",
  description: "Light golden chiffon ring cakes.",
  price: 550,
  bakeTimeMinutes: 17,
  prepMinutes: 40,
  minLeadMinutes: 240,
  slots: 6,
  category: "Cakes",
  wholesaleNote: "Ask about sizes for resorts and gatherings.",
  image: "img/products/chiffon-cake.jpg",
  example: false,
  photoReal: true,
};

console.log("customer card");
{
  const html = menuCard.customerProductCardHtml(product, {
    escapeHtml: escapeHtml,
    peso: peso,
  });
  assert(html.indexOf("Chiffon Cake") !== -1, "card shows the product name");
  assert(html.indexOf(peso(550)) !== -1, "card shows the price");
  assert(html.indexOf("Light golden chiffon") !== -1, "card shows the description");
  assert(html.indexOf("Ask about sizes") !== -1, "ordering note stays on the card");
  assert(html.indexOf("qty-plus") !== -1, "add controls stay on the card");
  assert(html.indexOf('data-id="chiffon-cake"') !== -1, "card keeps its product id");
  assert(html.indexOf("min bake") === -1, "card does not show a minute bake label");
  assert(html.indexOf("hr bake") === -1, "card does not show an hour bake label");
  assert(html.indexOf("class=\"bake\"") === -1, "card has no bake-time element");
  assert(html.indexOf(">17<") === -1 && html.indexOf("17 min") === -1, "bake minutes are not printed");
  assert(html.indexOf("240") === -1, "lead minutes are not printed");
  assert(html.indexOf("Min lead") === -1, "card has no lead-time message");
  assert(html.indexOf("Estimated ready") === -1, "card has no ready-time message");
  assert(html.indexOf("TBC") === -1, "card does not show a name/price note");
  assert(html.indexOf("Photo: real") === -1, "card does not show a photo-status badge");
  assert(product.bakeTimeMinutes === 17, "hiding the label does not strip bake-time data");
  assert(product.minLeadMinutes === 240, "lead time stays on the product");
}

console.log("sample card without a note");
{
  const html = menuCard.customerProductCardHtml(
    {
      id: "pandesal-dozen",
      name: "Pandesal (dozen)",
      description: "Soft rolls.",
      price: 80,
      bakeTimeMinutes: 45,
      minLeadMinutes: 120,
      category: "Breads",
      wholesaleNote: "",
      example: true,
      photoReal: false,
    },
    { escapeHtml: escapeHtml, peso: peso }
  );
  assert(html.indexOf("Sample") === -1, "sample badge is not shown to customers");
  assert(html.indexOf("placeholder") === -1, "sample card has no placeholder note");
  assert(html.indexOf("45") === -1, "sample card does not print bake minutes");
  assert(html.indexOf("120") === -1, "sample card does not print lead minutes");
  assert(html.indexOf("wholesale") === -1, "empty ordering note is omitted");
}

console.log("");
if (failed) {
  console.error(failed + " failed, " + passed + " passed");
  process.exit(1);
}
console.log(passed + " passed");
