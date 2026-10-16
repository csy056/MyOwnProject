import type { RawPoint } from './session';

// 다른 러닝 앱(Strava, Garmin, COROS 등)에서 내보낸 GPX 파일을 읽는다.
// 좌표는 기기 안에서 블록으로 바뀐 뒤 버려진다. 실시간 기록과 같은 치트 필터와 하루 상한을 거친다.

export const IMPORT_RULES = {
  maxAgeHours: 72, // 이보다 오래된 기록은 받지 않는다 (지난 기록을 반복해서 넣지 못하게)
  maxDurationHours: 12,
  minPoints: 10,
} as const;

function attr(tag: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  return m ? Number(m[1]) : NaN;
}

/** GPX 문자열에서 시간이 있는 경로점을 뽑는다. 트랙점(trkpt)이 없으면 경로점(rtept)을 쓴다. */
export function parseGpx(xml: string): RawPoint[] {
  const pts: RawPoint[] = [];
  const re = /<(trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const lat = attr(m[2], 'lat');
    const lon = attr(m[2], 'lon');
    const t = /<time>([^<]+)<\/time>/.exec(m[3]);
    const ts = t ? Date.parse(t[1].trim()) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    pts.push({ lat, lon, accuracy: null, timestamp: ts });
  }
  return pts;
}

export type ImportCheck =
  | { ok: true; points: RawPoint[]; startedAt: number; endedAt: number; key: string }
  | { ok: false; reason: string };

/** 가져올 수 있는 기록인지 확인한다. imported: 이미 가져온 기록의 시작 시각 키 */
export function checkImport(points: RawPoint[], now: number, imported: Record<string, number>): ImportCheck {
  if (points.length < IMPORT_RULES.minPoints) return { ok: false, reason: '경로점이 너무 적습니다. 운동 기록을 GPX로 내보낸 파일인지 확인해 주세요.' };
  if (points.some((p) => !Number.isFinite(p.timestamp))) return { ok: false, reason: '시간 정보가 없는 경로입니다. 계획한 코스가 아니라 실제로 달린 기록을 내보내 주세요.' };
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const startedAt = sorted[0].timestamp;
  const endedAt = sorted[sorted.length - 1].timestamp;
  if (endedAt > now + 10 * 60 * 1000) return { ok: false, reason: '기록 시간이 미래입니다. 기기 시계를 확인해 주세요.' };
  if (now - endedAt > IMPORT_RULES.maxAgeHours * 3600 * 1000) return { ok: false, reason: `최근 ${IMPORT_RULES.maxAgeHours}시간 안에 끝난 기록만 가져올 수 있습니다.` };
  if (endedAt - startedAt > IMPORT_RULES.maxDurationHours * 3600 * 1000) return { ok: false, reason: '12시간이 넘는 기록은 가져올 수 없습니다.' };
  const key = String(Math.round(startedAt / 1000));
  if (imported[key]) return { ok: false, reason: '이미 가져온 기록입니다.' };
  return { ok: true, points: sorted, startedAt, endedAt, key };
}
