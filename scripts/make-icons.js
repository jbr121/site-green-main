/**
 * Gera os ícones do app (PWA) a partir de public/img/logo.png.
 *
 *   npm run icons
 *
 * Rode de novo sempre que trocar a logo do cliente.
 */

const fs = require("fs");
const path = require("path");

let PNG;
try {
  ({ PNG } = require("pngjs"));
} catch {
  console.error('Falta a ferramenta de imagem. Rode: npm install --save-dev pngjs\nDepois: npm run icons');
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const IMG = path.join(ROOT, "public", "img");
const SRC = path.join(IMG, "logo.png");

if (!fs.existsSync(SRC)) {
  console.error("Coloque a logo em public/img/logo.png e rode de novo.");
  process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(SRC));

/** Reamostragem por média de área: encolhe sem serrilhar. */
function resample(image, w, h) {
  const out = new PNG({ width: w, height: h });
  const sx = image.width / w;
  const sy = image.height / h;
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < image.height; yy += 1) {
        for (let xx = x0; xx < x1 && xx < image.width; xx += 1) {
          const i = (image.width * yy + xx) << 2;
          const alpha = image.data[i + 3] / 255;
          r += image.data[i] * alpha;
          g += image.data[i + 1] * alpha;
          b += image.data[i + 2] * alpha;
          a += image.data[i + 3];
          n += 1;
        }
      }
      const o = (w * y + x) << 2;
      const avgAlpha = a / n / 255 || 0;
      out.data[o] = avgAlpha ? Math.round(r / n / avgAlpha) : 0;
      out.data[o + 1] = avgAlpha ? Math.round(g / n / avgAlpha) : 0;
      out.data[o + 2] = avgAlpha ? Math.round(b / n / avgAlpha) : 0;
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

/** Desenha a logo centralizada num quadrado, com fundo opcional. */
function icon(size, { scale = 1, background = null } = {}) {
  const canvas = new PNG({ width: size, height: size });
  const bg = background ? background : [0, 0, 0, 0];
  for (let i = 0; i < canvas.data.length; i += 4) {
    canvas.data[i] = bg[0];
    canvas.data[i + 1] = bg[1];
    canvas.data[i + 2] = bg[2];
    canvas.data[i + 3] = bg[3];
  }
  const inner = Math.round(size * scale);
  const logo = resample(src, inner, inner);
  const offset = Math.round((size - inner) / 2);
  for (let y = 0; y < inner; y += 1) {
    for (let x = 0; x < inner; x += 1) {
      const s = (inner * y + x) << 2;
      const d = (size * (y + offset) + (x + offset)) << 2;
      const alpha = logo.data[s + 3] / 255;
      if (!alpha) continue;
      canvas.data[d] = Math.round(logo.data[s] * alpha + canvas.data[d] * (1 - alpha));
      canvas.data[d + 1] = Math.round(logo.data[s + 1] * alpha + canvas.data[d + 1] * (1 - alpha));
      canvas.data[d + 2] = Math.round(logo.data[s + 2] * alpha + canvas.data[d + 2] * (1 - alpha));
      canvas.data[d + 3] = Math.max(canvas.data[d + 3], logo.data[s + 3]);
    }
  }
  return canvas;
}

const DARK = [11, 11, 13, 255]; // mesmo fundo do site

const files = [
  ["icon-192.png", icon(192, { scale: 0.92 })],
  ["icon-512.png", icon(512, { scale: 0.92 })],
  ["icon-maskable-512.png", icon(512, { scale: 0.6, background: DARK })],
  ["apple-touch-icon.png", icon(180, { scale: 0.78, background: DARK })],
  ["favicon-32.png", icon(32, { scale: 1 })],
  ["logo-160.png", icon(160, { scale: 1 })],
];

for (const [name, png] of files) {
  const buf = PNG.sync.write(png, { colorType: 6, deflateLevel: 9 });
  fs.writeFileSync(path.join(IMG, name), buf);
  console.log(`${name.padEnd(24)} ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log("\nÍcones gerados em public/img.");
