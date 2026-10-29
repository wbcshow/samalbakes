/**
 * Public Supabase project URL and anon key (safe to ship in the browser).
 * Replace both with YOUR_… placeholders to fall back to demo mode (localStorage).
 *
 * Setup: see README.md → “Go live with Supabase”
 */
window.SAMALBAKES = window.SAMALBAKES || {};
window.SAMALBAKES.supabaseConfig = {
  url: "https://khfxmgwyqldvzutsnnhb.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZnhtZ3d5cWxkdnp1dHNubmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNzg0ODMsImV4cCI6MjEwODg1NDQ4M30.diH1eHxDwuCwK5sGdVd21zG0AaeEifgODW5g3Tbqdvw",
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
