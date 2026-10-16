/// <reference types="jest" />
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { choose, currentStats, ensureLoaded, getEngine, rewindLastChoice, STORY_VERSION, startNewGame, unloadEngine } from '@/engine/gameSession';
import { lookupRegion } from '@/location/regions';
import { addPoint, createSession, formatPace, summarize, type RawPoint } from '@/run/session';
import { useGame, type World } from '@/state/store';

// 코드 리뷰에서 찾은 결함이 다시 생기지 않게 막는 테스트

const M_LAT = 111320;
const mLon = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** 중심에서 반지름 rM 인 원을 따라 달리는 점들. from~to 는 한 바퀴 비율(0~1) */
function arc(c: { lat: number; lon: number }, rM: number, from: number, to: number, t0: number, speed = 3.2, every = 3): RawPoint[] {
  const pts: RawPoint[] = [];
  const total = 2 * Math.PI * rM * (to - from);
  const n = Math.max(1, Math.round(total / (speed * every)));
  for (let i = 0; i <= n; i++) {
    const a = 2 * Math.PI * (from + ((to - from) * i) / n);
    pts.push({ lat: c.lat + (rM * Math.sin(a)) / M_LAT, lon: c.lon + (rM * Math.cos(a)) / mLon(c.lat), accuracy: 8, timestamp: t0 + i * every * 1000 });
  }
  return pts;
}

const C = { lat: 37.5097, lon: 127.1038 };

describe('러닝 세션 회귀', () => {
  test('신호 대기로 90초 멈춰도 고리가 닫힌다', () => {
    const s = createSession(0);
    const first = arc(C, 300, 0, 0.5, 0);
    const lastT = first[first.length - 1].timestamp;
    const stopAt = first[first.length - 1];
    const second = arc(C, 300, 0.5, 1.02, lastT + 90_000);
    for (const p of first) addPoint(s, p, () => false);
    addPoint(s, { ...stopAt, timestamp: lastT + 89_000 }, () => false); // 제자리
    for (const p of second) addPoint(s, p, () => false);
    expect(s.loops).toBe(1);
  });

  test('한 번 튄 GPS 점은 고리를 망가뜨리지 않는다', () => {
    const s = createSession(0);
    const pts = arc(C, 300, 0, 1.02, 0);
    const mid = Math.floor(pts.length / 2);
    pts.splice(mid, 0, { ...pts[mid], lat: pts[mid].lat + 0.003, timestamp: pts[mid].timestamp - 1000 }); // 330m 튐
    for (const p of pts) addPoint(s, p, () => false);
    expect(s.loops).toBe(1);
    expect(s.rejected.speed).toBeGreaterThanOrEqual(1);
  });

  test('제자리 GPS 떨림은 거리로 세지 않는다', () => {
    const s = createSession(0);
    for (let i = 0; i < 600; i++) {
      const j = ((i * 7919) % 13) - 6; // -6~+6m 흔들림
      addPoint(s, { lat: C.lat + j / M_LAT, lon: C.lon + ((i * 31) % 11 - 5) / mLon(C.lat), accuracy: 12, timestamp: i * 2000 }, () => false);
    }
    expect(summarize(s, 1_200_000).valid).toBe(false);
  });

  test('짧은 왕복 뒤에도 큰 고리는 닫힌다', () => {
    const s = createSession(0);
    const out = arc(C, 300, 0, 0.25, 0);
    let t = out[out.length - 1].timestamp;
    const p0 = out[out.length - 1];
    // 바깥으로 200m 나갔다가 같은 길로 돌아온다 (왕복 400m)
    const detour: RawPoint[] = [];
    for (let i = 1; i <= 20; i++) detour.push({ lat: p0.lat + (i * 10) / M_LAT, lon: p0.lon, accuracy: 8, timestamp: (t += 3000) });
    for (let i = 19; i >= 0; i--) detour.push({ lat: p0.lat + (i * 10) / M_LAT, lon: p0.lon, accuracy: 8, timestamp: (t += 3000) });
    const rest = arc(C, 300, 0.25, 1.02, t + 3000);
    for (const p of [...out, ...detour, ...rest]) addPoint(s, p, () => false);
    expect(s.loops).toBe(1);
  });

  test('페이스 반올림이 60초를 넘지 않는다', () => {
    expect(formatPace(359.6)).toBe(`6'00"`);
    expect(formatPace(299.5)).toBe(`5'00"`);
  });
});

