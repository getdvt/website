// One-off icon rasterizer. Renders an SVG to favicon.ico (16/32/48) + apple-touch-icon.png (180).
// Run from the website repo so `sharp` resolves: `node scripts/gen-icons.mjs <svg> <outDir>`
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [svgPath, outDir] = process.argv.slice(2);
if (!svgPath || !outDir) {
  console.error('usage: node gen-icons.mjs <input.svg> <outDir>');
  process.exit(1);
}
const svg = readFileSync(svgPath);

// Build a multi-size .ico by embedding PNGs (Vista+ PNG-in-ICO format).
function buildIco(pngs /* [{size, buf}] */) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach((p, i) => {
    const e = i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, e + 0); // width (0 => 256)
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // color planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(p.buf.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += p.buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

const icoSizes = [16, 32, 48];
const icoPngs = [];
for (const size of icoSizes) {
  const buf = await sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  icoPngs.push({ size, buf });
}
writeFileSync(join(outDir, 'favicon.ico'), buildIco(icoPngs));

// apple-touch-icon: 180x180, solid white tile (iOS renders transparency as black), padded mark.
const APPLE = 180;
const PAD = 26; // padding around the mark
const mark = await sharp(svg, { density: 384 })
  .resize(APPLE - PAD * 2, APPLE - PAD * 2, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: APPLE, height: APPLE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: mark, gravity: 'center' }])
  .png()
  .toFile(join(outDir, 'apple-touch-icon.png'));

console.log(`wrote favicon.ico + apple-touch-icon.png to ${outDir} from ${svgPath}`);
