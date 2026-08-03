(function () {
  "use strict";

  /* ===== Local-mode password (Supabase mode uses email+password) ===== */
  var ADMIN_PASSWORD = "hproperties@2024";
  var SESSION_KEY = "hp_admin_ok";

  var $ = function (id) { return document.getElementById(id); };
  var fin = window.HPStore.fin;
  var supaMode = window.HPStore.needsAuth;

  function taka(n) {
    n = Number(n) || 0;
    return "৳" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  /* ---------- Theme ---------- */
  $("themeToggle").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("hp_theme", next); } catch (e) {}
    renderDashboard(); // recolor charts
  });

  /* ---------- Login ---------- */
  var loginView = $("loginView"), dashView = $("dashView");
  if (supaMode) { $("emailField").hidden = false; $("loginHint").textContent = "লাইভ ব্যাকএন্ড (Supabase) — ইমেইল ও পাসওয়ার্ড দিন।"; }

  function loggedIn() { return supaMode ? window.HPStore.isLoggedIn() : sessionStorage.getItem(SESSION_KEY) === "1"; }
  function showDash() {
    loginView.hidden = true; dashView.hidden = false;
    if (window.HPStore.mode !== "local") { $("modeBadge").textContent = "🌐 লাইভ"; $("storageWarn").style.display = "none"; }
    else { $("storageWarn").classList.add("show"); }
    boot();
  }
  if (loggedIn()) showDash();

  $("loginBtn").addEventListener("click", function () {
    $("loginErr").classList.remove("show");
    if (supaMode) {
      var b = $("loginBtn"); b.disabled = true; b.textContent = "লগইন হচ্ছে…";
      window.HPStore.login($("email").value.trim(), $("pw").value).then(function () {
        b.disabled = false; b.textContent = "লগইন / Login"; $("pw").value = ""; showDash();
      }).catch(function (err) {
        b.disabled = false; b.textContent = "লগইন / Login";
        $("loginErr").textContent = (err && err.message) || "লগইন ব্যর্থ"; $("loginErr").classList.add("show");
      });
    } else {
      if ($("pw").value === ADMIN_PASSWORD) { sessionStorage.setItem(SESSION_KEY, "1"); showDash(); }
      else { $("loginErr").textContent = "ভুল পাসওয়ার্ড"; $("loginErr").classList.add("show"); }
    }
  });
  $("pw").addEventListener("keydown", function (e) { if (e.key === "Enter") $("loginBtn").click(); });
  $("logoutBtn").addEventListener("click", function () {
    if (supaMode) window.HPStore.logout(); else sessionStorage.removeItem(SESSION_KEY);
    dashView.hidden = true; loginView.hidden = false;
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".fin-tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".fin-tab").forEach(function (x) { x.classList.remove("is-active"); });
      document.querySelectorAll(".fin-panel").forEach(function (x) { x.classList.remove("is-active"); });
      t.classList.add("is-active");
      $("tab-" + t.getAttribute("data-tab")).classList.add("is-active");
      if (t.getAttribute("data-tab") === "dashboard") renderDashboard();
    });
  });

  /* ---------- Data cache ---------- */
  var projects = [], categories = [], txns = [];
  function catById(id) { for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i]; return null; }
  function projById(id) { for (var i = 0; i < projects.length; i++) if (projects[i].id === id) return projects[i]; return null; }
  function topCatOf(cat) { if (!cat) return null; return cat.parent_id ? catById(cat.parent_id) : cat; }

  function loadAll() {
    return Promise.all([fin.projects.list(), fin.categories.list(), fin.transactions.list()])
      .then(function (r) { projects = r[0] || []; categories = r[1] || []; txns = r[2] || []; });
  }

  function boot() {
    loadAll().then(function () {
      fillProjectSelects(); fillCategorySelects(); fillManageSelects();
      $("enDate").value = new Date().toISOString().slice(0, 10);
      renderDashboard(); renderManage();
    }).catch(function (e) { alert("ডেটা লোড ব্যর্থ / Load failed: " + (e.message || e)); });
  }

  /* ---------- Selects ---------- */
  function opt(v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; return o; }
  function fillProjectSelects() {
    [$("fltProject"), $("enProject")].forEach(function (sel) {
      var keep = sel.value;
      sel.innerHTML = "";
      if (sel.id === "fltProject") sel.appendChild(opt("", "সব প্রকল্প"));
      else sel.appendChild(opt("", "— নির্বাচন করুন —"));
      projects.forEach(function (p) { sel.appendChild(opt(p.id, p.name)); });
      sel.value = keep;
    });
  }
  function currentType() { return document.querySelector(".seg__btn.is-active").getAttribute("data-type"); }
  function fillCategorySelects() {
    var sel = $("enCategory"); sel.innerHTML = ""; sel.appendChild(opt("", "— নির্বাচন করুন —"));
    categories.filter(function (c) { return !c.parent_id && c.kind === currentType(); })
      .forEach(function (c) { sel.appendChild(opt(c.id, c.name)); });
    fillSubcatSelect();
  }
  function fillSubcatSelect() {
    var sel = $("enSubcat"); sel.innerHTML = ""; sel.appendChild(opt("", "— নেই —"));
    var parent = $("enCategory").value;
    if (parent) categories.filter(function (c) { return c.parent_id === parent; })
      .forEach(function (c) { sel.appendChild(opt(c.id, c.name)); });
  }
  $("enCategory").addEventListener("change", fillSubcatSelect);

  function fillManageSelects() {
    var mp = $("mcParent"), kind = $("mcKind").value;
    mp.innerHTML = ""; mp.appendChild(opt("", "— টপ ক্যাটাগরি —"));
    categories.filter(function (c) { return !c.parent_id && c.kind === kind; })
      .forEach(function (c) { mp.appendChild(opt(c.id, c.name)); });
  }
  $("mcKind").addEventListener("change", fillManageSelects);

  /* ---------- Add project / category inline ---------- */
  $("addProjectBtn").addEventListener("click", function () {
    var name = prompt("নতুন প্রকল্পের নাম / New project name:"); if (!name) return;
    var budget = parseFloat(prompt("বাজেট (৳) / Budget:", "0")) || 0;
    fin.projects.add({ name: name.trim(), budget: budget, status: "running" }).then(function (created) {
      loadAll().then(function () {
        fillProjectSelects();
        if (created && created.id) $("enProject").value = created.id;
        renderManage();
      });
    });
  });
  $("addCatBtn").addEventListener("click", function () {
    var name = prompt("নতুন টপ ক্যাটাগরি / New top category (" + currentType() + "):"); if (!name) return;
    fin.categories.add({ name: name.trim(), parent_id: null, kind: currentType() }).then(function () {
      loadAll().then(function () { fillCategorySelects(); renderManage(); });
    });
  });
  $("addSubBtn").addEventListener("click", function () {
    var parent = $("enCategory").value;
    if (!parent) { alert("আগে টপ ক্যাটাগরি নির্বাচন করুন।"); return; }
    var name = prompt("নতুন সাব-ক্যাটাগরি / New sub-category:"); if (!name) return;
    fin.categories.add({ name: name.trim(), parent_id: parent, kind: currentType() }).then(function () {
      loadAll().then(function () { fillSubcatSelect(); renderManage(); });
    });
  });

  /* ---------- Type toggle ---------- */
  document.querySelectorAll("#typeSeg .seg__btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#typeSeg .seg__btn").forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active"); fillCategorySelects();
    });
  });

  /* ---------- AI scan ---------- */
  var scanFile = $("scanFile");
  scanFile.addEventListener("change", function () {
    var f = scanFile.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function (e) { $("scanPreview").src = e.target.result; $("scanPreviewWrap").hidden = false; }; r.readAsDataURL(f);
  });
  // AI fallback — only runs when offline OCR can't read the slip. Needs ANTHROPIC_API_KEY in Vercel.
  function runAiScan(f) {
    var st = $("scanStatus"); st.textContent = "🤖 AI দিয়ে চেষ্টা হচ্ছে…";
    var catNames = categories.map(function (c) { return c.name; });
    return fin.extractCost(f, catNames).then(function (data) {
      if (data.txn_date) $("enDate").value = data.txn_date;
      if (data.total) $("enAmount").value = data.total;
      var noteParts = [];
      if (data.vendor) noteParts.push(data.vendor);
      (data.items || []).forEach(function (it) { noteParts.push(it.description + " (৳" + it.amount + ")"); });
      if (noteParts.length) $("enNote").value = noteParts.join(", ");
      var firstCat = (data.items && data.items[0] && data.items[0].category || "").toLowerCase();
      if (firstCat) {
        var match = categories.filter(function (c) { return !c.parent_id && c.kind === "cost" && c.name.toLowerCase().indexOf(firstCat) >= 0; })[0]
          || categories.filter(function (c) { return c.name.toLowerCase().indexOf(firstCat) >= 0; })[0];
        if (match) {
          var top = topCatOf(match);
          document.querySelectorAll("#typeSeg .seg__btn").forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-type") === "cost"); });
          fillCategorySelects();
          $("enCategory").value = top.id; fillSubcatSelect();
          if (match.parent_id) $("enSubcat").value = match.id;
        }
      }
      st.textContent = "✅ AI দিয়ে ডেটা বসানো হয়েছে — যাচাই করে সংরক্ষণ করুন";
    }).catch(function (err) {
      st.textContent = "❌ পড়া যায়নি — অনুগ্রহ করে হাতে লিখুন" + (err && err.message ? " (" + err.message + ")" : "");
    });
  }

  /* ---------- Offline OCR (Tesseract.js, no API key) ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error("লাইব্রেরি লোড ব্যর্থ")); };
      document.head.appendChild(s);
    });
  }
  function bnToEn(str) {
    var map = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
    return String(str).replace(/[০-৯]/g, function (d) { return map[d]; });
  }
  $("ocrBtn").addEventListener("click", function () {
    var f = scanFile.files[0];
    if (!f) { alert("আগে একটি ছবি নির্বাচন/তুলুন।"); return; }
    var st = $("scanStatus"); st.textContent = "📴 লাইব্রেরি লোড হচ্ছে…";
    loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js").then(function () {
      st.textContent = "🔍 টেক্সট পড়া হচ্ছে… (কিছুক্ষণ সময় লাগতে পারে)";
      return window.Tesseract.recognize(f, "eng+ben", {
        logger: function (m) { if (m.status === "recognizing text") st.textContent = "🔍 পড়া হচ্ছে… " + Math.round(m.progress * 100) + "%"; }
      });
    }).then(function (res) {
      var text = (res && res.data && res.data.text) || "";
      var norm = bnToEn(text).replace(/,/g, "");
      // date dd/mm/yyyy or yyyy-mm-dd — detect first, then exclude from number pool
      var d = norm.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/) || norm.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      var pool = norm;
      if (d) {
        var iso = d[1].length === 4 ? (d[1] + "-" + pad(d[2]) + "-" + pad(d[3])) : (d[3] + "-" + pad(d[2]) + "-" + pad(d[1]));
        if (!isNaN(new Date(iso).getTime())) $("enDate").value = iso;
        pool = pool.replace(d[0], " "); // don't let the date's digits count as an amount
      }
      // prefer a number next to a "total" keyword; else the largest remaining number
      var total = 0;
      var tot = pool.match(/(?:grand\s*total|total|সর্বমোট|মোট)[^\d]{0,14}(\d+(?:\.\d+)?)/i);
      if (tot) total = parseFloat(tot[1]);
      if (!total) {
        var nums = (pool.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat).filter(function (n) { return n > 0; });
        total = nums.length ? Math.max.apply(null, nums) : 0;
      }
      $("enNote").value = text.replace(/\s+/g, " ").trim().slice(0, 160);
      if (total) {
        $("enAmount").value = total;
        st.textContent = "✅ টেক্সট পড়া হয়েছে — পরিমাণ ও তথ্য যাচাই করুন";
      } else {
        st.textContent = "⚠️ অফলাইনে পরিমাণ পাওয়া যায়নি — AI দিয়ে চেষ্টা করছি…";
        runAiScan(f); // fall back to AI when offline OCR can't read the amount
      }
    }).catch(function () {
      st.textContent = "⚠️ অফলাইন স্ক্যান ব্যর্থ — AI দিয়ে চেষ্টা করছি…";
      runAiScan(f); // fall back to AI on OCR failure
    });
  });
  function pad(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  /* ---------- Save entry ---------- */
  var editingId = null;
  function resetEntry() {
    editingId = null;
    $("enAmount").value = ""; $("enNote").value = ""; $("enSubcat").value = ""; $("enCategory").value = "";
    scanFile.value = ""; $("scanPreviewWrap").hidden = true; $("scanStatus").textContent = "";
    $("enDate").value = new Date().toISOString().slice(0, 10);
    fillSubcatSelect();
    $("entryTitle").textContent = "➕ নতুন এন্ট্রি"; $("saveEntryBtn").textContent = "সংরক্ষণ করুন / Save";
    $("editBanner").classList.remove("show"); $("cancelEntryBtn").hidden = true;
  }
  $("cancelEntryBtn").addEventListener("click", resetEntry);

  $("saveEntryBtn").addEventListener("click", function () {
    var amount = parseFloat($("enAmount").value);
    if (!amount || amount <= 0) { alert("সঠিক পরিমাণ দিন / Enter a valid amount"); return; }
    var catId = $("enSubcat").value || $("enCategory").value || null;
    var fields = {
      type: currentType(),
      project_id: $("enProject").value || null,
      category_id: catId,
      amount: amount,
      note: $("enNote").value.trim(),
      txn_date: $("enDate").value || new Date().toISOString().slice(0, 10)
    };
    $("saveEntryBtn").disabled = true;
    var op = editingId ? fin.transactions.update(editingId, fields) : fin.transactions.add(fields);
    op.then(function () {
      $("saveEntryBtn").disabled = false;
      $("entryOk").classList.add("show"); setTimeout(function () { $("entryOk").classList.remove("show"); }, 2200);
      resetEntry();
      loadAll().then(function () { renderDashboard(); renderTxns(); });
    }).catch(function (err) {
      $("saveEntryBtn").disabled = false;
      alert("সংরক্ষণ ব্যর্থ / Save failed: " + (err.message || err));
    });
  });

  /* ---------- Filters ---------- */
  ["fltProject", "fltFrom", "fltTo"].forEach(function (id) { $(id).addEventListener("change", renderDashboard); });
  $("fltClear").addEventListener("click", function () { $("fltProject").value = ""; $("fltFrom").value = ""; $("fltTo").value = ""; renderDashboard(); });

  function filtered() {
    var pj = $("fltProject").value, from = $("fltFrom").value, to = $("fltTo").value;
    return txns.filter(function (t) {
      if (pj && t.project_id !== pj) return false;
      if (from && t.txn_date < from) return false;
      if (to && t.txn_date > to) return false;
      return true;
    });
  }

  /* ---------- Charts ---------- */
  var charts = {};
  function themeColors() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return { text: dark ? "#cfe0d5" : "#4a5568", grid: dark ? "rgba(255,255,255,.08)" : "rgba(15,36,56,.08)" };
  }
  var PALETTE = ["#17803f", "#d99a3f", "#2f7fb0", "#b0592f", "#7a52b0", "#3a9d5d", "#c94f7c", "#0f5c33", "#a0803f", "#4a5568"];

  function renderDashboard() {
    if (!window.Chart) return;
    var rows = filtered();
    var income = 0, cost = 0;
    rows.forEach(function (t) { if (t.type === "income") income += Number(t.amount) || 0; else cost += Number(t.amount) || 0; });
    var profit = income - cost;
    $("kpiIncome").textContent = taka(income);
    $("kpiCost").textContent = taka(cost);
    $("kpiProfit").textContent = taka(profit);
    $("kpiProfit").className = "kpi__val " + (profit >= 0 ? "kpi--in" : "kpi--cost");
    $("kpiMargin").textContent = income > 0 ? Math.round((profit / income) * 100) + "%" : "—";

    // Per-project table
    var tbody = $("projTable").querySelector("tbody"); tbody.innerHTML = "";
    var perProj = {};
    rows.forEach(function (t) {
      var k = t.project_id || "_none";
      perProj[k] = perProj[k] || { income: 0, cost: 0 };
      if (t.type === "income") perProj[k].income += Number(t.amount) || 0; else perProj[k].cost += Number(t.amount) || 0;
    });
    Object.keys(perProj).forEach(function (k) {
      var p = projById(k), d = perProj[k], pr = d.income - d.cost;
      var budget = p ? Number(p.budget) || 0 : 0;
      var used = budget > 0 ? Math.min(100, Math.round((d.cost / budget) * 100)) : 0;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(p ? p.name : "অন্যান্য") + "</td>" +
        "<td>" + (budget ? taka(budget) : "—") + "</td>" +
        "<td class='num in'>" + taka(d.income) + "</td>" +
        "<td class='num cost'>" + taka(d.cost) + "</td>" +
        "<td class='num " + (pr >= 0 ? "in" : "cost") + "'>" + taka(pr) + "</td>" +
        "<td>" + (budget ? "<div class='bar'><span style='width:" + used + "%'></span></div>" + used + "%" : "—") + "</td>";
      tbody.appendChild(tr);
    });
    if (!Object.keys(perProj).length) tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;color:var(--body)'>কোনো ডেটা নেই</td></tr>";

    // Category (top) cost donut
    var catTotals = {}, subTotals = {};
    rows.filter(function (t) { return t.type === "cost"; }).forEach(function (t) {
      var c = catById(t.category_id), top = topCatOf(c);
      var tn = top ? top.name : "অজানা"; catTotals[tn] = (catTotals[tn] || 0) + (Number(t.amount) || 0);
      var sn = c ? c.name : "অজানা"; subTotals[sn] = (subTotals[sn] || 0) + (Number(t.amount) || 0);
    });
    var tc = themeColors();
    drawChart("catChart", "doughnut", {
      labels: Object.keys(catTotals),
      datasets: [{ data: Object.values(catTotals), backgroundColor: PALETTE, borderWidth: 0 }]
    }, { plugins: { legend: { position: "bottom", labels: { color: tc.text, font: { family: "Hind Siliguri" } } } } });

    // Sub-category bar
    var subEntries = Object.keys(subTotals).map(function (k) { return [k, subTotals[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    drawChart("subChart", "bar", {
      labels: subEntries.map(function (e) { return e[0]; }),
      datasets: [{ label: "খরচ", data: subEntries.map(function (e) { return e[1]; }), backgroundColor: "#17803f", borderRadius: 6 }]
    }, { indexAxis: "y", plugins: { legend: { display: false } }, scales: axes(tc) });

    // Monthly trend
    var months = {};
    rows.forEach(function (t) {
      var m = (t.txn_date || "").slice(0, 7); if (!m) return;
      months[m] = months[m] || { income: 0, cost: 0 };
      if (t.type === "income") months[m].income += Number(t.amount) || 0; else months[m].cost += Number(t.amount) || 0;
    });
    var mk = Object.keys(months).sort();
    drawChart("trendChart", "bar", {
      labels: mk,
      datasets: [
        { label: "আয়", data: mk.map(function (m) { return months[m].income; }), backgroundColor: "#2f9d5d", borderRadius: 5 },
        { label: "খরচ", data: mk.map(function (m) { return months[m].cost; }), backgroundColor: "#d99a3f", borderRadius: 5 }
      ]
    }, { plugins: { legend: { position: "bottom", labels: { color: tc.text, font: { family: "Hind Siliguri" } } } }, scales: axes(tc) });
  }
  function axes(tc) { return { x: { ticks: { color: tc.text }, grid: { color: tc.grid } }, y: { ticks: { color: tc.text }, grid: { color: tc.grid } } }; }
  function drawChart(id, type, data, opts) {
    var ctx = $(id); if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, { type: type, data: data, options: Object.assign({ responsive: true, maintainAspectRatio: false }, opts || {}) });
  }

  /* ---------- Manage ---------- */
  function renderManage() { renderProjects(); renderCategories(); renderTxns(); }
  $("mpAdd").addEventListener("click", function () {
    var name = $("mpName").value.trim(); if (!name) { alert("নাম দিন"); return; }
    fin.projects.add({ name: name, budget: parseFloat($("mpBudget").value) || 0, status: $("mpStatus").value }).then(function () {
      $("mpName").value = ""; $("mpBudget").value = "";
      loadAll().then(function () { fillProjectSelects(); renderProjects(); renderDashboard(); });
    });
  });
  function renderProjects() {
    var el = $("mpList"); el.innerHTML = "";
    if (!projects.length) { el.innerHTML = "<p class='admin-empty'>কোনো প্রকল্প নেই।</p>"; return; }
    projects.forEach(function (p) {
      var row = document.createElement("div"); row.className = "mrow";
      row.innerHTML = "<div><strong>" + esc(p.name) + "</strong> <span class='mrow__sub'>" + (p.budget ? "বাজেট " + taka(p.budget) : "") + " · " + esc(p.status || "") + "</span></div>";
      var del = document.createElement("button"); del.className = "btn btn--danger btn--sm"; del.textContent = "মুছুন";
      del.addEventListener("click", function () {
        if (confirm("প্রকল্প মুছবেন? লেনদেন থাকলে সেগুলো 'অন্যান্য' হবে।")) fin.projects.remove(p.id).then(function () { loadAll().then(function () { fillProjectSelects(); renderProjects(); renderDashboard(); }); });
      });
      row.appendChild(del); el.appendChild(row);
    });
  }
  $("mcAdd").addEventListener("click", function () {
    var name = $("mcName").value.trim(); if (!name) { alert("নাম দিন"); return; }
    fin.categories.add({ name: name, parent_id: $("mcParent").value || null, kind: $("mcKind").value }).then(function () {
      $("mcName").value = "";
      loadAll().then(function () { fillCategorySelects(); fillManageSelects(); renderCategories(); });
    });
  });
  function renderCategories() {
    var el = $("mcList"); el.innerHTML = "";
    var tops = categories.filter(function (c) { return !c.parent_id; });
    tops.forEach(function (top) {
      var subs = categories.filter(function (c) { return c.parent_id === top.id; });
      var row = document.createElement("div"); row.className = "mrow mrow--cat";
      row.innerHTML = "<div><strong>" + esc(top.name) + "</strong> <span class='pill pill--" + top.kind + "'>" + (top.kind === "income" ? "আয়" : "খরচ") + "</span>" +
        (subs.length ? "<div class='subs'>" + subs.map(function (s) { return "<span class='chip' data-id='" + s.id + "'>" + esc(s.name) + " ✕</span>"; }).join("") + "</div>" : "") + "</div>";
      var del = document.createElement("button"); del.className = "btn btn--danger btn--sm"; del.textContent = "মুছুন";
      del.addEventListener("click", function () { if (confirm("ক্যাটাগরি ও এর সাব-ক্যাটাগরি মুছবেন?")) fin.categories.remove(top.id).then(refreshCats); });
      row.appendChild(del);
      row.querySelectorAll(".chip").forEach(function (ch) {
        ch.addEventListener("click", function () { if (confirm("সাব-ক্যাটাগরি মুছবেন?")) fin.categories.remove(ch.getAttribute("data-id")).then(refreshCats); });
      });
      el.appendChild(row);
    });
    if (!tops.length) el.innerHTML = "<p class='admin-empty'>কোনো ক্যাটাগরি নেই।</p>";
  }
  function refreshCats() { loadAll().then(function () { fillCategorySelects(); fillManageSelects(); renderCategories(); renderDashboard(); }); }

  function renderTxns() {
    var tbody = $("txnTable").querySelector("tbody"); tbody.innerHTML = "";
    var recent = txns.slice(0, 40);
    recent.forEach(function (t) {
      var c = catById(t.category_id), p = projById(t.project_id);
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(t.txn_date || "") + "</td>" +
        "<td><span class='pill pill--" + (t.type === "income" ? "income" : "cost") + "'>" + (t.type === "income" ? "আয়" : "খরচ") + "</span></td>" +
        "<td>" + esc(p ? p.name : "—") + "</td>" +
        "<td>" + esc(c ? c.name : "—") + "</td>" +
        "<td class='num " + (t.type === "income" ? "in" : "cost") + "'>" + taka(t.amount) + "</td>";
      var td = document.createElement("td"); td.style.whiteSpace = "nowrap";
      var ed = document.createElement("button"); ed.className = "btn btn--edit btn--sm"; ed.textContent = "✏️";
      ed.addEventListener("click", function () { startEdit(t); });
      var del = document.createElement("button"); del.className = "btn btn--danger btn--sm"; del.textContent = "🗑";
      del.addEventListener("click", function () { if (confirm("লেনদেন মুছবেন?")) fin.transactions.remove(t.id).then(function () { loadAll().then(function () { renderTxns(); renderDashboard(); }); }); });
      td.appendChild(ed); td.appendChild(del); tr.appendChild(td);
      tbody.appendChild(tr);
    });
    if (!recent.length) tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;color:var(--body)'>কোনো লেনদেন নেই</td></tr>";
  }

  function startEdit(t) {
    // switch to entry tab
    document.querySelectorAll(".fin-tab").forEach(function (x) { x.classList.remove("is-active"); });
    document.querySelectorAll(".fin-panel").forEach(function (x) { x.classList.remove("is-active"); });
    document.querySelector('.fin-tab[data-tab="entry"]').classList.add("is-active");
    $("tab-entry").classList.add("is-active");
    editingId = t.id;
    document.querySelectorAll("#typeSeg .seg__btn").forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-type") === t.type); });
    fillCategorySelects();
    var c = catById(t.category_id), top = topCatOf(c);
    $("enProject").value = t.project_id || "";
    $("enDate").value = t.txn_date || "";
    $("enAmount").value = t.amount;
    $("enNote").value = t.note || "";
    if (top) { $("enCategory").value = top.id; fillSubcatSelect(); if (c && c.parent_id) $("enSubcat").value = c.id; }
    $("entryTitle").textContent = "✏️ এন্ট্রি আপডেট"; $("saveEntryBtn").textContent = "আপডেট করুন / Update";
    $("editBanner").classList.add("show"); $("cancelEntryBtn").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
})();
