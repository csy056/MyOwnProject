/// <reference types="jest" />
import { checkImport, parseGpx } from '@/run/gpx';
import { addPoint, createSession, summarize } from '@/run/session';

/** 석촌호수 둘레(반지름 300m)를 달린 GPX를 만든다. */
function lakeGpx(endMsAgo: number, now: number, withTime = true): string {
  const cLat = 37.5097, cLon = 127.1038, rM = 300, speed = 3.2, every = 3;
  const n = Math.round((2 * Math.PI * rM * 1.03) / (speed * every));
  const start = now - endMsAgo - n * every * 1000;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * speed * every) / rM;
    const lat = cLat + (rM * Math.sin(a)) / 111320;
    const lon = cLon + (rM * Math.cos(a)) / (111320 * Math.cos((cLat * Math.PI) / 180));
    const time = withTime ? `<time>${new Date(start + i * every * 1000).toISOString()}</time>` : '';
    pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>20</ele>${time}</trkpt>`);
  }
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Morning Run</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

describe('GPX 가져오기', () => {
  const now = Date.UTC(2026, 9, 17, 0, 0, 0);

  test('경로점과 시간을 읽는다', () => {
    const pts = parseGpx(lakeGpx(3600_000, now));
    expect(pts.length).toBeGreaterThan(100);
    expect(Number.isFinite(pts[0].timestamp)).toBe(true);
    expect(pts[0].lat).toBeCloseTo(37.5097, 3);
  });

  test('가져온 기록도 같은 규칙으로 고리를 닫는다', () => {
    const check = checkImport(parseGpx(lakeGpx(3600_000, now)), now, {});
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const s = createSession(check.startedAt);
    for (const p of check.points) addPoint(s, p, () => false);
    const sum = summarize(s, check.endedAt);
    expect(sum.valid).toBe(true);
    expect(sum.loops).toBe(1);
    expect(sum.km).toBeGreaterThan(1.8);
    expect(sum.paceSec).toBeGreaterThan(290);
  });

  test('72시간보다 오래된 기록은 받지 않는다', () => {
    const check = checkImport(parseGpx(lakeGpx(80 * 3600_000, now)), now, {});
    expect(check.ok).toBe(false);
  });

  test('같은 기록은 두 번 가져오지 못한다', () => {
    const first = checkImport(parseGpx(lakeGpx(3600_000, now)), now, {});
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = checkImport(parseGpx(lakeGpx(3600_000, now)), now, { [first.key]: now });
    expect(again.ok).toBe(false);
  });

  test('시간이 없는 경로(계획 코스)는 받지 않는다', () => {
    expect(checkImport(parseGpx(lakeGpx(3600_000, now, false)), now, {}).ok).toBe(false);
  });

  test('GPX가 아닌 파일은 받지 않는다', () => {
    expect(checkImport(parseGpx('hello'), now, {}).ok).toBe(false);
  });
});
