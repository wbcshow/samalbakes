/**
 * Unit tests for ready-time calculator (Node).
 * Run: node tests/ready-time.test.js
 */
const path = require("path");
const rt = require(path.join(__dirname, "..", "js", "ready-time.js"));

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

function assertClose(a, b, tol, msg) {
  assert(Math.abs(a - b) <= tol, msg + " (got " + a + ", expected ~" + b + ")");
}

// Minimal config matching production placeholders
const config = {
  timezone: "Asia/Manila",
  workingHours: {
    0: null,
    1: { open: "08:00", close: "18:00" },
    2: { open: "08:00", close: "18:00" },
    3: { open: "08:00", close: "18:00" },
    4: { open: "08:00", close: "18:00" },
    5: { open: "08:00", close: "18:00" },
    6: { open: "08:00", close: "16:00" },
  },
  production: {
    ovenBatchSlots: 12,
    allowMixedBatches: true,
    packingBufferMinutes: 15,
    deliveryBufferMinutes: 30,
    globalMinLeadMinutes: 60,
  },
};

const products = {
  cookie: { id: "cookie", bakeTimeMinutes: 25, prepMinutes: 10, slots: 2, minLeadMinutes: 60 },
  loaf: { id: "loaf", bakeTimeMinutes: 55, prepMinutes: 20, slots: 4, minLeadMinutes: 90 },
  cake: { id: "cake", bakeTimeMinutes: 70, prepMinutes: 40, slots: 6, minLeadMinutes: 120 },
};

console.log("planBatches");
{
  const plan = rt.planBatches(
    [{ product: products.cookie, qty: 2 }],
    config.production
  );
  // 2 cookies × 2 slots = 4 slots, one batch, bake 25, prep max 10
  assert(plan.batches.length === 1, "2 cookies → 1 batch");
  assert(plan.bakeMinutes === 25, "bake = 25");
  assert(plan.prepMinutes === 10, "prep = 10");
}

{
  // Fill oven: 6 cookies × 2 slots = 12 → 1 batch; 7th starts batch 2
  const plan = rt.planBatches(
    [{ product: products.cookie, qty: 7 }],
    config.production
  );
  assert(plan.batches.length === 2, "7 cookies (14 slots) → 2 batches");
  assert(plan.bakeMinutes === 50, "2 × 25 bake minutes");
}

{
  const plan = rt.planBatches(
    [
      { product: products.cookie, qty: 1 },
      { product: products.loaf, qty: 1 },
    ],
    config.production
  );
  assert(plan.prepMinutes === 20, "prep is max of items");
  assert(plan.batches.length >= 1, "mixed items produce batches");
  assert(plan.maxMinLead === 90, "max minLead from loaf");
}

console.log("after-hours → next working morning");
{
  // Sunday evening Manila — closed; should start Monday 08:00
  // Construct a Date that is Sunday ~20:00 Asia/Manila
  // 2026-10-25 was a Sunday.
  const sundayEve = new Date("2026-10-25T12:00:00Z"); // 20:00 Manila (UTC+8)
  const parts = rt.zonedParts(sundayEve, "Asia/Manila");
  assert(parts.weekday === 0, "fixture is Sunday in Manila (weekday=" + parts.weekday + " hour=" + parts.hour + ")");

  const est = rt.estimate({
    lines: [{ product: products.cookie, qty: 1 }],
    config,
    now: sundayEve,
  });
  const start = rt.zonedParts(est.startAt, "Asia/Manila");
  assert(start.weekday === 1, "work starts Monday");
  assert(start.hour === 8 && start.minute === 0, "starts at 08:00");
  assert(est.readyAt > est.startAt, "ready after start");
  assert(est.deliverFrom > est.readyAt, "delivery after ready (+ buffer)");
}

console.log("during hours — ready same day");
{
  // Tuesday 09:00 Manila = 01:00 UTC
  const tueMorning = new Date("2026-10-27T01:00:00Z");
  const p = rt.zonedParts(tueMorning, "Asia/Manila");
  assert(p.weekday === 2 && p.hour === 9, "fixture Tue 09:00 Manila");

  const est = rt.estimate({
    lines: [{ product: products.cookie, qty: 1 }],
    config,
    now: tueMorning,
  });
  // work: prep 10 + bake 25 + pack 15 = 50; min lead 60 → at least 60 min from now
  const ready = rt.zonedParts(est.readyAt, "Asia/Manila");
  assert(ready.weekday === 2, "ready same Tuesday");
  assert(est.workMinutes === 10 + 25 + 15, "workMinutes = prep+bake+pack");
}

console.log("formatReady");
{
  const d = new Date("2026-10-30T06:30:00Z"); // 14:30 Manila
  const s = rt.formatReady(d, "Asia/Manila");
  assert(/Oct 30/.test(s), "contains Oct 30: " + s);
  assert(/2:30/.test(s) || /14:30/.test(s), "contains 2:30: " + s);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
