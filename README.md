# এইচ. প্রোপার্টিজ — H. Properties

Official website for **H. Properties (এইচ. প্রোপার্টিজ)**, a building construction & property
development company based in Raninagar (Hadir Mor), Rajshahi, Bangladesh.

> স্লোগান: **“আপনার বাড়ি, আমরা গড়ি”** — *Your home, we build.*

## Features
- ⚡ Fast static site (plain HTML/CSS/JS, no build step)
- 🌐 Bilingual — বাংলা / English toggle (saved in `localStorage`)
- 🎬 Smooth scroll-reveal animations, responsive down to mobile
- 🏗️ Sections: Hero, About, Services (13 services), Projects, Updates, Why Us, Contact
- 📝 **Admin panel** (`/admin.html`) — password-protected, create/delete posts that appear
  in the site's **Updates** section
- 📞 Click-to-call, WhatsApp, and a pre-filled contact form

## Project structure
```
index.html      # main site
admin.html      # admin panel (create/delete posts)
styles.css      # all styles
script.js       # site behaviour (lang toggle, reveals, posts render)
admin.js        # admin login + post CRUD
store.js        # pluggable post data-layer (localStorage by default)
assets/*.svg    # building illustrations (placeholders — swap with real photos)
```

## Admin panel
1. Open `/admin.html`
2. Login (default password is set in `admin.js` → `ADMIN_PASSWORD`; **change it**)
3. Create posts with title, description and an optional image → they appear under **Updates**.

### ⚠️ Important: posts storage
By default posts are saved in the **visitor's own browser** (`localStorage`), so a post you
create is only visible in *that* browser — not to other visitors. To make posts appear for
**everyone**, connect a small free backend (e.g. Supabase) by implementing an adapter in
`store.js` and setting `window.HP_BACKEND` before it loads. The rest of the app already calls
the same `getPosts / addPost / deletePost` API.

## Deployment (Vercel)
This is a static site — Vercel auto-detects it, no build config needed.
- **Auto-deploy from `main`:** connect this GitHub repo in the Vercel dashboard
  (Project → Settings → Git → Connect Git Repository). Every push to `main` then deploys.

## Replacing placeholder images
The `assets/*.svg` files are placeholder building illustrations. Replace them (or point the
`data-slot` elements in `index.html` / `styles.css` to real `.jpg`/`.png` files in `assets/`).

## Finance dashboard (`/finance.html`)

Private, admin-only costing + income + profit/loss system (Supabase-backed).

- **Setup:** run `supabase-finance.sql` in Supabase (creates `fin_projects`, `fin_categories`,
  `fin_transactions` + private `cost-photos` bucket, RLS = authenticated only).
- **AI receipt scanning:** the `api/extract-cost.js` Vercel function reads a photo with Claude
  vision and returns structured cost data. Set env var **`ANTHROPIC_API_KEY`** in Vercel
  (Project → Settings → Environment Variables). Optional **`ANTHROPIC_MODEL`** (default
  `claude-opus-5`; set `claude-haiku-4-5` for lower cost per scan).
- **Features:** photo/camera capture → AI extract → review → save; manual entry; dynamic
  categories & sub-categories; dashboard with KPIs (income/cost/profit/margin), per-project
  P&L, category donut + sub-category bar, monthly income-vs-cost trend (Chart.js).
- Reached from the admin panel's **💰 ফিন্যান্স** button; same Supabase login.

---
© H. Properties, Rajshahi. Built with care.
