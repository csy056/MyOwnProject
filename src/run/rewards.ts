import type { RunSummary } from './session';

// 러닝 보상. 메인 스토리를 막지 않는 "플러스 알파"이므로 하루 상한을 둔다.
export const REWARD_RULES = {
  dailyRewardedRuns: 2, // 하루에 보상을 받는 러닝 횟수
  maxFood: 3,
  maxParts: 3,
} as const;

export type RunReward = { food: number; parts: number; capped: boolean };

export function computeReward(summary: RunSummary, rewardedRunsToday: number): RunReward {
  if (!summary.valid) return { food: 0, parts: 0, capped: false };
  if (rewardedRunsToday >= REWARD_RULES.dailyRewardedRuns) return { food: 0, parts: 0, capped: true };
  const food = Math.min(REWARD_RULES.maxFood, 1 + Math.floor(summary.km / 2));
  const parts = Math.min(REWARD_RULES.maxParts, Math.floor(summary.newCells.length / 12) + (summary.loops > 0 ? 1 : 0));
  return { food, parts, capped: false };
}

export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
