/// <reference types="jest" />
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { applyPendingRun, choose, currentStats, ensureLoaded, nextPage, rewindLastChoice, startNewGame, unloadEngine } from '@/engine/gameSession';
import { useGame, type World } from '@/state/store';

const WORLD: World = {
  route: 'survivor',
  regionId: '11:마포구',
  sido: '서울특별시',
  dome: '서울',
  area: '마포구',
  kind: 'metro',
  coastal: false,
  key: 'seoul_mapo',
  source: 'manual',
};

function screen() {
  return useGame.getState().save!.screen;
}

/** 허브에 닿을 때까지 첫 번째 선택지로 진행한다. */
function playToHub(max = 200) {
  for (let i = 0; i < max; i++) {
    const s = screen();
    if (s.ended) return false;
    if (s.pageIndex < s.pages.length - 1) {
      nextPage();
      continue;
    }
    if (s.pages[s.pages.length - 1]?.hub) return true;
    choose(s.choices[0].index);
  }
  return false;
}

beforeEach(() => {
  unloadEngine();
  useGame.getState().wipeAll();
  useGame.getState().setWorld(WORLD);
});

describe('게임 세션', () => {
  test('새 게임을 시작하면 저장되고 허브까지 갈 수 있다', () => {
    startNewGame(WORLD);
    expect(useGame.getState().save).not.toBeNull();
    expect(playToHub()).toBe(true);
  });

  test('러닝 결과가 들어오면 허브에 원정 보고가 생기고 보급이 늘어난다', () => {
    startNewGame(WORLD);
    expect(playToHub()).toBe(true);
    const before = currentStats()!;
    useGame.getState().commitRun(
      { endedAt: Date.now(), km: 3.1, paceSec: 340, durationMs: 1_000_000, newCells: 25, loops: 1 },
      ['1:1', '1:2'],
      1,
      { km: 3.1, paceSec: 340, newCells: 25, loop: true, food: 2, parts: 3 },
      '2026-10-16',
      true,
    );
    applyPendingRun();
    const after = currentStats()!;
    expect(after.food).toBe(before.food + 2);
    expect(after.parts).toBe(before.parts + 3);
    const s = screen();
    expect(s.choices.some((c) => c.text.includes('원정 보고'))).toBe(true);
    expect(useGame.getState().pendingRun).toBeNull();
  });

  test('아직 읽지 않은 장 뒤의 허브도 원정 보고를 반영한다', () => {
    startNewGame(WORLD);
    // 프롤로그 첫 화면에서 바로 러닝을 다녀온 경우
    useGame.getState().set({ pendingRun: { km: 1, paceSec: 400, newCells: 3, loop: false, food: 1, parts: 0 } });
    applyPendingRun();
    expect(playToHub()).toBe(true);
    expect(screen().choices.some((c) => c.text.includes('원정 보고'))).toBe(true);
  });

  test('엔진을 다시 불러와도 같은 화면이 이어진다', () => {
    startNewGame(WORLD);
    playToHub();
    const choicesBefore = screen().choices.map((c) => c.text);
    unloadEngine();
    expect(ensureLoaded()).toBe(true);
    expect(screen().choices.map((c) => c.text)).toEqual(choicesBefore);
  });

  test('되감기는 마지막 선택 직전으로 돌아가고 자원을 조금 채운다', () => {
    startNewGame(WORLD);
    playToHub();
    const s = screen();
    const before = currentStats()!;
    choose(s.choices[s.choices.length - 1].index);
    expect(useGame.getState().save!.rewind).toBeDefined();
    expect(rewindLastChoice()).toBe(true);
    const after = currentStats()!;
    expect(after.day).toBe(before.day);
    expect(after.food).toBe(before.food + 2);
    expect(screen().choices.map((c) => c.text)).toEqual(s.choices.map((c) => c.text));
  });
});
