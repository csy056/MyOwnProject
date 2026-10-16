import rawRegions from '@/data/regions.json';

// 전국 시·군·구 구역 데이터 (scripts/build-regions.mjs 로 생성).
// 좌표는 기기 안에서 구역을 찾는 데만 쓰고 저장하거나 전송하지 않는다.

export type AreaKind = 'metro' | 'city' | 'county';

export type Region = {
  id: string; // "시도코드:구역이름"
  sido: string; // 서울특별시, 경기도 ...
  dome: string; // 갇힌 벽의 이름: 서울, 수원시, 양평군 ...
  area: string; // 거점 구역 이름: 마포구, 수원시 ...
  kind: AreaKind;
  coastal: boolean;
  key: string; // 고유 이벤트 구역 키, 없으면 ''
  center: [number, number]; // [경도, 위도]
};

type RawRegion = Region & { bbox: [number, number, number, number]; rings: number[][] };

const RAW = rawRegions as unknown as RawRegion[];

export const REGIONS: Region[] = RAW.map(({ bbox: _b, rings: _r, ...r }) => r);

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

// 대한민국 대략 범위 (이 밖이면 "벽 바깥" = 외부인)
const KOREA_BBOX = { minLon: 124.5, minLat: 33.0, maxLon: 131.9, maxLat: 38.65 };
// 경계 단순화로 해안선 근처 점이 어느 구역에도 안 들어갈 수 있어, 이 거리 안이면 가장 가까운 구역으로 본다.
const SNAP_KM = 12;

export function regionById(id: string): Region | undefined {
  if (id === '23:검단구') return GEOMDAN;
  return BY_ID.get(id);
}

// 2026년 인천 서구에서 분리된 검단구 (경계 데이터가 없어 위도로 근사)
const SEO_GU = BY_ID.get('23:서구');
const GEOMDAN: Region | undefined = SEO_GU
  ? { ...SEO_GU, id: '23:검단구', area: '검단구', center: [126.67, 37.6] }
  : undefined;

function pointInRing(lon: number, lat: number, ring: number[]): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2], yi = ring[i * 2 + 1];
    const xj = ring[j * 2], yj = ring[j * 2 + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRegion(lon: number, lat: number, r: RawRegion): boolean {
  const [minX, minY, maxX, maxY] = r.bbox;
  if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false;
  // 여러 다각형과 구멍을 짝홀 규칙으로 처리한다.
  let inside = false;
  for (const ring of r.rings) if (pointInRing(lon, lat, ring)) inside = !inside;
  return inside;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestVertexKm(lon: number, lat: number, r: RawRegion): number {
  let best = Infinity;
  for (const ring of r.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      const d = distanceKm(lat, lon, ring[i + 1], ring[i]);
      if (d < best) best = d;
    }
  }
  return best;
}

function adjust(r: RawRegion, lat: number): Region {
  if (r.id === '23:서구' && lat > 37.57 && GEOMDAN) return GEOMDAN;
  return BY_ID.get(r.id)!;
}

export type LookupResult =
  | { type: 'inside'; region: Region }
  | { type: 'outside' };

/** 위경도로 구역을 찾는다. 대한민국 밖이면 outside. */
export function lookupRegion(lat: number, lon: number): LookupResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { type: 'outside' };
  for (const r of RAW) if (inRegion(lon, lat, r)) return { type: 'inside', region: adjust(r, lat) };

  const inBox = lon >= KOREA_BBOX.minLon && lon <= KOREA_BBOX.maxLon && lat >= KOREA_BBOX.minLat && lat <= KOREA_BBOX.maxLat;
  if (!inBox) return { type: 'outside' };

  let best: RawRegion | null = null;
  let bestKm = Infinity;
  // 구역 경계 상자를 SNAP_KM 만큼 넓혀 그 안에 드는 구역만 본다. (섬처럼 중심에서 먼 곳도 놓치지 않는다)
  const mLat = SNAP_KM / 111;
  const mLon = SNAP_KM / (111 * Math.cos((lat * Math.PI) / 180));
  for (const r of RAW) {
    const [minX, minY, maxX, maxY] = r.bbox;
    if (lon < minX - mLon || lon > maxX + mLon || lat < minY - mLat || lat > maxY + mLat) continue;
    const d = nearestVertexKm(lon, lat, r);
    if (d < bestKm) {
      bestKm = d;
      best = r;
    }
  }
  if (best && bestKm <= SNAP_KM) return { type: 'inside', region: adjust(best, lat) };
  return { type: 'outside' };
}

/** 시·도 목록 (직접 선택 화면용) */
export function sidoList(): string[] {
  return [...new Set(REGIONS.map((r) => r.sido))];
}

export function regionsInSido(sido: string): Region[] {
  const list = REGIONS.filter((r) => r.sido === sido);
  if (sido === '인천광역시' && GEOMDAN) list.push(GEOMDAN);
  return list.sort((a, b) => a.area.localeCompare(b.area, 'ko'));
}

export const TOTAL_REGION_COUNT = REGIONS.length + (GEOMDAN ? 1 : 0);

/** 외부인 루트의 기본 진입 구역 */
export const DEFAULT_OUTSIDER_REGION_ID = '11:종로구';
