"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");
const STORE_PATH = path.join(PUBLIC, "data", "store.json");
const SITE = path.join(ROOT, ".pages-dist");
const REPO_BASE = process.env.PAGES_BASE || "/site-green-main";

function copyDir(src, dest, skip = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function publicSettings(s) {
  return {
    name: s.name || "",
    tagline: s.tagline || "",
    extra: s.extra || "",
    whatsapp: String(s.whatsapp || "").replace(/\D/g, "").slice(0, 20),
    address: s.address || "",
    themeColor: s.themeColor || "",
    banner: s.banner || "",
    checkoutMessage: s.checkoutMessage || "",
    payments: Array.isArray(s.payments) ? s.payments.map((p) => String(p)) : [],
    shipping: Array.isArray(s.shipping)
      ? s.shipping.map((x) => ({
          name: String(x.name || ""),
          price: Number(x.price) || 0,
          description: String(x.description || ""),
        }))
      : [],
    promoBar: s.promoBar && s.promoBar.active
      ? {
          text: String(s.promoBar.text || ""),
          ctaLabel: String(s.promoBar.ctaLabel || ""),
          action: String(s.promoBar.action || "catalogo"),
          value: String(s.promoBar.value || ""),
        }
      : null,
    promos: Array.isArray(s.promos) ? s.promos.filter((p) => p.active !== false) : [],
    coupons: Array.isArray(s.coupons)
      ? s.coupons
          .filter((c) => c.active !== false && c.code)
          .map((c) => ({
            code: String(c.code || "").toUpperCase(),
            type: c.type || "percent",
            value: c.value,
            giftLabel: c.giftLabel || "",
            giftProductId: c.giftProductId || "",
            minOrder: Number(c.minOrder) || 0,
            maxUses: c.maxUses == null ? null : Number(c.maxUses),
            usedCount: Number(c.usedCount) || 0,
            expiresAt: c.expiresAt || null,
          }))
      : [],
    referral: {
      enabled: (s.referral || {}).enabled !== false,
      referrerBonus: Math.max(0, Number((s.referral || {}).referrerBonus) || 0),
      referredBonus: Math.max(0, Number((s.referral || {}).referredBonus) || 0),
      orderCashbackPercent: Math.min(50, Math.max(0, Number((s.referral || {}).orderCashbackPercent) || 0)),
    },
  };
}

function exportStore() {
  if (!fs.existsSync(DB_PATH)) {
    if (!fs.existsSync(STORE_PATH)) {
      throw new Error("Sem data/db.json e sem public/data/store.json");
    }
    console.log("Usando public/data/store.json já existente");
    return;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const products = (db.products || [])
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      promoPrice: p.promoPrice,
      category: p.category,
      image: p.image,
      stock: p.stock,
      stockActive: p.stockActive,
      pin: p.pin,
      optionGroup: p.optionGroup || "",
      cities: Array.isArray(p.cities) ? p.cities : [],
      options: (Array.isArray(p.options) ? p.options : []).map((o) => ({
        id: o.id,
        title: o.title,
        image: o.image || "",
        available: o.available !== false,
      })),
    }));
  const payload = {
    settings: publicSettings(db.settings || {}),
    categories: db.categories || [],
    products,
  };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload));
  console.log(`Catálogo exportado: ${products.length} produtos`);
}

function syncUploads() {
  const src = path.join(ROOT, "data", "uploads");
  const dest = path.join(PUBLIC, "uploads");
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    if (!fs.statSync(from).isFile()) continue;
    fs.copyFileSync(from, path.join(dest, name));
    n += 1;
  }
  console.log(`Fotos copiadas: ${n}`);
}

function rewriteHtml(file) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/(href|src)="\/(?!\/)/g, `$1="${REPO_BASE}/`);
  fs.writeFileSync(file, html);
}

function buildSite() {
  fs.rmSync(SITE, { recursive: true, force: true });
  copyDir(PUBLIC, SITE, new Set(["admin"]));
  fs.writeFileSync(path.join(SITE, ".nojekyll"), "");
  const index = path.join(SITE, "index.html");
  if (fs.existsSync(index)) rewriteHtml(index);
  const docs = path.join(ROOT, "docs");
  fs.rmSync(docs, { recursive: true, force: true });
  copyDir(SITE, docs);
  console.log(`Pasta estática pronta em docs/ (base ${REPO_BASE})`);
}

syncUploads();
exportStore();
if (process.argv.includes("--build")) buildSite();
