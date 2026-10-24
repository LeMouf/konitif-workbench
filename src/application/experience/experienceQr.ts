/** Local QR encoding for portable experience cards; no product dependency. */
export function createExperienceQrSvg(matrix: readonly (readonly boolean[])[], moduleSize = 8): string {
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const paths: string[] = [];

  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) paths.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * moduleSize}" height="${size * moduleSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${paths.join('')}" fill="#041019"/></svg>`;
}


export function createExperienceQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = QR_LOW_CAPACITIES.findIndex((capacity, index) => {
    if (index === 0) return false;
    const countBits = index <= 9 ? 8 : 16;
    return 4 + countBits + bytes.length * 8 <= capacity.dataCodewords * 8;
  });

  if (version < 1) {
    throw new Error('Published preset URL is too long for the local QR encoder.');
  }

  const capacity = QR_LOW_CAPACITIES[version];
  const data = encodeQrData(bytes, version, capacity.dataCodewords);
  const blocks = splitQrBlocks(data, capacity.blocks);
  const encodedBlocks = blocks.map((block) => ({
    data: block,
    errorCorrection: reedSolomonRemainder(block, capacity.errorCorrectionCodewordsPerBlock)
  }));
  const codewords = interleaveQrBlocks(encodedBlocks);
  const base = createQrFunctionMatrix(version);
  let best: boolean[][] | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = placeQrData(base, codewords, mask);
    placeQrFormatBits(candidate.modules, mask);
    if (version >= 7) placeQrVersionBits(candidate.modules, version);
    const penalty = qrPenalty(candidate.modules);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = candidate.modules;
    }
  }

  if (!best) throw new Error('QR matrix could not be generated.');
  return best;
}

const QR_LOW_CAPACITIES = [
  { dataCodewords: 0, errorCorrectionCodewordsPerBlock: 0, blocks: 0 },
  { dataCodewords: 19, errorCorrectionCodewordsPerBlock: 7, blocks: 1 },
  { dataCodewords: 34, errorCorrectionCodewordsPerBlock: 10, blocks: 1 },
  { dataCodewords: 55, errorCorrectionCodewordsPerBlock: 15, blocks: 1 },
  { dataCodewords: 80, errorCorrectionCodewordsPerBlock: 20, blocks: 1 },
  { dataCodewords: 108, errorCorrectionCodewordsPerBlock: 26, blocks: 1 },
  { dataCodewords: 136, errorCorrectionCodewordsPerBlock: 18, blocks: 2 },
  { dataCodewords: 156, errorCorrectionCodewordsPerBlock: 20, blocks: 2 },
  { dataCodewords: 194, errorCorrectionCodewordsPerBlock: 24, blocks: 2 },
  { dataCodewords: 232, errorCorrectionCodewordsPerBlock: 30, blocks: 2 },
  { dataCodewords: 274, errorCorrectionCodewordsPerBlock: 18, blocks: 4 }
] as const;

function encodeQrData(bytes: Uint8Array, version: number, dataCodewords: number): number[] {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  const capacityBits = dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);

  const result: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    result.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; result.length < dataCodewords; pad += 1) result.push(pad % 2 === 0 ? 0xec : 0x11);
  return result;
}

function appendBits(target: number[], value: number, length: number): void {
  for (let shift = length - 1; shift >= 0; shift -= 1) target.push((value >>> shift) & 1);
}

function splitQrBlocks(data: number[], blockCount: number): number[][] {
  const shortLength = Math.floor(data.length / blockCount);
  const longBlockCount = data.length % blockCount;
  const blocks: number[][] = [];
  let offset = 0;
  for (let index = 0; index < blockCount; index += 1) {
    const length = shortLength + (index >= blockCount - longBlockCount ? 1 : 0);
    blocks.push(data.slice(offset, offset + length));
    offset += length;
  }
  return blocks;
}

function reedSolomonRemainder(data: number[], degree: number): number[] {
  let generator = [1];
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    generator = multiplyPolynomials(generator, [1, root]);
    root = multiplyGalois(root, 2);
  }
  const remainder = Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= multiplyGalois(generator[index + 1], factor);
    }
  }
  return remainder;
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
  const result = Array<number>(left.length + right.length - 1).fill(0);
  left.forEach((a, leftIndex) => {
    right.forEach((b, rightIndex) => {
      result[leftIndex + rightIndex] ^= multiplyGalois(a, b);
    });
  });
  return result;
}

function multiplyGalois(left: number, right: number): number {
  let result = 0;
  let a = left;
  let b = right;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>>= 1;
    a = (a << 1) ^ ((a & 0x80) ? 0x11d : 0);
  }
  return result;
}

function interleaveQrBlocks(blocks: Array<{ data: number[]; errorCorrection: number[] }>): number[] {
  const result: number[] = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < maxDataLength; index += 1) {
    blocks.forEach((block) => {
      if (index < block.data.length) result.push(block.data[index]);
    });
  }
  for (let index = 0; index < blocks[0].errorCorrection.length; index += 1) {
    blocks.forEach((block) => result.push(block.errorCorrection[index]));
  }
  return result;
}

