/// <reference types="jest" />
import { josa } from '@/engine/josa';
import { isNight } from '@/location/daynight';
import { lookupRegion, regionsInSido, sidoList, TOTAL_REGION_COUNT } from '@/location/regions';
import { cellOf, cellsInsideLoop, haversineM } from '@/run/grid';
import { computeReward, REWARD_RULES } from '@/run/rewards';
import { addPoint, createSession, formatPace, summarize, type RawPoint } from '@/run/session';

describe('josa', () => {
  test('받침 유무에 따라 조사를 고른다', () => {
    expect(josa('마포구', 'eun')).toBe('마포구는');
    expect(josa('양평군', 'eun')).toBe('양평군은');
    expect(josa('서울', 'eul')).toBe('서울을');
    expect(josa('수원시', 'eul')).toBe('수원시를');
    expect(josa('부산', 'i')).toBe('부산이');
    expect(josa('대구', 'wa')).toBe('대구와');
    expect(josa('울산', 'wa')).toBe('울산과');
  });
  test('ㄹ 받침 뒤에는 "로"', () => {
    expect(josa('서울', 'ro')).toBe('서울로');
    expect(josa('인천', 'ro')).toBe('인천으로');
    expect(josa('세종시', 'ro')).toBe('세종시로');
  });
});

describe('구역 판별 (전국)', () => {
  const cases: [string, number, number, string, string][] = [
    ['광화문', 37.5759, 126.9768, '서울', '종로구'],
    ['홍대입구', 37.5571, 126.9245, '서울', '마포구'],
    ['여의도', 37.5219, 126.9245, '서울', '영등포구'],
    ['석촌호수', 37.5097, 127.1038, '서울', '송파구'],
    ['해운대해수욕장', 35.1587, 129.1604, '부산', '해운대구'],
    ['대전 유성온천', 36.3537, 127.3417, '대전', '유성구'],
    ['수원 화성행궁', 37.2819, 127.0136, '수원시', '수원시'],
    ['양평역', 37.4927, 127.4917, '양평군', '양평군'],
    ['제주시청', 33.4996, 126.5312, '제주시', '제주시'],
    ['춘천역', 37.8846, 127.7166, '춘천시', '춘천시'],
  ];
  test.each(cases)('%s', (_name, lat, lon, dome, area) => {
    const r = lookupRegion(lat, lon);
    expect(r.type).toBe('inside');
    if (r.type === 'inside') {
      expect(r.region.dome).toBe(dome);
      expect(r.region.area).toBe(area);
    }
  });

  test('고유 이야기 구역 키', () => {
    const r = lookupRegion(37.5097, 127.1038);
    expect(r.type === 'inside' && r.region.key).toBe('seoul_songpa');
  });

  test('해외는 벽 바깥', () => {
    expect(lookupRegion(35.6812, 139.7671).type).toBe('outside'); // 도쿄
    expect(lookupRegion(40.7128, -74.006).type).toBe('outside'); // 뉴욕
  });

  test('최신 행정구역 이름 반영', () => {
    const names = sidoList();
    expect(names).toContain('강원특별자치도');
    expect(names).toContain('전북특별자치도');
    const daegu = regionsInSido('대구광역시').map((r) => r.area);
    expect(daegu).toContain('군위군');
    const incheon = regionsInSido('인천광역시').map((r) => r.area);
    expect(incheon).toContain('미추홀구');
    expect(incheon).toContain('검단구');
    expect(incheon).not.toContain('남구');
    expect(regionsInSido('충청북도').map((r) => r.area)).not.toContain('청원군');
    expect(TOTAL_REGION_COUNT).toBeGreaterThan(220);
  });

  test('구역 성격 분류', () => {
    const y = lookupRegion(37.4927, 127.4917);
    expect(y.type === 'inside' && y.region.kind).toBe('county');
    const s = lookupRegion(37.2819, 127.0136);
    expect(s.type === 'inside' && s.region.kind).toBe('city');
    const h = lookupRegion(35.1587, 129.1604);
    expect(h.type === 'inside' && h.region.coastal).toBe(true);
  });
});

describe('밤낮', () => {
  test('19시~06시는 밤', () => {
    expect(isNight(new Date(2026, 9, 16, 20, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 16, 5, 59))).toBe(true);
    expect(isNight(new Date(2026, 9, 16, 6, 0))).toBe(false);
    expect(isNight(new Date(2026, 9, 16, 18, 59))).toBe(false);
  });
});

// 석촌호수 둘레를 도는 가상 러닝 경로를 만든다. (중심 37.5097,127.1038, 반지름 약 300m)
function lakeLoop(laps = 1, secPerPoint = 3, speedMps = 3.2, startT = 1_000_000): RawPoint[] {
  const pts: RawPoint[] = [];
  const cLat = 37.5097, cLon = 127.1038, rM = 300;
  const circumference = 2 * Math.PI * rM;
  const stepM = speedMps * secPerPoint;
  const n = Math.round((circumference * laps) / stepM);
  for (let i = 0; i <= n; i++) {
    const a = (i * stepM) / rM;
    const dLat = (rM * Math.sin(a)) / 111320;
    const dLon = (rM * Math.cos(a)) / (111320 * Math.cos((cLat * Math.PI) / 180));
    pts.push({ lat: cLat + dLat, lon: cLon + dLon, accuracy: 8, timestamp: startT + i * secPerPoint * 1000 });
  }
  return pts;
}

