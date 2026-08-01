/* ------------------------------------------------------------------
   H Properties — backend config
   ------------------------------------------------------------------
   Leave both blank  -> posts save in the visitor's own browser (local mode).
   Fill both in      -> posts + images are shared with ALL visitors (Supabase).

   How to get these (free):
   1. supabase.com -> New Project
   2. Project Settings -> API
   3. Copy "Project URL" and the "anon public" key below.
   The anon key is safe to expose in the browser.
------------------------------------------------------------------- */
window.HP_BACKEND = {
  url: "https://vfzlnizdxmxnfeeragps.supabase.co",
  anonKey: "sb_publishable_1cMl43iG-jOMuDsu_TurJw_4aUEIqNt"
};
