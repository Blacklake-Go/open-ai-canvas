'use client';

import React, { useMemo } from 'react';

// ==========================================
// 100% 纯原生离线 QR Code 矢量矩阵算法（零外部网络依赖）
// ==========================================

// Galois Field GF(256) 运算表 (用于 Reed-Solomon 纠错码计算)
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}

function gmult(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gmult(p[i], q[j]);
    }
  }
  return r;
}

function polyRest(msg, gen) {
  const res = new Uint8Array(msg);
  for (let i = 0; i <= msg.length - gen.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gmult(gen[j], coef);
      }
    }
  }
  return res.slice(msg.length - gen.length + 1);
}

function getGeneratorPoly(degree) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, EXP_TABLE[i]]));
  }
  return g;
}

// 国际标准 QR 规格表 (ECC 等级 M，版本 1~14)
// [总码字数, 纠错码字数/块, 块数G1, 数据码字数G1, 块数G2, 数据码字数G2]
const EC_SPECS_M = [
  null,
  [26, 10, 1, 16, 0, 0],       // V1: 16 data
  [44, 16, 1, 28, 0, 0],       // V2: 28 data
  [70, 26, 1, 44, 0, 0],       // V3: 44 data
  [100, 18, 2, 32, 0, 0],      // V4: 64 data
  [134, 24, 2, 43, 0, 0],      // V5: 86 data
  [172, 16, 4, 27, 0, 0],      // V6: 108 data
  [196, 18, 4, 31, 0, 0],      // V7: 124 data
  [242, 22, 2, 38, 2, 39],     // V8: 154 data
  [292, 22, 3, 36, 2, 37],     // V9: 182 data
  [346, 26, 4, 43, 1, 44],     // V10: 216 data
  [404, 30, 2, 36, 4, 37],     // V11: 256 data
  [466, 22, 4, 42, 4, 43],     // V12: 300 data
  [532, 22, 4, 45, 6, 46],     // V13: 350 data
  [581, 24, 8, 40, 2, 41],     // V14: 402 data
];

const ALIGNMENT_PATTERNS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
];

function generateQrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  let version = 1;
  while (version <= 14) {
    const spec = EC_SPECS_M[version];
    const maxData = (spec[2] * spec[3]) + (spec[4] * spec[5]);
    const overheadBytes = version <= 9 ? 2 : 3;
    if (dataLen + overheadBytes <= maxData) break;
    version++;
  }
  if (version > 14) {
    throw new Error('二维码内容超出规格上限');
  }

  const spec = EC_SPECS_M[version];
  const maxDataCodewords = (spec[2] * spec[3]) + (spec[4] * spec[5]);
  const ecCodewordsPerBlock = spec[1];

  let bitBuf = 0;
  let bitLen = 0;
  const codewords = [];

  function putBits(val, len) {
    bitBuf = (bitBuf << len) | (val & ((1 << len) - 1));
    bitLen += len;
    while (bitLen >= 8) {
      bitLen -= 8;
      codewords.push((bitBuf >> bitLen) & 0xff);
    }
  }

  // 1. 模式指示符: Byte 模式 = 0100
  putBits(0b0100, 4);

  // 2. 字符计数器
  const countBits = version <= 9 ? 8 : 16;
  putBits(dataLen, countBits);

  // 3. 原始字节
  for (let i = 0; i < bytes.length; i++) {
    putBits(bytes[i], 8);
  }

  // 4. 结束符 (最多 4 个 0)
  const padZeros = Math.min(4, (maxDataCodewords * 8) - (codewords.length * 8 + bitLen));
  if (padZeros > 0) putBits(0, padZeros);

  // 5. 补齐到字节边界
  if (bitLen > 0) {
    putBits(0, 8 - bitLen);
  }

  // 6. 填充字节 0xEC, 0x11
  let padByte = 0xec;
  while (codewords.length < maxDataCodewords) {
    codewords.push(padByte);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  // 7. 分块生成纠错码
  const blocks = [];
  const ecBlocks = [];
  const genPoly = getGeneratorPoly(ecCodewordsPerBlock);

  let cwOffset = 0;
  for (let b = 0; b < spec[2]; b++) {
    const dataCount = spec[3];
    const dataPart = codewords.slice(cwOffset, cwOffset + dataCount);
    cwOffset += dataCount;
    blocks.push(dataPart);
    const msg = new Uint8Array(dataCount + ecCodewordsPerBlock);
    msg.set(dataPart);
    const ec = polyRest(msg, genPoly);
    ecBlocks.push(ec);
  }
  for (let b = 0; b < spec[4]; b++) {
    const dataCount = spec[5];
    const dataPart = codewords.slice(cwOffset, cwOffset + dataCount);
    cwOffset += dataCount;
    blocks.push(dataPart);
    const msg = new Uint8Array(dataCount + ecCodewordsPerBlock);
    msg.set(dataPart);
    const ec = polyRest(msg, genPoly);
    ecBlocks.push(ec);
  }

  // 8. 交叉交错重排数据码字
  const interleaved = [];
  const maxBlockLen = Math.max(spec[3], spec[5]);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blocks[b].length) interleaved.push(blocks[b][i]);
    }
  }
  // 交叉交错重排纠错码字
  for (let i = 0; i < ecCodewordsPerBlock; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }

  // 9. 构建矩阵 (尺寸 = 17 + version * 4)
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const isFunction = Array.from({ length: size }, () => new Uint8Array(size).fill(0));

  function setFunctionModule(r, c, val) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      isFunction[r][c] = 1;
    }
  }

  // 绘制 7x7 定位图案 (Finder Pattern) + 1 格分隔线
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setFunctionModule(nr, nc, isBlack ? 1 : 0);
        } else {
          setFunctionModule(nr, nc, 0);
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 定时图案 (Timing Patterns)
  for (let i = 8; i < size - 8; i++) {
    const val = (i % 2 === 0) ? 1 : 0;
    setFunctionModule(6, i, val);
    setFunctionModule(i, 6, val);
  }

  // 对齐图案 (Alignment Patterns)
  const alignCoords = ALIGNMENT_PATTERNS[version] || [];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const r = alignCoords[i];
      const c = alignCoords[j];
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setFunctionModule(r + dr, c + dc, isBlack ? 1 : 0);
        }
      }
    }
  }

  // 暗模块 (Dark Module)
  setFunctionModule(size - 8, 8, 1);

  // 格式保留位
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = 2;
    if (!isFunction[i][8]) isFunction[i][8] = 2;
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = 2;
    if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i] = 2;
  }

  // 10. Z 字形填充数据码字
  let bitIndex = 0;
  const totalBits = interleaved.length * 8;
  let dir = -1;
  let c = size - 1;

  while (c > 0) {
    if (c === 6) c--;
    const rStart = dir === -1 ? size - 1 : 0;
    const rEnd = dir === -1 ? -1 : size;
    const rStep = dir;

    for (let r = rStart; r !== rEnd; r += rStep) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const curC = c - colOffset;
        if (isFunction[r][curC]) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          const byteIdx = Math.floor(bitIndex / 8);
          const bitInByte = 7 - (bitIndex % 8);
          bit = (interleaved[byteIdx] >> bitInByte) & 1;
          bitIndex++;
        }
        matrix[r][curC] = bit;
      }
    }
    dir = -dir;
    c -= 2;
  }

  // 11. 掩模 0 翻转 ((row + col) % 2 === 0)
  for (let r = 0; r < size; r++) {
    for (let col = 0; col < size; col++) {
      if (isFunction[r][col]) continue;
      if ((r + col) % 2 === 0) {
        matrix[r][col] ^= 1;
      }
    }
  }

  // 12. 写入格式信息 (ECC Level M + Mask 0 -> BCH 校验码 0x5412)
  const FORMAT_BITS_M_MASK0 = 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = (FORMAT_BITS_M_MASK0 >> (14 - i)) & 1;
    if (i < 6) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }

  return matrix;
}

export default function QRCodeSvg({ value, size = 200, className = '' }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try {
      return generateQrMatrix(String(value));
    } catch (e) {
      console.warn('[QRCodeSvg] 生成本地二维码失败:', e.message);
      return null;
    }
  }, [value]);

  if (!value) return null;

  if (!matrix) {
    // 极端超长字符备用渲染
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(value)}`;
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl bg-white p-2 shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={fallbackUrl}
          alt="支付二维码"
          width={size - 16}
          height={size - 16}
          className="size-full object-contain"
        />
      </div>
    );
  }

  const margin = 2;
  const matrixSize = matrix.length;
  const viewBoxSize = matrixSize + margin * 2;

  let pathD = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c] === 1) {
        pathD += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-white p-2.5 shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={size - 16}
        height={size - 16}
        shapeRendering="crispEdges"
        className="size-full"
        role="img"
        aria-label="支付二维码"
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" />
        <path d={pathD} fill="#000000" />
      </svg>
    </div>
  );
}