describe('러닝 기록', () => {
  test('호수 한 바퀴: 거리, 페이스, 포위', () => {
    const s = createSession(1_000_000);
    const events = lakeLoop(1).flatMap((p) => addPoint(s, p, () => false));
    const sum = summarize(s, s.last!.t);
    expect(sum.km).toBeGreaterThan(1.7);
    expect(sum.km).toBeLessThan(2.1);
    expect(sum.valid).toBe(true);
    expect(sum.loops).toBe(1);
    expect(events.some((e) => e.type === 'loop')).toBe(true);
    // 반지름 300m 원 안쪽 블록(약 110m)은 20칸 이상이어야 한다
    expect(sum.newCells.length).toBeGreaterThan(20);
    // 3.2m/s ≈ 5'13"/km
    expect(sum.paceSec).toBeGreaterThan(300);
    expect(sum.paceSec).toBeLessThan(330);
  });

  test('이미 내 땅인 블록은 새 블록으로 세지 않는다', () => {
    const s = createSession(0);
    for (const p of lakeLoop(1)) addPoint(s, p, () => true);
    expect(summarize(s, Date.now()).newCells.length).toBe(0);
  });

  test('차량 속도 구간은 거리에서 뺀다', () => {
    const s = createSession(0);
    const events: string[] = [];
    // 3초마다 60m (20m/s = 72km/h)
    for (let i = 0; i < 20; i++) {
      for (const e of addPoint(s, { lat: 37.5 + (i * 60) / 111320, lon: 127, accuracy: 5, timestamp: i * 3000 }, () => false)) events.push(e.type);
    }
    expect(s.distanceM).toBe(0);
    expect(events).toContain('vehicle');
  });

  test('가짜 위치와 부정확한 위치는 버린다', () => {
    const s = createSession(0);
    addPoint(s, { lat: 37.5, lon: 127, accuracy: 5, timestamp: 0 }, () => false);
    const ev = addPoint(s, { lat: 37.501, lon: 127, accuracy: 5, timestamp: 30_000, mocked: true }, () => false);
    addPoint(s, { lat: 37.502, lon: 127, accuracy: 200, timestamp: 60_000 }, () => false);
    expect(ev[0]?.type).toBe('mocked');
    expect(s.distanceM).toBe(0);
    expect(s.rejected.mocked).toBe(1);
    expect(s.rejected.accuracy).toBe(1);
  });

  test('신호가 오래 끊긴 구간은 이어 붙이지 않는다', () => {
    const s = createSession(0);
    addPoint(s, { lat: 37.5, lon: 127, accuracy: 5, timestamp: 0 }, () => false);
    addPoint(s, { lat: 37.51, lon: 127, accuracy: 5, timestamp: 600_000 }, () => false); // 10분 뒤 1.1km
    expect(s.distanceM).toBe(0);
  });

  test('1km마다 사건이 발생한다', () => {
    const s = createSession(0);
    const kms = lakeLoop(2).flatMap((p) => addPoint(s, p, () => false)).filter((e) => e.type === 'km');
    expect(kms.length).toBe(3);
  });

  test('페이스 표기', () => {
    expect(formatPace(330)).toBe(`5'30"`);
    expect(formatPace(0)).toBe(`--'--"`);
  });
});

describe('격자', () => {
  test('같은 블록 안의 두 점은 같은 ID', () => {
    expect(cellOf(37.50001, 127.00001)).toBe(cellOf(37.5004, 127.0004));
  });
  test('블록 크기는 약 110m', () => {
    expect(haversineM(37.5, 127, 37.501, 127)).toBeCloseTo(111, 0);
    expect(haversineM(37.5, 127, 37.5, 127.00125)).toBeGreaterThan(100);
  });
  test('작은 사각형 고리 안쪽 블록', () => {
    const sq = [
      { lat: 37.5, lon: 127 },
      { lat: 37.505, lon: 127 },
      { lat: 37.505, lon: 127.00625 },
      { lat: 37.5, lon: 127.00625 },
    ];
    const inside = cellsInsideLoop(sq);
    expect(inside.length).toBeGreaterThanOrEqual(16);
    expect(inside.length).toBeLessThanOrEqual(30);
  });
});

describe('보상', () => {
  const base = { startedAt: 0, endedAt: 1, durationMs: 1, movingMs: 1, paceSec: 330, totalCells: 30, rejectedRatio: 0 };
  test('거리와 새 블록에 비례, 상한 있음', () => {
    const r = computeReward({ ...base, km: 5, newCells: new Array(30).fill('x'), loops: 1, valid: true }, 0);
    expect(r).toEqual({ food: 3, parts: 3, capped: false });
    const small = computeReward({ ...base, km: 0.8, newCells: ['a'], loops: 0, valid: true }, 0);
    expect(small).toEqual({ food: 1, parts: 0, capped: false });
  });
  test('하루 상한을 넘으면 보급 없음', () => {
    const r = computeReward({ ...base, km: 5, newCells: [], loops: 0, valid: true }, REWARD_RULES.dailyRewardedRuns);
    expect(r.capped).toBe(true);
    expect(r.food).toBe(0);
  });
  test('너무 짧은 러닝은 보급 없음', () => {
    expect(computeReward({ ...base, km: 0.1, newCells: [], loops: 0, valid: false }, 0).food).toBe(0);
  });
});
