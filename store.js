/* ------------------------------------------------------------------
   H Properties — post store (pluggable data layer)

   Two modes, chosen automatically from config.js:
   - LOCAL (default): posts in this browser's localStorage.
   - SUPABASE (when HP_BACKEND.url + anonKey are set): posts + images shared
     with ALL visitors, secure admin login via Supabase Auth.

   Unified API used by script.js / admin.js:
     HPStore.mode                      -> "local" | "supabase"
     HPStore.needsAuth                 -> true for supabase (email+password login)
     HPStore.getPosts()                -> Promise<[post]>
     HPStore.addPost(fields)           -> Promise<post>        (admin)
     HPStore.updatePost(id, fields)    -> Promise<post>        (admin)
     HPStore.deletePost(id)            -> Promise<bool>        (admin)
     HPStore.uploadImage(file)         -> Promise<url|dataURL> (admin)
     HPStore.login(email, password)    -> Promise (supabase)   / password check (local handled in admin.js)
     HPStore.logout()
     HPStore.isLoggedIn()              -> bool
   Post shape: { id, createdAt, updatedAt, title, body, images:[url,...], link }
------------------------------------------------------------------- */
window.HPStore = (function () {
  var cfg = window.HP_BACKEND || {};
  var isSupabase = !!(cfg.url && cfg.anonKey);
  var BUCKET = "post-images";

  /* ---------------- shared helpers ---------------- */
  function normalize(p) {
    if (!p.images || !Array.isArray(p.images)) p.images = p.image ? [p.image] : [];
    return p;
  }

  /* ================= LOCAL adapter ================= */
  var LKEY = "hp_posts_v1";
  function readLocal() { try { return JSON.parse(localStorage.getItem(LKEY)) || []; } catch (e) { return []; } }
  function writeLocal(l) { localStorage.setItem(LKEY, JSON.stringify(l)); }

  var local = {
    getPosts: function () {
      return Promise.resolve(readLocal().map(normalize).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }));
    },
    addPost: function (f) {
      var l = readLocal();
      f.id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      f.createdAt = Date.now(); f.updatedAt = f.createdAt; normalize(f);
      l.push(f); writeLocal(l); return Promise.resolve(f);
    },
    updatePost: function (id, f) {
      var l = readLocal();
      for (var i = 0; i < l.length; i++) if (l[i].id === id) {
        if (f.title !== undefined) l[i].title = f.title;
        if (f.body !== undefined) l[i].body = f.body;
        if (f.images !== undefined) l[i].images = f.images;
        if (f.link !== undefined) l[i].link = f.link;
        l[i].updatedAt = Date.now(); normalize(l[i]); writeLocal(l); return Promise.resolve(l[i]);
      }
      return Promise.reject(new Error("not found"));
    },
    deletePost: function (id) { writeLocal(readLocal().filter(function (p) { return p.id !== id; })); return Promise.resolve(true); },
    uploadImage: function (file) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function (e) { resolve(e.target.result); };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    },
    login: function () { return Promise.reject(new Error("local mode uses a static password")); },
    logout: function () {},
    isLoggedIn: function () { return true; }
  };

  /* ================= SUPABASE adapter ================= */
  var SESSION_KEY = "hp_sb_session";
  function getSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s && s.access_token && s.expires_at && s.expires_at > Date.now()) return s;
    } catch (e) {}
    return null;
  }
  function authToken() { var s = getSession(); return s ? s.access_token : cfg.anonKey; }

  function rest(path, opts) {
    opts = opts || {};
    var headers = Object.assign({
      apikey: cfg.anonKey,
      Authorization: "Bearer " + (opts.useUser ? authToken() : cfg.anonKey)
    }, opts.headers || {});
    return fetch(cfg.url + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error("Supabase " + res.status + ": " + t); });
        return opts.raw ? res : (res.status === 204 ? null : res.json());
      });
  }

  function mapRow(row) {
    return {
      id: row.id,
      createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
      title: row.title || "",
      body: row.body || "",
      images: Array.isArray(row.images) ? row.images : [],
      link: row.link || ""
    };
  }

  var supa = {
    getPosts: function () {
      return rest("/rest/v1/posts?select=*&order=created_at.desc").then(function (rows) {
        return (rows || []).map(mapRow);
      });
    },
    addPost: function (f) {
      return rest("/rest/v1/posts", {
        method: "POST", useUser: true,
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ title: f.title, body: f.body, link: f.link || "", images: f.images || [] })
      }).then(function (rows) { return mapRow(rows[0]); });
    },
    updatePost: function (id, f) {
      var patch = {};
      if (f.title !== undefined) patch.title = f.title;
      if (f.body !== undefined) patch.body = f.body;
      if (f.link !== undefined) patch.link = f.link;
      if (f.images !== undefined) patch.images = f.images;
      patch.updated_at = new Date().toISOString();
      return rest("/rest/v1/posts?id=eq." + encodeURIComponent(id), {
        method: "PATCH", useUser: true,
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch)
      }).then(function (rows) { return mapRow(rows[0]); });
    },
    deletePost: function (id) {
      return rest("/rest/v1/posts?id=eq." + encodeURIComponent(id), { method: "DELETE", useUser: true, raw: true })
        .then(function () { return true; });
    },
    uploadImage: function (file) {
      var ext = (file.name && file.name.indexOf(".") >= 0) ? file.name.split(".").pop() : "jpg";
      var path = Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
      return fetch(cfg.url + "/storage/v1/object/" + BUCKET + "/" + path, {
        method: "POST",
        headers: { apikey: cfg.anonKey, Authorization: "Bearer " + authToken(), "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: file
      }).then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error("Upload " + res.status + ": " + t); });
        return cfg.url + "/storage/v1/object/public/" + BUCKET + "/" + path;
      });
    },
    login: function (email, password) {
      return fetch(cfg.url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
          localStorage.setItem(SESSION_KEY, JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000
          }));
          return data;
        });
      });
    },
    logout: function () { localStorage.removeItem(SESSION_KEY); },
    isLoggedIn: function () { return !!getSession(); }
  };

  var adapter = isSupabase ? supa : local;

  return {
    mode: isSupabase ? "supabase" : "local",
    needsAuth: isSupabase,
    getPosts: function () { return adapter.getPosts(); },
    addPost: function (f) { return adapter.addPost(f); },
    updatePost: function (id, f) { return adapter.updatePost(id, f); },
    deletePost: function (id) { return adapter.deletePost(id); },
    uploadImage: function (file) { return adapter.uploadImage(file); },
    login: function (e, p) { return adapter.login(e, p); },
    logout: function () { return adapter.logout(); },
    isLoggedIn: function () { return adapter.isLoggedIn(); }
  };
})();
