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
  screen: Screen;
  rewind?: { inkState: string; screen: Screen };
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
  addClues: (titles: string[], day: number) => void;
  markEnding: (id: string) => void;
  discover: (regionId: string) => boolean;
  markRadioRead: (id: string) => void;
  commitRun: (r: RunRecord, newCells: CellId[], loops: number, pending: PendingRun | null, dateKey: string, rewarded: boolean) => void;
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

export const useGame = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (patch) => set(patch),
      setWorld: (w) => set({ world: w }),
      setSave: (s) => set({ save: s }),
      addClues: (titles, day) => {
        if (titles.length === 0) return;
        const have = new Set(get().clues.map((c) => c.title));
        const add = titles.filter((t) => !have.has(t)).map((title) => ({ title, day, at: Date.now() }));
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
          pendingRun: pending ?? s.pendingRun,
        });
      },
      consumePendingRun: () => {
        const p = get().pendingRun;
        if (p) set({ pendingRun: null });
        return p;
      },
      resetGame: () => set({ save: null }),
      wipeAll: () => set({ ...initial }),
    }),
    {
      name: 'borderline-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** 저장소에서 상태를 다 불러왔는지 */
export function useHydrated(): boolean {
  return useGame.persist?.hasHydrated?.() ?? true;
}
