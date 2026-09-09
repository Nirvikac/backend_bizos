/**
 * Builds real PNG image buffers for multipart upload tests.
 *
 * Pure Node (zlib is built in) — no native or extra dependencies.
 * Encodes minimal valid RGB PNGs so Cloudinary accepts the uploads.
 */

import zlib from "node:zlib";

// ------------------------------------------------------------
// CRC32 (table-based) — required for PNG chunk checksums
// ------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ------------------------------------------------------------
// PNG chunk: length + type + data + crc(type+data)
// ------------------------------------------------------------

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// ------------------------------------------------------------
// Encode a solid-color RGB PNG
// ------------------------------------------------------------

function encodePng(width, height, [r, g, b]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: each row = filter byte (0) + RGB pixels
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array(height).fill(row));

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------
// Public API: array of { buffer, originalname, mimetype }
// ------------------------------------------------------------

const COLORS = [
  { rgb: [220, 40, 40], name: "verify-red" },
  { rgb: [40, 80, 220], name: "verify-blue" },
  { rgb: [30, 180, 80], name: "verify-green" },
  { rgb: [240, 180, 30], name: "verify-yellow" },
  { rgb: [160, 40, 200], name: "verify-purple" },
];

export async function buildTestImages(count = 2, width = 64, height = 64) {
  return Array.from({ length: count }, (_, i) => {
    const c = COLORS[i % COLORS.length];
    return {
      buffer: encodePng(width, height, c.rgb),
      originalname: `${c.name}.png`,
      mimetype: "image/png",
    };
  });
}
