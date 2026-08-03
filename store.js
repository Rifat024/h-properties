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

  /* ---- LOCAL finance (localStorage) — for offline/testing ---- */
  var localFin = (function () {
    var PK = "hp_fin_projects", CK = "hp_fin_categories", TK = "hp_fin_transactions";
    function rd(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
    function wr(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
    function nid(p) { return (p || "f_") + Date.now() + "_" + Math.random().toString(36).slice(2, 7); }
    function seed() {
      if (rd(CK).length) return;
      var cats = [];
      function top(name, kind) { var c = { id: nid("c_"), name: name, parent_id: null, kind: kind }; cats.push(c); return c; }
      function sub(name, parent) { cats.push({ id: nid("c_"), name: name, parent_id: parent.id, kind: parent.kind }); }
      var core = top("Core materials", "cost"), lab = top("Labour & finishing", "cost"),
          util = top("Utilities & services", "cost"), oth = top("Other/misc", "cost");
      ["সিমেন্ট (Cement)", "রড / স্টিল (Rod/Steel)", "বালি (Sand)", "ইট (Brick)", "পাথর / খোয়া (Stone chips)"].forEach(function (n) { sub(n, core); });
      ["মজুরি (Labour)", "টাইলস (Tiles)", "রং (Paint)", "থাই-অ্যালুমিনিয়াম (Thai-aluminium)", "কাঠ (Wood)"].forEach(function (n) { sub(n, lab); });
      ["ইলেকট্রিক (Electrical)", "স্যানিটারি (Sanitary)", "গ্রীল (Grille)", "পাইলিং (Piling)"].forEach(function (n) { sub(n, util); });
      ["পরিবহন (Transport)", "অনুমোদন / ফি (Approval/Fee)", "বিবিধ (Misc)"].forEach(function (n) { sub(n, oth); });
      ["বুকিং / অগ্রিম (Booking/Advance)", "কিস্তি (Installment)", "ফ্ল্যাট / জমি বিক্রয় (Flat/Land sale)", "অন্যান্য আয় (Other income)"]
        .forEach(function (n) { cats.push({ id: nid("c_"), name: n, parent_id: null, kind: "income" }); });
      wr(CK, cats);
    }
    seed();
    return {
      projects: {
        list: function () { return Promise.resolve(rd(PK)); },
        add: function (f) { var l = rd(PK); f.id = nid("pr_"); f.created_at = Date.now(); l.push(f); wr(PK, l); return Promise.resolve(f); },
        update: function (i, f) { var l = rd(PK); l.forEach(function (p) { if (p.id === i) Object.assign(p, f); }); wr(PK, l); return Promise.resolve(); },
        remove: function (i) { wr(PK, rd(PK).filter(function (p) { return p.id !== i; })); return Promise.resolve(); }
      },
      categories: {
        list: function () { return Promise.resolve(rd(CK)); },
        add: function (f) { var l = rd(CK); f.id = nid("c_"); f.parent_id = f.parent_id || null; f.kind = f.kind || "cost"; l.push(f); wr(CK, l); return Promise.resolve(f); },
        remove: function (i) { wr(CK, rd(CK).filter(function (c) { return c.id !== i && c.parent_id !== i; })); return Promise.resolve(); }
      },
      transactions: {
        list: function () { return Promise.resolve(rd(TK)); },
        add: function (f) { var l = rd(TK); f.id = nid("t_"); f.created_at = Date.now(); l.push(f); wr(TK, l); return Promise.resolve(f); },
        update: function (i, f) { var l = rd(TK); l.forEach(function (t) { if (t.id === i) Object.assign(t, f); }); wr(TK, l); return Promise.resolve(); },
        remove: function (i) { wr(TK, rd(TK).filter(function (t) { return t.id !== i; })); return Promise.resolve(); }
      },
      uploadReceipt: function (file) { return local.uploadImage(file); },
      signedUrl: function (path) { return Promise.resolve(path || ""); },
      extractCost: function () { return Promise.reject(new Error("AI extraction runs on the deployed site (Vercel).")); }
    };
  })();

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

  /* ---- SUPABASE finance (private, authenticated) ---- */
  function jsonHeaders(extra) { return Object.assign({ "Content-Type": "application/json" }, extra || {}); }
  var supaFin = {
    projects: {
      list: function () { return rest("/rest/v1/fin_projects?select=*&order=created_at.desc", { useUser: true }); },
      add: function (f) {
        return rest("/rest/v1/fin_projects", { method: "POST", useUser: true, headers: jsonHeaders({ Prefer: "return=representation" }), body: JSON.stringify(f) }).then(function (r) { return r[0]; });
      },
      update: function (i, f) { return rest("/rest/v1/fin_projects?id=eq." + encodeURIComponent(i), { method: "PATCH", useUser: true, headers: jsonHeaders(), body: JSON.stringify(f), raw: true }); },
      remove: function (i) { return rest("/rest/v1/fin_projects?id=eq." + encodeURIComponent(i), { method: "DELETE", useUser: true, raw: true }); }
    },
    categories: {
      list: function () { return rest("/rest/v1/fin_categories?select=*&order=name.asc", { useUser: true }); },
      add: function (f) {
        return rest("/rest/v1/fin_categories", { method: "POST", useUser: true, headers: jsonHeaders({ Prefer: "return=representation" }), body: JSON.stringify({ name: f.name, parent_id: f.parent_id || null, kind: f.kind || "cost" }) }).then(function (r) { return r[0]; });
      },
      remove: function (i) { return rest("/rest/v1/fin_categories?id=eq." + encodeURIComponent(i), { method: "DELETE", useUser: true, raw: true }); }
    },
    transactions: {
      list: function () { return rest("/rest/v1/fin_transactions?select=*&order=txn_date.desc,created_at.desc", { useUser: true }); },
      add: function (f) {
        return rest("/rest/v1/fin_transactions", { method: "POST", useUser: true, headers: jsonHeaders({ Prefer: "return=representation" }), body: JSON.stringify(f) }).then(function (r) { return r[0]; });
      },
      update: function (i, f) { return rest("/rest/v1/fin_transactions?id=eq." + encodeURIComponent(i), { method: "PATCH", useUser: true, headers: jsonHeaders(), body: JSON.stringify(f), raw: true }); },
      remove: function (i) { return rest("/rest/v1/fin_transactions?id=eq." + encodeURIComponent(i), { method: "DELETE", useUser: true, raw: true }); }
    },
    uploadReceipt: function (file) {
      var ext = (file.name && file.name.indexOf(".") >= 0) ? file.name.split(".").pop() : "jpg";
      var path = Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
      return fetch(cfg.url + "/storage/v1/object/cost-photos/" + path, {
        method: "POST",
        headers: { apikey: cfg.anonKey, Authorization: "Bearer " + authToken(), "Content-Type": file.type || "application/octet-stream" },
        body: file
      }).then(function (res) { if (!res.ok) return res.text().then(function (t) { throw new Error("Upload " + res.status + ": " + t); }); return path; });
    },
    signedUrl: function (path) {
      if (!path) return Promise.resolve("");
      return fetch(cfg.url + "/storage/v1/object/sign/cost-photos/" + path, {
        method: "POST",
        headers: { apikey: cfg.anonKey, Authorization: "Bearer " + authToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 3600 })
      }).then(function (res) { return res.json(); }).then(function (d) { return cfg.url + (d.signedURL || d.signedUrl || ""); });
    },
    extractCost: function (file) {
      return local.uploadImage(file).then(function (dataUrl) {
        return fetch("/api/extract-cost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) })
          .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error || ("HTTP " + res.status)); return d; }); });
      });
    }
  };

  var adapter = isSupabase ? supa : local;
  var finApi = isSupabase ? supaFin : localFin;

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
    isLoggedIn: function () { return adapter.isLoggedIn(); },
    fin: finApi
  };
})();
