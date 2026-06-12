const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const outputDir = path.join(__dirname, '..', 'electron', 'assets');

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function mix(left, right, amount) {
  return Math.round(left + (right - left) * amount);
}

function blendPixel(data, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const index = (y * width + x) * 4;
  const alpha = clamp(color[3]) / 255;
  const inverse = 1 - alpha;
  data[index] = Math.round(color[0] * alpha + data[index] * inverse);
  data[index + 1] = Math.round(color[1] * alpha + data[index + 1] * inverse);
  data[index + 2] = Math.round(color[2] * alpha + data[index + 2] * inverse);
  data[index + 3] = clamp(color[3] + data[index + 3] * inverse);
}

function fillShape(data, width, predicate, colorAt) {
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coverage = predicate(x + 0.5, y + 0.5);
      if (coverage <= 0) continue;
      const color = colorAt(x / width, y / width, coverage);
      blendPixel(data, width, x, y, color);
    }
  }
}

function roundedRectCoverage(x, y, size, radius, inset = 0) {
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;
  const cx = clamp(x, left + radius, right - radius);
  const cy = clamp(y, top + radius, bottom - radius);
  const distance = Math.hypot(x - cx, y - cy) - radius;
  return clamp(1 - distance, 0, 1);
}

function strokeEllipseCoverage(x, y, cx, cy, rx, ry, thickness) {
  const normalized = Math.hypot((x - cx) / rx, (y - cy) / ry);
  const distance = Math.abs(normalized - 1) * Math.min(rx, ry);
  return clamp(thickness / 2 - distance + 1, 0, 1);
}

function polygonCoverage(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside ? 1 : 0;
}

function renderIcon(size) {
  const scale = 3;
  const canvasSize = size * scale;
  const data = Buffer.alloc(canvasSize * canvasSize * 4);

  fillShape(
    data,
    canvasSize,
    (x, y) => roundedRectCoverage(x, y, canvasSize, canvasSize * 0.22, canvasSize * 0.03),
    (nx, ny, coverage) => {
      const amount = (nx + ny) / 2;
      return [
        mix(9, 21, amount),
        mix(17, 34, amount),
        mix(29, 46, amount),
        Math.round(255 * coverage),
      ];
    }
  );

  fillShape(
    data,
    canvasSize,
    (x, y) => {
      const outer = roundedRectCoverage(x, y, canvasSize, canvasSize * 0.22, canvasSize * 0.03);
      const inner = roundedRectCoverage(x, y, canvasSize, canvasSize * 0.18, canvasSize * 0.095);
      return clamp(outer - inner, 0, 1);
    },
    (_nx, _ny, coverage) => [63, 146, 226, Math.round(150 * coverage)]
  );

  const diamond = [
    [canvasSize * 0.5, canvasSize * 0.22],
    [canvasSize * 0.76, canvasSize * 0.5],
    [canvasSize * 0.5, canvasSize * 0.78],
    [canvasSize * 0.24, canvasSize * 0.5],
  ];
  fillShape(
    data,
    canvasSize,
    (x, y) => polygonCoverage(x, y, diamond),
    (nx, ny, coverage) => [mix(31, 58, ny), mix(96, 147, nx), mix(139, 198, nx), Math.round(120 * coverage)]
  );

  fillShape(
    data,
    canvasSize,
    (x, y) => {
      const left = strokeEllipseCoverage(x, y, canvasSize * 0.38, canvasSize * 0.5, canvasSize * 0.19, canvasSize * 0.145, canvasSize * 0.055);
      const right = strokeEllipseCoverage(x, y, canvasSize * 0.62, canvasSize * 0.5, canvasSize * 0.19, canvasSize * 0.145, canvasSize * 0.055);
      return Math.max(left, right);
    },
    (_nx, _ny, coverage) => [112, 206, 255, Math.round(215 * coverage)]
  );

  fillShape(
    data,
    canvasSize,
    (x, y) => {
      const left = strokeEllipseCoverage(x, y, canvasSize * 0.38, canvasSize * 0.5, canvasSize * 0.19, canvasSize * 0.145, canvasSize * 0.021);
      const right = strokeEllipseCoverage(x, y, canvasSize * 0.62, canvasSize * 0.5, canvasSize * 0.19, canvasSize * 0.145, canvasSize * 0.021);
      return Math.max(left, right);
    },
    (_nx, _ny, coverage) => [236, 184, 107, Math.round(230 * coverage)]
  );

  const downsampled = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceIndex = ((y * scale + sy) * canvasSize + (x * scale + sx)) * 4;
          totals[0] += data[sourceIndex];
          totals[1] += data[sourceIndex + 1];
          totals[2] += data[sourceIndex + 2];
          totals[3] += data[sourceIndex + 3];
        }
      }
      const targetIndex = (y * size + x) * 4;
      downsampled[targetIndex] = Math.round(totals[0] / 9);
      downsampled[targetIndex + 1] = Math.round(totals[1] / 9);
      downsampled[targetIndex + 2] = Math.round(totals[2] / 9);
      downsampled[targetIndex + 3] = Math.round(totals[3] / 9);
    }
  }

  return downsampled;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, payload])), 0);
  return Buffer.concat([length, typeBuffer, payload, checksum]);
}

function encodePng(width, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(width, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * width);
  for (let y = 0; y < width; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Eternity Table icon">
  <defs>
    <linearGradient id="bg" x1="24" y1="18" x2="228" y2="236" gradientUnits="userSpaceOnUse">
      <stop stop-color="#09111d"/>
      <stop offset="1" stop-color="#15222e"/>
    </linearGradient>
    <linearGradient id="table" x1="60" y1="64" x2="194" y2="192" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1f608b"/>
      <stop offset="1" stop-color="#3ac6ff"/>
    </linearGradient>
  </defs>
  <rect x="9" y="9" width="238" height="238" rx="55" fill="url(#bg)" stroke="#3f92e2" stroke-width="8"/>
  <path d="M128 56 195 128 128 200 61 128Z" fill="url(#table)" opacity=".45"/>
  <path d="M82 128c0-25 16-38 37-38 31 0 37 76 67 76 21 0 37-13 37-38s-16-38-37-38c-30 0-36 76-67 76-21 0-37-13-37-38Z" fill="none" stroke="#70ceff" stroke-width="15" stroke-linecap="round"/>
  <path d="M82 128c0-25 16-38 37-38 31 0 37 76 67 76 21 0 37-13 37-38s-16-38-37-38c-30 0-36 76-67 76-21 0-37-13-37-38Z" fill="none" stroke="#ecb86b" stroke-width="5" stroke-linecap="round"/>
</svg>
`;

fs.mkdirSync(outputDir, { recursive: true });
const pngImages = [256, 128, 64, 48, 32, 16].map((size) => ({
  size,
  png: encodePng(size, renderIcon(size)),
}));

fs.writeFileSync(path.join(outputDir, 'icon.svg'), svg);
fs.writeFileSync(path.join(outputDir, 'icon.png'), pngImages[0].png);
fs.writeFileSync(path.join(outputDir, 'icon.ico'), encodeIco(pngImages));
console.log(`Generated desktop icons in ${outputDir}`);
