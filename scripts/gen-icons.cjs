// Generates pwa-192x192.png and pwa-512x512.png from scratch using Node built-ins only.
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, c]);
}

// ── Draw icon at `size` × `size` ──────────────────────────────────────────
function generatePNG(size) {
  const s   = size / 80;                    // scale factor (SVG viewBox is 80×80)
  const bg  = [59, 109, 17];               // #3B6D11
  const px  = new Uint8Array(size * size * 4); // RGBA

  // Fill background
  for (let i = 0; i < size * size; i++) {
    px[i*4]   = bg[0];
    px[i*4+1] = bg[1];
    px[i*4+2] = bg[2];
    px[i*4+3] = 255;
  }

  // Rounded-corner mask (radius = 14/80 * size)
  const r = 14 * s;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCorner =
        (x < r         && y < r         && Math.hypot(x - r,        y - r)        > r) ||
        (x > size-1-r  && y < r         && Math.hypot(x - (size-1-r), y - r)       > r) ||
        (x < r         && y > size-1-r  && Math.hypot(x - r,        y - (size-1-r)) > r) ||
        (x > size-1-r  && y > size-1-r  && Math.hypot(x - (size-1-r), y - (size-1-r)) > r);
      if (inCorner) px[(y*size+x)*4+3] = 0;  // transparent
    }
  }

  // Bars: { x, y, w, h } in 80-unit space, opacity 0–1 (blended onto bg → white)
  const bars = [
    { x:13, y:55, w:10, h:18, op:0.60 },
    { x:27, y:46, w:10, h:27, op:0.75 },
    { x:41, y:34, w:10, h:39, op:0.88 },
    { x:55, y:21, w:10, h:52, op:1.00 },
  ];
  for (const b of bars) {
    const x1 = Math.round(b.x * s), x2 = Math.round((b.x + b.w) * s);
    const y1 = Math.round(b.y * s), y2 = Math.round((b.y + b.h) * s);
    for (let y = y1; y < y2 && y < size; y++) {
      for (let x = x1; x < x2 && x < size; x++) {
        const idx = (y * size + x) * 4;
        if (px[idx+3] === 0) continue;        // skip transparent corners
        px[idx]   = Math.round(bg[0] * (1-b.op) + 255 * b.op);
        px[idx+1] = Math.round(bg[1] * (1-b.op) + 255 * b.op);
        px[idx+2] = Math.round(bg[2] * (1-b.op) + 255 * b.op);
      }
    }
  }

  // Encode as PNG (RGBA, filter=None per row)
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size*4+1)] = 0;               // filter byte
    for (let x = 0; x < size; x++) {
      const src = (y*size+x)*4, dst = y*(size*4+1)+1+x*4;
      rows[dst]   = px[src];
      rows[dst+1] = px[src+1];
      rows[dst+2] = px[src+2];
      rows[dst+3] = px[src+3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),  // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), generatePNG(192));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), generatePNG(512));
console.log('Icons written: pwa-192x192.png, pwa-512x512.png');
