(function () {
  "use strict";

  /* ===== CHANGE THIS PASSWORD ===== */
  var ADMIN_PASSWORD = "hproperties@2024";
  /* ================================= */

  var SESSION_KEY = "hp_admin_ok";

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
  function showLogin() {
    dashView.hidden = true;
    loginView.hidden = false;
  }

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
  var postImageFile = document.getElementById("postImageFile");
  var postImageUrl = document.getElementById("postImageUrl");
  var imgPreviewWrap = document.getElementById("imgPreviewWrap");
  var imgPreview = document.getElementById("imgPreview");
  var publishBtn = document.getElementById("publishBtn");
  var okMsg = document.getElementById("okMsg");

  var pendingImageData = "";

  postImageFile.addEventListener("change", function () {
    var file = postImageFile.files[0];
    if (!file) { pendingImageData = ""; updatePreview(); return; }
    if (file.size > 1.6 * 1024 * 1024) {
      alert("ছবিটি বড় (১.৫MB এর বেশি)। ছোট ছবি ব্যবহার করুন অথবা ছবির লিংক দিন।");
      postImageFile.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) { pendingImageData = e.target.result; updatePreview(); };
    reader.readAsDataURL(file);
  });
  postImageUrl.addEventListener("input", updatePreview);

  function currentImage() {
    return pendingImageData || (postImageUrl.value.trim());
  }
  function updatePreview() {
    var src = currentImage();
    if (src) { imgPreview.src = src; imgPreviewWrap.hidden = false; }
    else { imgPreviewWrap.hidden = true; }
  }

  publishBtn.addEventListener("click", function () {
    var title = postTitle.value.trim();
    var body = postBody.value.trim();
    if (!title || !body) {
      alert("শিরোনাম ও বিবরণ দিন / Please enter title and description");
      return;
    }
    var post = { title: title, body: body, image: currentImage() };
    window.HPStore.addPost(post).then(function () {
      postTitle.value = "";
      postBody.value = "";
      postImageFile.value = "";
      postImageUrl.value = "";
      pendingImageData = "";
      updatePreview();
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
        var row = document.createElement("div");
        row.className = "admin-post";
        var thumb = p.image
          ? '<div class="admin-post__thumb" style="background-image:url(' + JSON.stringify(p.image) + ')"></div>'
          : '<div class="admin-post__thumb"></div>';
        row.innerHTML = thumb +
          '<div class="admin-post__meta">' +
            '<span class="d">' + esc(fmtDate(p.createdAt)) + "</span>" +
            "<h4>" + esc(p.title) + "</h4>" +
            "<p>" + esc(p.body) + "</p>" +
          "</div>";
        var del = document.createElement("button");
        del.className = "btn btn--danger";
        del.textContent = "মুছুন";
        del.addEventListener("click", function () {
          if (confirm("এই পোস্টটি মুছে ফেলবেন? / Delete this post?")) {
            window.HPStore.deletePost(p.id).then(renderAdminPosts);
          }
        });
        row.appendChild(del);
        adminPosts.appendChild(row);
      });
    });
  }
})();
