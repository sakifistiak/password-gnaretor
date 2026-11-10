import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../public/icons');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createIconPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type None

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = Math.max(0, radius - x, x - (size - 1 - radius));
      const dy = Math.max(0, radius - y, y - (size - 1 - radius));
      const insideRounded = dx * dx + dy * dy <= radius * radius;

      if (!insideRounded) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      // Gradient background (#0ea5e9 -> #4f46e5)
      const t = (x + y) / (2 * (size - 1));
      let r = Math.round(14 + t * (79 - 14));
      let g = Math.round(165 + t * (70 - 165));
      let b = Math.round(233 + t * (229 - 233));

      // Draw a crisp white key/shield glyph in the center
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const headDist = Math.hypot(nx - 0.38, ny - 0.5);
      const inKeyHead = headDist <= 0.17 && headDist >= 0.075;
      const inKeyShaft = ny >= 0.46 && ny <= 0.54 && nx >= 0.52 && nx <= 0.78;
      const inTooth1 = nx >= 0.63 && nx <= 0.69 && ny >= 0.54 && ny <= 0.64;
      const inTooth2 = nx >= 0.72 && nx <= 0.78 && ny >= 0.54 && ny <= 0.61;

      if (inKeyHead || inKeyShaft || inTooth1 || inTooth2) {
        r = 248;
        g = 250;
        b = 252;
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(iconsDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(resolve(iconsDir, `icon${size}.png`), createIconPng(size));
}
console.log('Generated PNG icons in public/icons/');
