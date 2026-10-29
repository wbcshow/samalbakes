/**
 * Ready-time calculator for SamalBakes.
 * Pure functions — usable in browser and Node tests.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.SAMALBAKES = root.SAMALBAKES || {};
    root.SAMALBAKES.readyTime = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /** Parse "HH:MM" to minutes from midnight. */
  function parseHM(hm) {
    var p = hm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  /**
   * Get wall-clock parts in a timezone using Intl.
   * Returns { year, month, day, hour, minute, second, weekday } (weekday 0=Sun).
   */
  function zonedParts(date, timeZone) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      weekday: "short",
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (p) {
      if (p.type !== "literal") parts[p.type] = p.value;
    });
    var wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var hour = parseInt(parts.hour, 10);
    if (hour === 24) hour = 0; // some engines
    return {
      year: parseInt(parts.year, 10),
      month: parseInt(parts.month, 10),
      day: parseInt(parts.day, 10),
      hour: hour,
      minute: parseInt(parts.minute, 10),
      second: parseInt(parts.second, 10),
      weekday: wdMap[parts.weekday],
    };
  }

  /** Approximate: build a Date that displays as Y-M-D H:M in timeZone. */
  function dateInZone(year, month, day, hour, minute, timeZone) {
    // Start from UTC guess, then adjust
    var guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    var parts = zonedParts(guess, timeZone);
    var asMinutes =
      parts.hour * 60 +
      parts.minute +
      (Date.UTC(parts.year, parts.month - 1, parts.day) -
        Date.UTC(year, month - 1, day)) /
        60000;
    var want = hour * 60 + minute;
    var diffMin = asMinutes - want;
    return new Date(guess.getTime() - diffMin * 60000);
  }

  function addCalendarDays(year, month, day, n) {
    var d = new Date(Date.UTC(year, month - 1, day + n));
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    };
  }

  /**
   * Advance from a zoned moment until we're inside working hours,
   * then consume `workMinutes` of working time (skipping closed periods).
   * Returns a Date (UTC instant) for when work finishes.
   */
  function advanceWorkingTime(startDate, workMinutes, workingHours, timeZone) {
    var remaining = Math.max(0, workMinutes);
    var cursor = new Date(startDate.getTime());
    var guard = 0;

    while (guard++ < 10000) {
      var p = zonedParts(cursor, timeZone);
      var hours = workingHours[p.weekday];
      var minsNow = p.hour * 60 + p.minute;

      if (!hours) {
        // Closed today — jump to next day open
        var next = addCalendarDays(p.year, p.month, p.day, 1);
        var nh = workingHours[next.weekday];
        var tries = 0;
        while (!nh && tries++ < 8) {
          next = addCalendarDays(next.year, next.month, next.day, 1);
          nh = workingHours[next.weekday];
        }
        if (!nh) throw new Error("No working days configured");
        cursor = dateInZone(
          next.year,
          next.month,
          next.day,
          Math.floor(parseHM(nh.open) / 60),
          parseHM(nh.open) % 60,
          timeZone
        );
        continue;
      }

      var openM = parseHM(hours.open);
      var closeM = parseHM(hours.close);

      if (minsNow < openM) {
        cursor = dateInZone(
          p.year,
          p.month,
          p.day,
          Math.floor(openM / 60),
          openM % 60,
          timeZone
        );
        continue;
      }

      if (minsNow >= closeM) {
        var nx = addCalendarDays(p.year, p.month, p.day, 1);
        var nxh = workingHours[nx.weekday];
        var t = 0;
        while (!nxh && t++ < 8) {
          nx = addCalendarDays(nx.year, nx.month, nx.day, 1);
          nxh = workingHours[nx.weekday];
        }
        cursor = dateInZone(
          nx.year,
          nx.month,
          nx.day,
          Math.floor(parseHM(nxh.open) / 60),
          parseHM(nxh.open) % 60,
          timeZone
        );
        continue;
      }

      if (remaining <= 0) return cursor;

      var available = closeM - minsNow;
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * 60000);
      }
      remaining -= available;
      // Jump to next open
      var nx2 = addCalendarDays(p.year, p.month, p.day, 1);
      var nxh2 = workingHours[nx2.weekday];
      var t2 = 0;
      while (!nxh2 && t2++ < 8) {
        nx2 = addCalendarDays(nx2.year, nx2.month, nx2.day, 1);
        nxh2 = workingHours[nx2.weekday];
      }
      cursor = dateInZone(
        nx2.year,
        nx2.month,
        nx2.day,
        Math.floor(parseHM(nxh2.open) / 60),
        parseHM(nxh2.open) % 60,
        timeZone
      );
    }
    throw new Error("advanceWorkingTime: too many iterations");
  }

  /**
   * Normalize order start into working hours (if after close / closed day → next open).
   */
  function snapToWorkStart(when, workingHours, timeZone) {
    return advanceWorkingTime(when, 0, workingHours, timeZone);
  }

  /**
   * Build oven batches from cart line items.
   * Each line: { product, qty } where product has bakeTimeMinutes, slots, prepMinutes, minLeadMinutes
   *
   * Returns { prepMinutes, bakeMinutes, batches, maxMinLead }
   */
  function planBatches(lines, production) {
    var batchSlots = production.ovenBatchSlots || 12;
    var allowMixed = production.allowMixedBatches !== false;
    var units = [];

    lines.forEach(function (line) {
      var p = line.product;
      var slots = p.slots != null ? p.slots : 1;
      for (var i = 0; i < line.qty; i++) {
        units.push({
          id: p.id,
          bake: p.bakeTimeMinutes || 0,
          slots: slots,
          prep: p.prepMinutes || 0,
          minLead: p.minLeadMinutes || 0,
        });
      }
    });

    var maxPrep = 0;
    var maxMinLead = production.globalMinLeadMinutes || 0;
    units.forEach(function (u) {
      if (u.prep > maxPrep) maxPrep = u.prep;
      if (u.minLead > maxMinLead) maxMinLead = u.minLead;
    });

    var batches = [];
    if (!units.length) {
      return { prepMinutes: 0, bakeMinutes: 0, batches: [], maxMinLead: maxMinLead };
    }

    if (!allowMixed) {
      // Group by product id; each group's units fill sequential batches
      var byId = {};
      units.forEach(function (u) {
        if (!byId[u.id]) byId[u.id] = [];
        byId[u.id].push(u);
      });
      Object.keys(byId).forEach(function (id) {
        var list = byId[id];
        var i = 0;
        while (i < list.length) {
          var used = 0;
          var bake = 0;
          var count = 0;
          while (i < list.length && used + list[i].slots <= batchSlots) {
            used += list[i].slots;
            bake = Math.max(bake, list[i].bake);
            count++;
            i++;
          }
          if (count === 0) {
            // single item larger than oven — still one batch
            bake = list[i].bake;
            i++;
            count = 1;
          }
          batches.push({ bakeMinutes: bake, slotsUsed: used, items: count });
        }
      });
    } else {
      // Pack greedily: sort by bake time descending so long items dominate batches
      units.sort(function (a, b) {
        return b.bake - a.bake || b.slots - a.slots;
      });
      var remaining = units.slice();
      while (remaining.length) {
        var used = 0;
        var bake = 0;
        var count = 0;
        var nextRem = [];
        for (var j = 0; j < remaining.length; j++) {
          var u = remaining[j];
          if (used + u.slots <= batchSlots || (used === 0 && u.slots > batchSlots)) {
            if (used === 0 && u.slots > batchSlots) {
              batches.push({ bakeMinutes: u.bake, slotsUsed: u.slots, items: 1 });
              // don't add to nextRem
            } else {
              used += u.slots;
              bake = Math.max(bake, u.bake);
              count++;
            }
          } else {
            nextRem.push(u);
          }
        }
        if (count > 0) {
          batches.push({ bakeMinutes: bake, slotsUsed: used, items: count });
        }
        remaining = nextRem;
        if (count === 0 && remaining.length && remaining[0].slots > batchSlots) {
          // safety
          batches.push({
            bakeMinutes: remaining[0].bake,
            slotsUsed: remaining[0].slots,
            items: 1,
          });
          remaining.shift();
        } else if (count === 0 && remaining.length) {
          // shouldn't happen
          break;
        }
      }
    }

    var bakeMinutes = batches.reduce(function (s, b) {
      return s + b.bakeMinutes;
    }, 0);

    return {
      prepMinutes: maxPrep,
      bakeMinutes: bakeMinutes,
      batches: batches,
      maxMinLead: maxMinLead,
    };
  }

  /**
   * Estimate ready & delivery times.
   *
   * @param {Object} opts
   * @param {Array} opts.lines - [{ product, qty }]
   * @param {Object} opts.config - SAMALBAKES.config
   * @param {Date} [opts.now] - order time (default now)
   * @returns {{ readyAt: Date, deliverFrom: Date, plan, workMinutes, startAt: Date, assumptions: string[] }}
   */
  function estimate(opts) {
    var config = opts.config;
    var production = config.production;
    var now = opts.now ? new Date(opts.now) : new Date();
    var plan = planBatches(opts.lines || [], production);

    // Work model: prep (max, overlapping) then sequential oven batches, then packing.
    // Prep and bake are sequential for simplicity (dough needs prep before oven).
    var workMinutes =
      plan.prepMinutes +
      plan.bakeMinutes +
      (production.packingBufferMinutes || 0);

    // Enforce minimum lead as a floor on total calendar wait from order snap
    var minLead = plan.maxMinLead;

    var startAt = snapToWorkStart(now, config.workingHours, config.timezone);
    var readyAt = advanceWorkingTime(
      startAt,
      workMinutes,
      config.workingHours,
      config.timezone
    );

    // If ready is before now + minLead (in absolute time), push ready forward
    // using working time from startAt for max(workMinutes, minLead) — simpler:
    // ensure readyAt >= startAt + minLead in wall time, but only counting work hours
    // for the production part. For min lead we use calendar from order time:
    var minReadyCalendar = new Date(now.getTime() + minLead * 60000);
    if (readyAt < minReadyCalendar) {
      // Push using working hours from current ready toward minReadyCalendar gap
      var gapMin = Math.ceil((minReadyCalendar - readyAt) / 60000);
      readyAt = advanceWorkingTime(
        readyAt,
        gapMin,
        config.workingHours,
        config.timezone
      );
      // If still early (closed overnight), snap
      if (readyAt < minReadyCalendar) {
        readyAt = snapToWorkStart(minReadyCalendar, config.workingHours, config.timezone);
        if (readyAt < minReadyCalendar) {
          readyAt = advanceWorkingTime(
            readyAt,
            Math.ceil((minReadyCalendar - readyAt) / 60000),
            config.workingHours,
            config.timezone
          );
        }
      }
    }

    var deliverFrom = new Date(
      readyAt.getTime() + (production.deliveryBufferMinutes || 0) * 60000
    );

    return {
      readyAt: readyAt,
      deliverFrom: deliverFrom,
      startAt: startAt,
      plan: plan,
      workMinutes: workMinutes,
      assumptions: [
        "Prep times overlap (max prep used once).",
        "Oven batches run one after another; batch duration = longest item in batch.",
        "Oven capacity: " + production.ovenBatchSlots + " slots.",
        "Mixed batches: " + (production.allowMixedBatches !== false ? "yes" : "no") + ".",
        "Packing buffer: " + (production.packingBufferMinutes || 0) + " min.",
        "Min lead: " + minLead + " min.",
        "Timezone: " + config.timezone + ".",
        "After-hours orders start next working day.",
      ],
    };
  }

  /** Format like "Thu, Oct 30, 2:30 PM" in given timezone. */
  function formatReady(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  return {
    estimate: estimate,
    planBatches: planBatches,
    advanceWorkingTime: advanceWorkingTime,
    snapToWorkStart: snapToWorkStart,
    formatReady: formatReady,
    zonedParts: zonedParts,
    parseHM: parseHM,
  };
});
