/**
 * Paste your Supabase project URL and anon (public) key here.
 * Leave as YOUR_… placeholders to run DEMO MODE (localStorage) from the zip.
 *
 * Setup: see README.md → “Go live with Supabase”
 */
window.SAMALBAKES = window.SAMALBAKES || {};
window.SAMALBAKES.supabaseConfig = {
  url: "YOUR_SUPABASE_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};

window.SAMALBAKES.isDemoMode = function () {
  var c = window.SAMALBAKES.supabaseConfig || {};
  return (
    !c.url ||
    !c.anonKey ||
    String(c.url).indexOf("YOUR_") === 0 ||
    String(c.anonKey).indexOf("YOUR_") === 0
  );
};
