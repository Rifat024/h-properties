/* ------------------------------------------------------------------
   H Properties — post store (pluggable data layer)
   Default: browser localStorage (posts persist on THIS device/browser).
   To make posts show for ALL visitors, set window.HP_BACKEND before this
   script loads (e.g. a Supabase adapter) — the app calls the same API.

   Post shape: { id, createdAt, updatedAt, title, body, images:[dataURL|url,...] }
   (legacy single `image` string is auto-migrated into `images`)
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
  function normalize(p) {
    if (!p.images || !Array.isArray(p.images)) {
      p.images = p.image ? [p.image] : [];
    }
    return p;
  }
  function sortDesc(list) {
    return list.map(normalize).sort(function (a, b) {
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
      post.updatedAt = post.createdAt;
      normalize(post);
      list.push(post);
      writeLocal(list);
      return Promise.resolve(post);
    },
    updatePost: function (id, fields) {
      var list = readLocal();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          if (fields.title !== undefined) list[i].title = fields.title;
          if (fields.body !== undefined) list[i].body = fields.body;
          if (fields.images !== undefined) list[i].images = fields.images;
          if (fields.link !== undefined) list[i].link = fields.link;
          list[i].updatedAt = Date.now();
          normalize(list[i]);
          writeLocal(list);
          return Promise.resolve(list[i]);
        }
      }
      return Promise.reject(new Error("post not found"));
    },
    getPost: function (id) {
      var found = readLocal().filter(function (p) { return p.id === id; })[0];
      return Promise.resolve(found ? normalize(found) : null);
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
    getPost: function (id) { return adapter.getPost(id); },
    addPost: function (post) { return adapter.addPost(post); },
    updatePost: function (id, fields) { return adapter.updatePost(id, fields); },
    deletePost: function (id) { return adapter.deletePost(id); }
  };
})();
