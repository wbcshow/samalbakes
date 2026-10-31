(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else (root.SAMALBAKES = root.SAMALBAKES || {}).bakerySettings = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function validateHours(hours) {
    var time = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!hours || typeof hours !== "object" || Array.isArray(hours) || Object.keys(hours).length !== 7) {
      throw new Error("Set baking hours for all seven days.");
    }
    var openDays = 0;
    days.forEach(function (day, i) {
      var h = hours[i];
      if (h === null) return;
      if (!h || !time.test(h.open) || !time.test(h.close) || h.open >= h.close) {
        throw new Error(day + ": choose a finish time later than the start time. Use one daytime period per day.");
      }
      openDays++;
    });
    if (!openDays) throw new Error("Choose at least one baking day so orders can have a ready-time estimate.");
    return hours;
  }
  function selectFeatured(products, ids) {
    var eligible = products.filter(function (p) { return p.active !== false && (p.image || p.image_url); });
    var picks = [];
    (ids || []).forEach(function (id) {
      var p = eligible.find(function (item) { return item.id === id; });
      if (p && picks.indexOf(p) < 0) picks.push(p);
    });
    eligible.forEach(function (p) { if (picks.length < 3 && picks.indexOf(p) < 0) picks.push(p); });
    return picks.slice(0, 3);
  }
  function validateFeatured(ids, products) {
    if (ids.length !== 3 || ids.some(function (id) { return !id; }) || new Set(ids).size !== 3) {
      throw new Error("Choose three different home-page products.");
    }
    ids.forEach(function (id) {
      if (!products.some(function (p) { return p.id === id && p.active !== false && (p.image || p.image_url); })) {
        throw new Error("Home-page products must be active and have a photo. Update the product first.");
      }
    });
    return ids;
  }
  return { days: days, validateHours: validateHours, selectFeatured: selectFeatured, validateFeatured: validateFeatured };
});
