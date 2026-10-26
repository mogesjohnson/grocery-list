// Generates icons/icon-192.png and icons/icon-512.png to match icons/icon.svg.
// No dependencies: rasterizes the same simple shapes and writes PNG with zlib.
// Usage: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [0x16, 0xa3, 0x4a], WHITE = [255, 255, 255], MINT = [0xbb, 0xf7, 0xd0];

function inRoundRect(x, y, rx0, ry0, w, h, r) {
  if (x < rx0 || y < ry0 || x > rx0 + w || y > ry0 + h) return false;
  const cx = Math.min(Math.max(x, rx0 + r), rx0 + w - r);
  const cy = Math.min(Math.max(y, ry0 + r), ry0 + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
// Colour at a point in the 512x512 design space (mirrors icon.svg).
function colorAt(x, y) {
  if (distToSeg(x, y, 190, 280, 234, 324) <= 17 || distToSeg(x, y, 234, 324, 322, 228) <= 17) return GREEN;
  if (inRoundRect(x, y, 196, 118, 120, 56, 18)) return inRoundRect(x, y, 202, 124, 108, 44, 12) ? MINT : WHITE;
  if (inRoundRect(x, y, 136, 150, 240, 250, 28)) return WHITE;
  return GREEN;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const SS = 3; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colorAt(((x + (sx + 0.5) / SS) * 512) / size, ((y + (sy + 0.5) / SS) * 512) / size);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), png(size));
  console.log(`wrote icons/icon-${size}.png`);
}
