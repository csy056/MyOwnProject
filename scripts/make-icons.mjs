// 앱 아이콘을 코드로 그린다. (외부 도구 없이 PNG 직접 인코딩)
// 모눈 격자 위에 되찾은 블록이 호박색으로 칠해진 모양.
// 사용법: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (f) => path.join(root, 'assets', 'images', f);

const BG = [0x0e, 0x0f, 0x10, 255];
const LINE = [0x2a, 0x2d, 0x30, 255];
const AMBER = [0xe8, 0xa3, 0x3d, 255];
const AMBER_DIM = [0x8a, 0x63, 0x27, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

// 8x8 격자 중 칠할 칸 (2 = 밝게, 1 = 어둡게)
const PATTERN = [
  '........',
  '...11...',
  '..2221..',
  '.122221.',
  '.222222.',
  '..2222..',
  '...12...',
  '........',
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const p = pixel(x, y);
      raw.set(p, y * (w * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 격자 아이콘 픽셀 함수. inset: 그림 영역 비율(적응형 아이콘 안전 영역용) */
function gridIcon(size, { bg = BG, grid = true, fill = AMBER, dim = AMBER_DIM, inset = 1 } = {}) {
  const area = size * inset;
  const off = (size - area) / 2;
  const cell = area / 8;
  const lw = Math.max(1, Math.round(size / 256));
  const gap = Math.max(1, Math.round(cell * 0.08));
  return (x, y) => {
    const gx = x - off, gy = y - off;
    if (gx < 0 || gy < 0 || gx >= area || gy >= area) return bg;
    const cx = Math.floor(gx / cell), cy = Math.floor(gy / cell);
    const inX = gx - cx * cell, inY = gy - cy * cell;
    const v = PATTERN[cy]?.[cx];
    if ((v === '2' || v === '1') && inX >= gap && inY >= gap && inX < cell - gap && inY < cell - gap) return v === '2' ? fill : dim;
    if (grid && (inX < lw || inY < lw)) return LINE;
    return bg;
  };
}

const write = (file, buf) => {
  fs.writeFileSync(out(file), buf);
  console.log('wrote', file, buf.length, 'bytes');
};

write('icon.png', png(1024, 1024, gridIcon(1024, { inset: 0.86 })));
write('android-icon-background.png', png(1024, 1024, () => BG));
write('android-icon-foreground.png', png(1024, 1024, gridIcon(1024, { bg: CLEAR, grid: false, inset: 0.6 })));
write('android-icon-monochrome.png', png(1024, 1024, gridIcon(1024, { bg: CLEAR, grid: false, fill: WHITE, dim: WHITE, inset: 0.6 })));
write('splash-icon.png', png(512, 512, gridIcon(512, { bg: CLEAR, grid: false, inset: 1 })));
write('favicon.png', png(48, 48, gridIcon(48, { inset: 1, grid: false })));
