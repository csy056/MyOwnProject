// 땅따먹기 격자. 위도 0.001° × 경도 0.00125° ≈ 한국에서 약 110m × 110m 블록.
// 블록 ID만 기기에 저장한다. 원래 좌표는 러닝이 끝나면 버린다.

export const LAT_STEP = 0.001;
export const LON_STEP = 0.00125;

export type CellId = string; // "row:col"

export function cellOf(lat: number, lon: number): CellId {
  return `${Math.floor(lat / LAT_STEP)}:${Math.floor(lon / LON_STEP)}`;
}

export function parseCell(id: CellId): { row: number; col: number } {
  const [r, c] = id.split(':');
  return { row: Number(r), col: Number(c) };
}

export function cellCenter(row: number, col: number): { lat: number; lon: number } {
  return { lat: (row + 0.5) * LAT_STEP, lon: (col + 0.5) * LON_STEP };
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 두 점 사이를 일정 간격으로 나눠 지나간 블록을 모두 구한다. */
export function cellsAlongSegment(lat1: number, lon1: number, lat2: number, lon2: number, stepM = 20): CellId[] {
  const d = haversineM(lat1, lon1, lat2, lon2);
  const n = Math.max(1, Math.ceil(d / stepM));
  const out = new Set<CellId>();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.add(cellOf(lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t));
  }
  return [...out];
}

type Pt = { lat: number; lon: number };

function pointInPolygon(lat: number, lon: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.lat > lat !== b.lat > lat && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

/** 닫힌 고리 안쪽의 블록을 구한다. 너무 큰 고리는 maxCells 에서 자른다. */
export function cellsInsideLoop(loop: Pt[], maxCells = 600): CellId[] {
  if (loop.length < 3) return [];
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of loop) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
  }
  const r0 = Math.floor(minLat / LAT_STEP), r1 = Math.floor(maxLat / LAT_STEP);
  const c0 = Math.floor(minLon / LON_STEP), c1 = Math.floor(maxLon / LON_STEP);
  const out: CellId[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const { lat, lon } = cellCenter(r, c);
      if (pointInPolygon(lat, lon, loop)) {
        out.push(`${r}:${c}`);
        if (out.length >= maxCells) return out;
      }
    }
  }
  return out;
}
