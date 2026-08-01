(function () {
  "use strict";

  /* ===== CHANGE THIS PASSWORD ===== */
  var ADMIN_PASSWORD = "hproperties@2024";
  /* ================================= */

  var SESSION_KEY = "hp_admin_ok";

  /* ---------- Theme toggle ---------- */
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("hp_theme", next); } catch (e) {}
    });
  }

  /* ---------- Login ---------- */
  var loginView = document.getElementById("loginView");
  var dashView = document.getElementById("dashView");
  var pw = document.getElementById("pw");
  var loginBtn = document.getElementById("loginBtn");
  var loginErr = document.getElementById("loginErr");
  var logoutBtn = document.getElementById("logoutBtn");

  function showDash() {
    loginView.hidden = true;
    dashView.hidden = false;
    var badge = document.getElementById("modeBadge");
    var warn = document.getElementById("storageWarn");
    if (window.HPStore && window.HPStore.mode !== "local") {
      badge.textContent = "লাইভ ব্যাকএন্ড";
      warn.style.display = "none";
    } else {
      warn.classList.add("show");
    }
    renderAdminPosts();
  }
  function showLogin() { dashView.hidden = true; loginView.hidden = false; }

  if (sessionStorage.getItem(SESSION_KEY) === "1") showDash();

  function tryLogin() {
    if (pw.value === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      loginErr.classList.remove("show");
      showDash();
    } else {
      loginErr.classList.add("show");
      pw.value = "";
    }
  }
  loginBtn.addEventListener("click", tryLogin);
  pw.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ---------- Post form ---------- */
  var postTitle = document.getElementById("postTitle");
  var postBody = document.getElementById("postBody");
  var postLink = document.getElementById("postLink");
  var postImageFile = document.getElementById("postImageFile");
  var postImageUrl = document.getElementById("postImageUrl");
  var addUrlBtn = document.getElementById("addUrlBtn");
  var imgChips = document.getElementById("imgChips");
  var publishBtn = document.getElementById("publishBtn");
  var cancelEditBtn = document.getElementById("cancelEditBtn");
  var okMsg = document.getElementById("okMsg");
  var formTitle = document.getElementById("formTitle");
  var editingBanner = document.getElementById("editingBanner");

  var pendingImages = [];   // array of dataURL / url strings
  var editingId = null;

  function renderChips() {
    imgChips.innerHTML = "";
    pendingImages.forEach(function (src, i) {
      var chip = document.createElement("div");
      chip.className = "img-chip";
      chip.style.backgroundImage = "url(" + JSON.stringify(src) + ")";
      chip.innerHTML =
        '<button class="img-chip__del" title="সরান" data-i="' + i + '">×</button>' +
        (i === 0 ? '<span class="img-chip__badge">কভার</span>' : "");
      chip.querySelector(".img-chip__del").addEventListener("click", function () {
        pendingImages.splice(i, 1);
        renderChips();
      });
      imgChips.appendChild(chip);
    });
  }

  postImageFile.addEventListener("change", function () {
    var files = Array.prototype.slice.call(postImageFile.files || []);
    var tooBig = false;
    var readers = files.map(function (file) {
      return new Promise(function (resolve) {
        if (file.size > 1.6 * 1024 * 1024) { tooBig = true; return resolve(null); }
        var reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers).then(function (results) {
      results.forEach(function (r) { if (r) pendingImages.push(r); });
      postImageFile.value = "";
      renderChips();
      if (tooBig) alert("কিছু ছবি ১.৫MB এর চেয়ে বড় ছিল এবং বাদ দেওয়া হয়েছে। ছোট ছবি বা ছবির লিংক ব্যবহার করুন।");
    });
  });

  function addUrl() {
    var u = postImageUrl.value.trim();
    if (!u) return;
    pendingImages.push(u);
    postImageUrl.value = "";
    renderChips();
  }
  addUrlBtn.addEventListener("click", addUrl);
  postImageUrl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addUrl(); } });

  function resetForm() {
    editingId = null;
    postTitle.value = "";
    postBody.value = "";
    postLink.value = "";
    postImageUrl.value = "";
    postImageFile.value = "";
    pendingImages = [];
    renderChips();
    formTitle.textContent = "➕ নতুন পোস্ট / New Post";
    publishBtn.textContent = "প্রকাশ করুন / Publish";
    editingBanner.classList.remove("show");
    cancelEditBtn.hidden = true;
  }
  cancelEditBtn.addEventListener("click", resetForm);

  function startEdit(post) {
    editingId = post.id;
    postTitle.value = post.title || "";
    postBody.value = post.body || "";
    postLink.value = post.link || "";
    pendingImages = (post.images || []).slice();
    renderChips();
    formTitle.textContent = "✏️ পোস্ট আপডেট / Edit Post";
    publishBtn.textContent = "আপডেট করুন / Update";
    editingBanner.classList.add("show");
    cancelEditBtn.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  publishBtn.addEventListener("click", function () {
    var title = postTitle.value.trim();
    var body = postBody.value.trim();
    if (!title || !body) {
      alert("শিরোনাম ও বিবরণ দিন / Please enter title and description");
      return;
    }
    var fields = {
      title: title,
      body: body,
      images: pendingImages.slice(),
      link: postLink.value.trim()
    };
    var op = editingId
      ? window.HPStore.updatePost(editingId, fields)
      : window.HPStore.addPost(fields);
    op.then(function () {
      resetForm();
      okMsg.classList.add("show");
      setTimeout(function () { okMsg.classList.remove("show"); }, 2500);
      renderAdminPosts();
    });
  });

  /* ---------- Post list ---------- */
  var adminPosts = document.getElementById("adminPosts");
  var adminEmpty = document.getElementById("adminEmpty");
  var postCount = document.getElementById("postCount");

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return ""; }
  }

  function renderAdminPosts() {
    window.HPStore.getPosts().then(function (posts) {
      postCount.textContent = posts.length;
      adminPosts.innerHTML = "";
      adminEmpty.style.display = posts.length ? "none" : "block";
      posts.forEach(function (p) {
        var imgs = p.images || [];
        var row = document.createElement("div");
        row.className = "admin-post";

        var thumbWrap = '<div class="admin-post__thumb-wrap">' +
          '<div class="admin-post__thumb"' + (imgs[0] ? ' style="background-image:url(' + JSON.stringify(imgs[0]) + ')"' : "") + "></div>" +
          (imgs.length > 1 ? '<span class="admin-post__count">' + imgs.length + ' ছবি</span>' : "") +
          "</div>";

        var linkLine = p.link ? '<span class="d">🔗 লিংক আছে</span>' : "";

        row.innerHTML = thumbWrap +
          '<div class="admin-post__meta">' +
            '<span class="d">' + esc(fmtDate(p.createdAt)) + "</span> " + linkLine +
            "<h4>" + esc(p.title) + "</h4>" +
            "<p>" + esc(p.body) + "</p>" +
          "</div>";

        var actions = document.createElement("div");
        actions.className = "admin-post__actions";
        var editBtn = document.createElement("button");
        editBtn.className = "btn btn--edit";
        editBtn.textContent = "✏️ এডিট";
        editBtn.addEventListener("click", function () { startEdit(p); });
        var del = document.createElement("button");
        del.className = "btn btn--danger";
        del.textContent = "মুছুন";
        del.addEventListener("click", function () {
          if (confirm("এই পোস্টটি মুছে ফেলবেন? / Delete this post?")) {
            window.HPStore.deletePost(p.id).then(function () {
              if (editingId === p.id) resetForm();
              renderAdminPosts();
            });
          }
        });
        actions.appendChild(editBtn);
        actions.appendChild(del);
        row.appendChild(actions);
        adminPosts.appendChild(row);
      });
    });
  }
})();