describe('구역 판별 회귀', () => {
  test('백령도는 옹진군이다', () => {
    const r = lookupRegion(37.9687, 124.6667);
    expect(r.type).toBe('inside');
    if (r.type === 'inside') expect(r.region.area).toBe('옹진군');
  });
});

const WORLD: World = { route: 'survivor', regionId: '11:마포구', sido: '서울특별시', dome: '서울', area: '마포구', kind: 'metro', coastal: false, key: 'seoul_mapo', source: 'manual' };

describe('저장과 보급 회귀', () => {
  beforeEach(() => {
    unloadEngine();
    useGame.getState().wipeAll();
    useGame.getState().setWorld(WORLD);
  });

  test('이야기를 열기 전 두 번 달리면 보급이 합쳐진다', () => {
    const g = useGame.getState();
    const rec = { endedAt: 1, km: 2, paceSec: 330, durationMs: 1, newCells: 3, loops: 0 };
    g.commitRun(rec, ['1:1'], 0, { km: 2, paceSec: 330, newCells: 3, loop: false, food: 2, parts: 1 }, 'd', true);
    g.commitRun(rec, ['1:2'], 1, { km: 3, paceSec: 300, newCells: 5, loop: true, food: 2, parts: 2 }, 'd', true);
    const p = useGame.getState().pendingRun!;
    expect(p.food).toBe(4);
    expect(p.parts).toBe(3);
    expect(p.km).toBe(3); // 보고는 최근 원정 기준
  });

  test('스토리 버전이 바뀐 저장은 상태를 지키고 허브로 옮긴다', () => {
    startNewGame(WORLD);
    // 허브까지 진행
    for (let i = 0; i < 200; i++) {
      const s = useGame.getState().save!.screen;
      if (s.pages[s.pages.length - 1]?.hub && s.pageIndex === s.pages.length - 1) break;
      if (s.pageIndex < s.pages.length - 1) {
        useGame.getState().setSave({ ...useGame.getState().save!, screen: { ...s, pageIndex: s.pageIndex + 1 } });
        continue;
      }
      require('@/engine/gameSession').choose(s.choices[0].index);
    }
    const before = currentStats()!;
    const save = useGame.getState().save!;
    useGame.getState().setSave({ ...save, storyVersion: 'old-version' });
    unloadEngine();
    expect(ensureLoaded()).toBe(true);
    const after = currentStats()!;
    expect(after.hp).toBe(before.hp);
    expect(after.food).toBe(before.food);
    expect(after.day).toBe(before.day);
    const s = useGame.getState().save!;
    expect(s.storyVersion).toBe(STORY_VERSION);
    expect(s.screen.pages[s.screen.pages.length - 1].hub).toBe(true);
  });

  test('체력이 바닥난 선택에서 바로 엔딩이 나고, 되감기는 그 선택 직전으로 간다', () => {
    startNewGame(WORLD);
    for (let i = 0; i < 200; i++) {
      const s = useGame.getState().save!.screen;
      if (s.pages[s.pages.length - 1]?.hub && s.pageIndex === s.pages.length - 1) break;
      if (s.pageIndex < s.pages.length - 1) {
        useGame.getState().setSave({ ...useGame.getState().save!, screen: { ...s, pageIndex: s.pageIndex + 1 } });
        continue;
      }
      choose(s.choices[0].index);
    }
    const hub = useGame.getState().save!.screen;
    getEngine()!.setVar('hp', 0);
    getEngine()!.setVar('food', 0);
    const explore = hub.choices.find((c) => c.text.includes('탐색'))!;
    choose(explore.index);
    const after = useGame.getState().save!.screen;
    expect(after.ended).toBe(true);
    expect(after.endingId).toBe('death');
    expect(rewindLastChoice()).toBe(true);
    const back = useGame.getState().save!.screen;
    expect(back.ended).toBe(false);
    expect(back.choices.map((c) => c.text)).toEqual(hub.choices.map((c) => c.text));
  });

  test('읽을 수 없는 저장도 앱을 멈추지 않는다', () => {
    startNewGame(WORLD);
    const save = useGame.getState().save!;
    useGame.getState().setSave({ ...save, inkState: '{"broken":', storyVersion: STORY_VERSION });
    unloadEngine();
    expect(() => ensureLoaded()).not.toThrow();
    expect(useGame.getState().save).not.toBeNull();
  });

  test('초기화해도 구매 내역은 남는다', () => {
    useGame.getState().set({ adFree: true });
    useGame.getState().wipeAll();
    expect(useGame.getState().adFree).toBe(true);
  });
});
