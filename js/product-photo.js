(function (root) {
  "use strict";
  var types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  function validate(file) {
    if (!file || !types[file.type]) throw new Error("Choose a JPG, PNG, or WebP photo.");
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose a photo under 5 MB.");
    return types[file.type];
  }
  var api = { validate: validate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (root.SAMALBAKES = root.SAMALBAKES || {}).productPhoto = api;
})(typeof window !== "undefined" ? window : this);
