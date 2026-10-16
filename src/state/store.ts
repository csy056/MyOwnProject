import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RunTotals } from '@/content/radio';
import type { ChoiceView, Page } from '@/engine/storyEngine';
import type { AreaKind } from '@/location/regions';
import type { CellId } from '@/run/grid';
import type { TextSize } from '@/ui/theme';

// 앱 전체 상태. 기기 안(AsyncStorage)에만 저장한다. 서버로 보내는 데이터는 없다.

export type World = {
  route: 'survivor' | 'outsider';
  regionId: string;
  sido: string;
  dome: string;
  area: string;
  kind: AreaKind;
  coastal: boolean;
  key: string;
  source: 'gps' | 'manual';
};

export type Screen = { pages: Page[]; pageIndex: number; choices: ChoiceView[]; ended: boolean; endingId?: string };

export type Save = {
  inkState: string;
  storyVersion?: string; // 저장 당시 스토리 버전. 스토리가 바뀌면 안전하게 옮긴다
  screen: Screen;
  rewind?: { inkState: string; screen: Screen; storyVersion?: string };
  startedAt: number;
};

export type RunRecord = {
  endedAt: number;
  km: number;
  paceSec: number;
  durationMs: number;
  newCells: number;
  loops: number;
  regionArea?: string;
};

export type PendingRun = {
  km: number;
  paceSec: number;
  newCells: number;
  loop: boolean;
  food: number;
  parts: number;
};

type State = {
  // 동의, 온보딩
  ageConfirmed: boolean | null;
  locationConsent: boolean;
  onboarded: boolean;

  world: World | null;
  save: Save | null;

  // 기록
  clues: { title: string; day: number; at: number }[];
  endings: Record<string, number>;
  discovered: Record<string, number>; // regionId -> 처음 발견한 시각 (L3)
  radioRead: Record<string, number>;

  // 러닝
  ownedCells: Record<CellId, 1>;
  totals: RunTotals;
  runHistory: RunRecord[];
  rewardedByDate: Record<string, number>;
  doubledByDate: Record<string, boolean>;
  pendingRun: PendingRun | null;

  // 설정
  textSize: TextSize;
  voiceCues: boolean;
  haptics: boolean;
  adFree: boolean;
};

type Actions = {
  set: (patch: Partial<State>) => void;
  setWorld: (w: World) => void;
  setSave: (s: Save | null) => void;
  addClues: (clues: { title: string; day: number }[]) => void;
  markEnding: (id: string) => void;
  discover: (regionId: string) => boolean;
  markRadioRead: (id: string) => void;
  commitRun: (r: RunRecord, newCells: CellId[], loops: number, pending: PendingRun | null, dateKey: string, rewarded: boolean) => void;
  addPendingReward: (food: number, parts: number) => void;
  consumePendingRun: () => PendingRun | null;
  resetGame: () => void;
  wipeAll: () => void;
};

const initial: State = {
  ageConfirmed: null,
  locationConsent: false,
  onboarded: false,
  world: null,
  save: null,
  clues: [],
  endings: {},
  discovered: {},
  radioRead: {},
  ownedCells: {},
  totals: { runs: 0, km: 0, loops: 0, cells: 0 },
  runHistory: [],
  rewardedByDate: {},
  doubledByDate: {},
  pendingRun: null,
  textSize: 'normal',
  voiceCues: true,
  haptics: true,
  adFree: false,
};

// 저장소 불러오기가 끝났는지(성공이든 실패든). 실패해도 앱은 새 상태로 열린다.
let hydrationSettled = false;
const settledListeners = new Set<() => void>();

export const useGame = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (patch) => set(patch),
      setWorld: (w) => set({ world: w }),
      setSave: (s) => set({ save: s }),
      addClues: (found) => {
        if (found.length === 0) return;
        const have = new Set(get().clues.map((c) => c.title));
        const add: State['clues'] = [];
        for (const c of found) {
          if (have.has(c.title)) continue;
          have.add(c.title);
          add.push({ title: c.title, day: c.day, at: Date.now() });
        }
        if (add.length) set({ clues: [...get().clues, ...add] });
      },
      markEnding: (id) => {
        if (!get().endings[id]) set({ endings: { ...get().endings, [id]: Date.now() } });
      },
      discover: (regionId) => {
        if (get().discovered[regionId]) return false;
        set({ discovered: { ...get().discovered, [regionId]: Date.now() } });
        return true;
      },
      markRadioRead: (id) => {
        if (!get().radioRead[id]) set({ radioRead: { ...get().radioRead, [id]: Date.now() } });
      },
      commitRun: (r, newCells, loops, pending, dateKey, rewarded) => {
        const s = get();
        const owned = { ...s.ownedCells };
        for (const c of newCells) owned[c] = 1;
        set({
          ownedCells: owned,
          totals: {
            runs: s.totals.runs + 1,
            km: Math.round((s.totals.km + r.km) * 100) / 100,
            loops: s.totals.loops + loops,
            cells: Object.keys(owned).length,
          },
          runHistory: [r, ...s.runHistory].slice(0, 50),
          rewardedByDate: rewarded ? { ...s.rewardedByDate, [dateKey]: (s.rewardedByDate[dateKey] ?? 0) + 1 } : s.rewardedByDate,
          // 아직 이야기에 반영하지 않은 원정이 있으면 보급은 더하고, 보고 문구는 최근 원정 기준으로 한다.
          pendingRun: !pending
            ? s.pendingRun
            : s.pendingRun
              ? { ...pending, loop: s.pendingRun.loop || pending.loop, food: s.pendingRun.food + pending.food, parts: s.pendingRun.parts + pending.parts }
              : pending,
        });
      },
      addPendingReward: (food, parts) => {
        const p = get().pendingRun;
        if (p) set({ pendingRun: { ...p, food: p.food + food, parts: p.parts + parts } });
      },
      consumePendingRun: () => {
        const p = get().pendingRun;
        if (p) set({ pendingRun: null });
        return p;
      },
      resetGame: () => set({ save: null }),
      // 결제 항목(광고 제거)은 계정에 묶인 구매이므로 초기화해도 남긴다.
      wipeAll: () => set({ ...initial, adFree: get().adFree }),
    }),
    {
      name: 'borderline-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('[store] 저장된 데이터를 불러오지 못했습니다', error);
        hydrationSettled = true;
        for (const fn of settledListeners) fn();
        settledListeners.clear();
      },
    },
  ),
);


export function isHydrationSettled(): boolean {
  return hydrationSettled || useGame.persist.hasHydrated();
}

export function onHydrationSettled(fn: () => void): () => void {
  if (isHydrationSettled()) {
    fn();
    return () => {};
  }
  settledListeners.add(fn);
  return () => settledListeners.delete(fn);
}