function createQrFunctionMatrix(version: number): { modules: boolean[][]; reserved: boolean[][] } {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (row: number, column: number, value: boolean) => {
    if (row < 0 || column < 0 || row >= size || column >= size) return;
    modules[row][column] = value;
    reserved[row][column] = true;
  };

  [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([top, left]) => {
    for (let row = -1; row <= 7; row += 1) {
      for (let column = -1; column <= 7; column += 1) {
        const inFinder = row >= 0 && row <= 6 && column >= 0 && column <= 6;
        const dark = inFinder && (
          row === 0 || row === 6 || column === 0 || column === 6 ||
          (row >= 2 && row <= 4 && column >= 2 && column <= 4)
        );
        set(top + row, left + column, dark);
      }
    }
  });

  const centers = QR_ALIGNMENT_POSITIONS[version] ?? [];
  centers.forEach((rowCenter) => centers.forEach((columnCenter) => {
    if (reserved[rowCenter][columnCenter]) return;
    for (let row = -2; row <= 2; row += 1) {
      for (let column = -2; column <= 2; column += 1) {
        set(rowCenter + row, columnCenter + column, Math.max(Math.abs(row), Math.abs(column)) !== 1);
      }
    }
  }));

  for (let index = 8; index < size - 8; index += 1) {
    if (!reserved[6][index]) set(6, index, index % 2 === 0);
    if (!reserved[index][6]) set(index, 6, index % 2 === 0);
  }

  for (let index = 0; index <= 5; index += 1) { set(index, 8, false); set(8, index, false); }
  set(7, 8, false); set(8, 8, false); set(8, 7, false);
  for (let index = 0; index < 8; index += 1) set(8, size - 1 - index, false);
  for (let index = 8; index < 15; index += 1) set(size - 15 + index, 8, false);
  set(size - 8, 8, true);

  if (version >= 7) {
    for (let index = 0; index < 18; index += 1) {
      const a = size - 11 + (index % 3);
      const b = Math.floor(index / 3);
      set(b, a, false);
      set(a, b, false);
    }
  }

  return { modules, reserved };
}

const QR_ALIGNMENT_POSITIONS: ReadonlyArray<readonly number[]> = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38],
  [6, 24, 42], [6, 26, 46], [6, 28, 50]
];

function placeQrData(
  base: { modules: boolean[][]; reserved: boolean[][] },
  codewords: number[],
  mask: number
): { modules: boolean[][]; reserved: boolean[][] } {
  const modules = base.modules.map((row) => [...row]);
  const reserved = base.reserved.map((row) => [...row]);
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (reserved[row][column]) continue;
        const bit = bitIndex < codewords.length * 8
          ? ((codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1) === 1
          : false;
        modules[row][column] = bit !== qrMask(mask, row, column);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  return { modules, reserved };
}

function qrMask(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return (row * column) % 2 + (row * column) % 3 === 0;
    case 6: return ((row * column) % 2 + (row * column) % 3) % 2 === 0;
    default: return ((row + column) % 2 + (row * column) % 3) % 2 === 0;
  }
}

function placeQrFormatBits(modules: boolean[][], mask: number): void {
  const size = modules.length;
  const data = (0b01 << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const value = (index: number) => ((bits >>> index) & 1) === 1;

  for (let index = 0; index <= 5; index += 1) modules[index][8] = value(index);
  modules[7][8] = value(6);
  modules[8][8] = value(7);
  modules[8][7] = value(8);
  for (let index = 9; index < 15; index += 1) modules[8][14 - index] = value(index);
  for (let index = 0; index < 8; index += 1) modules[8][size - 1 - index] = value(index);
  for (let index = 8; index < 15; index += 1) modules[size - 15 + index][8] = value(index);
  modules[size - 8][8] = true;
}

function placeQrVersionBits(modules: boolean[][], version: number): void {
  let remainder = version << 12;
  for (let bit = 17; bit >= 12; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= 0x1f25 << (bit - 12);
  }
  const bits = (version << 12) | remainder;
  const size = modules.length;
  for (let index = 0; index < 18; index += 1) {
    const value = ((bits >>> index) & 1) === 1;
    const a = size - 11 + (index % 3);
    const b = Math.floor(index / 3);
    modules[b][a] = value;
    modules[a][b] = value;
  }
}

function qrPenalty(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;
  for (let row = 0; row < size; row += 1) {
    score += linePenalty(modules[row]);
    score += linePenalty(modules.map((line) => line[row]));
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = modules[row][column];
      if (modules[row][column + 1] === value && modules[row + 1][column] === value && modules[row + 1][column + 1] === value) score += 3;
    }
  }
  const pattern = '1011101';
  const reversePattern = '1011101';
  for (let row = 0; row < size; row += 1) {
    score += finderPenalty(modules[row], pattern, reversePattern);
    score += finderPenalty(modules.map((line) => line[row]), pattern, reversePattern);
  }
  const dark = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

function linePenalty(line: boolean[]): number {
  let score = 0;
  let run = 1;
  for (let index = 1; index < line.length; index += 1) {
    if (line[index] === line[index - 1]) {
      run += 1;
      if (run === 5) score += 3;
      else if (run > 5) score += 1;
    } else run = 1;
  }
  return score;
}

function finderPenalty(line: boolean[], pattern: string, reversePattern: string): number {
  const value = line.map((entry) => entry ? '1' : '0').join('');
  let score = 0;
  for (let index = 0; index <= value.length - 11; index += 1) {
    const window = value.slice(index, index + 11);
    if (window === `0000${pattern}` || window === `${pattern}0000` || window === `1111${reversePattern}` || window === `${reversePattern}1111`) score += 40;
  }
  return score;
}

