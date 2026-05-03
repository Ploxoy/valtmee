const fs = require("fs");
const path = require("path");

const sharp = require("sharp");

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function svg(size, maskable = false) {
  const padding = maskable ? size * 0.18 : size * 0.08;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0a0a0a"/>
    <circle cx="${size * 0.24}" cy="${size * 0.18}" r="${size * 0.42}" fill="rgba(255,255,255,0.08)"/>
    <circle cx="${size * 0.82}" cy="${size * 0.82}" r="${size * 0.35}" fill="rgba(255,255,255,0.06)"/>
    <text
      x="${size / 2}"
      y="${size / 2 + size * 0.04}"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${size * 0.24}"
      font-weight="900"
      fill="#f5f5f5"
      letter-spacing="-2"
    >VM</text>
    <text
      x="${size / 2}"
      y="${size - padding}"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${size * 0.07}"
      font-weight="700"
      fill="#a3a3a3"
    >valt mee</text>
  </svg>`;
}

async function main() {
  await sharp(Buffer.from(svg(192))).png().toFile(path.join(outDir, "icon-192.png"));
  await sharp(Buffer.from(svg(512))).png().toFile(path.join(outDir, "icon-512.png"));
  await sharp(Buffer.from(svg(512, true))).png().toFile(path.join(outDir, "maskable-512.png"));
  await sharp(Buffer.from(svg(180))).png().toFile(path.join(outDir, "apple-touch-icon.png"));

  console.log("Icons generated in public/icons");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});