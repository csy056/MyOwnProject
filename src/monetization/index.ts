import { create } from 'zustand';

import { useGame } from '@/state/store';

// 광고와 인앱 결제를 감싸는 층.
// 지금은 계정·SDK가 없으므로 "시뮬레이션 제공자"가 화면 안 모달로 흉내 낸다.
// 실제 출시 때는 MonetizationProvider 를 AdMob / 스토어 결제 구현으로 바꾼다. (docs/03-tech-design.md 참고)

export type AdPlacement = 'rewind' | 'run_double';
export type ProductId = 'remove_ads' | 'supporter_pack';

export const PRODUCTS: Record<ProductId, { title: string; price: string; description: string }> = {
  remove_ads: { title: '광고 제거', price: '₩3,900', description: '보상형 광고를 보지 않고 바로 보상을 받습니다.' },
  supporter_pack: { title: '후원자 팩', price: '₩9,900', description: '광고 제거 + 엔딩 크레딧에 선꾼 이름 등재 (출시 후 반영).' },
};

export interface MonetizationProvider {
  showRewardedAd(placement: AdPlacement): Promise<boolean>;
  purchase(product: ProductId): Promise<boolean>;
}

// ---- 시뮬레이션 제공자: 모달 상태 ----
type SimRequest =
  | { kind: 'ad'; placement: AdPlacement; resolve: (ok: boolean) => void }
  | { kind: 'purchase'; product: ProductId; resolve: (ok: boolean) => void };

export const useSimulator = create<{ request: SimRequest | null; setRequest: (r: SimRequest | null) => void }>((set) => ({
  request: null,
  setRequest: (r) => set({ request: r }),
}));

const simulatedProvider: MonetizationProvider = {
  showRewardedAd: (placement) =>
    new Promise((resolve) => useSimulator.getState().setRequest({ kind: 'ad', placement, resolve })),
  purchase: (product) =>
    new Promise((resolve) => useSimulator.getState().setRequest({ kind: 'purchase', product, resolve })),
};

let provider: MonetizationProvider = simulatedProvider;

export function setMonetizationProvider(p: MonetizationProvider) {
  provider = p;
}

/** 보상형 광고. 광고 제거를 산 사용자는 광고 없이 바로 보상을 받는다. */
export async function watchRewardedAd(placement: AdPlacement): Promise<boolean> {
  if (useGame.getState().adFree) return true;
  return provider.showRewardedAd(placement);
}

export async function buy(product: ProductId): Promise<boolean> {
  const ok = await provider.purchase(product);
  if (ok) useGame.getState().set({ adFree: true });
  return ok;
}
