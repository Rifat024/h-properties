(function () {
  "use strict";

  /* ---------- Language toggle ---------- */
  var savedLang = localStorage.getItem("hp_lang") || "bn";
  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-bn]").forEach(function (el) {
      var val = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-bn");
      if (val !== null) el.textContent = val;
    });
    document.querySelectorAll(".lang__opt").forEach(function (o) {
      o.classList.toggle("is-active", o.getAttribute("data-lang") === lang);
    });
    localStorage.setItem("hp_lang", lang);
    window.HP_LANG = lang;
    renderPosts(); // re-render dynamic content in chosen language labels
  }
  var langToggle = document.getElementById("langToggle");
  if (langToggle) {
    langToggle.addEventListener("click", function () {
      applyLang((localStorage.getItem("hp_lang") || "bn") === "bn" ? "en" : "bn");
    });
  }

  /* ---------- Theme toggle (light/dark) ---------- */
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("hp_theme", next); } catch (e) {}
    });
  }

  /* ---------- Mobile nav ---------- */
  var hamburger = document.getElementById("hamburger");
  var navLinks = document.getElementById("navLinks");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      hamburger.classList.toggle("open");
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        hamburger.classList.remove("open");
        navLinks.classList.remove("open");
      });
    });
  }

  /* ---------- Nav shadow on scroll ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Scroll reveal (IO + reliable scroll fallback) ---------- */
  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
  }
  function revealInView() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add("in");
    });
  }
  function observeReveals() {
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
      var grid = el.parentElement && el.parentElement.classList.contains("grid");
      if (grid) el.style.setProperty("--i", Array.prototype.indexOf.call(el.parentElement.children, el));
      if (io) io.observe(el);
    });
    revealInView();
  }
  // Reliable fallback: reveal on scroll/resize even if IO doesn't fire.
  var ticking = false;
  function onScrollReveal() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { revealInView(); ticking = false; });
  }
  window.addEventListener("scroll", onScrollReveal, { passive: true });
  window.addEventListener("resize", onScrollReveal, { passive: true });
  window.addEventListener("load", revealInView);
  // Absolute safety net: never leave content invisible if IO/scroll never fire.
  setTimeout(function () {
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { el.classList.add("in"); });
  }, 3000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") revealInView();
  });

  /* ---------- Render posts (from admin) ---------- */
  var postsGrid = document.getElementById("postsGrid");
  var postsEmpty = document.getElementById("postsEmpty");
  function fmtDate(ts) {
    try {
      var lang = window.HP_LANG || localStorage.getItem("hp_lang") || "bn";
      return new Date(ts).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB",
        { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function mediaMarkup(images) {
    if (!images || !images.length) return '<div class="post__img"></div>';
    if (images.length === 1) {
      return '<div class="post__img" style="background-image:url(' + JSON.stringify(images[0]) + ')"></div>';
    }
    var slides = images.map(function (src) {
      return '<div class="slider__slide" style="background-image:url(' + JSON.stringify(src) + ')"></div>';
    }).join("");
    var dots = images.map(function (_, i) {
      return '<button class="slider__dot' + (i === 0 ? " active" : "") + '" data-i="' + i + '" aria-label="slide ' + (i + 1) + '"></button>';
    }).join("");
    return '<div class="post__img slider">' +
      '<div class="slider__track">' + slides + "</div>" +
      '<button class="slider__btn slider__btn--prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="slider__btn slider__btn--next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="slider__dots">' + dots + "</div>" +
    "</div>";
  }

  function initSlider(slider) {
    var track = slider.querySelector(".slider__track");
    var slides = slider.querySelectorAll(".slider__slide");
    var dots = slider.querySelectorAll(".slider__dot");
    var idx = 0, timer = null;
    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = "translateX(-" + (idx * 100) + "%)";
      dots.forEach(function (d, di) { d.classList.toggle("active", di === idx); });
    }
    function auto() { timer = setInterval(function () { go(idx + 1); }, 4000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    slider.querySelector(".slider__btn--prev").addEventListener("click", function () { go(idx - 1); stop(); auto(); });
    slider.querySelector(".slider__btn--next").addEventListener("click", function () { go(idx + 1); stop(); auto(); });
    dots.forEach(function (d) {
      d.addEventListener("click", function () { go(parseInt(d.getAttribute("data-i"), 10)); stop(); auto(); });
    });
    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", auto);
    auto();
  }

  function renderPosts() {
    if (!postsGrid || !window.HPStore) return;
    window.HPStore.getPosts().then(function (posts) {
      postsGrid.innerHTML = "";
      if (!posts.length) {
        if (postsEmpty) postsEmpty.hidden = false;
        return;
      }
      if (postsEmpty) postsEmpty.hidden = true;
      var lang = window.HP_LANG || localStorage.getItem("hp_lang") || "bn";
      var moreLabel = lang === "en" ? "View details ↗" : "বিস্তারিত দেখুন ↗";
      posts.forEach(function (p) {
        var card = document.createElement("article");
        card.className = "post reveal";
        var linkHtml = p.link
          ? '<a class="post__link" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + moreLabel + "</a>"
          : "";
        card.innerHTML = mediaMarkup(p.images) +
          '<div class="post__body">' +
            '<span class="post__date">' + esc(fmtDate(p.createdAt)) + "</span>" +
            "<h3>" + esc(p.title) + "</h3>" +
            "<p>" + esc(p.body) + "</p>" +
            linkHtml +
          "</div>";
        postsGrid.appendChild(card);
      });
      postsGrid.querySelectorAll(".slider").forEach(initSlider);
      observeReveals();
    });
  }
  window.__renderPosts = renderPosts;

  /* ---------- Init ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Contact form -> opens SMS/WhatsApp prefilled ---------- */
  var form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var msg = "নাম/Name: " + (d.get("name") || "") +
        "\nফোন/Phone: " + (d.get("phone") || "") +
        "\n" + (d.get("message") || "");
      window.open("https://wa.me/8801711461918?text=" + encodeURIComponent(msg), "_blank");
      form.reset();
      var note = document.getElementById("formNote");
      if (note) {
        note.textContent = (window.HP_LANG === "en")
          ? "Thanks! Opening WhatsApp to send your message…"
          : "ধন্যবাদ! আপনার বার্তা পাঠাতে হোয়াটসঅ্যাপ খুলছে…";
      }
    });
  }

  applyLang(savedLang);
  observeReveals();
  renderPosts();
})();
