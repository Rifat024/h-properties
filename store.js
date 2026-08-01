/* ------------------------------------------------------------------
   H Properties — post store (pluggable data layer)
   Default: browser localStorage (posts persist on THIS device/browser).
   To make posts show for ALL visitors, set window.HP_BACKEND before this
   script loads (e.g. a Supabase adapter) — the app calls the same API.
------------------------------------------------------------------- */
window.HPStore = (function () {
  var KEY = "hp_posts_v1";
  var backend = window.HP_BACKEND || { type: "local" };

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function writeLocal(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function sortDesc(list) {
    return list.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  // ---- localStorage adapter ----
  var local = {
    getPosts: function () { return Promise.resolve(sortDesc(readLocal())); },
    addPost: function (post) {
      var list = readLocal();
      post.id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      post.createdAt = Date.now();
      list.push(post);
      writeLocal(list);
      return Promise.resolve(post);
    },
    deletePost: function (id) {
      writeLocal(readLocal().filter(function (p) { return p.id !== id; }));
      return Promise.resolve(true);
    }
  };

  var adapter = local; // future: if backend.type === 'supabase' -> supabase adapter

  return {
    mode: backend.type,
    getPosts: function () { return adapter.getPosts(); },
    addPost: function (post) { return adapter.addPost(post); },
    deletePost: function (id) { return adapter.deletePost(id); }
  };
})();
