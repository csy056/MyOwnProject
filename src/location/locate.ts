import * as Location from 'expo-location';

import { lookupRegion, type LookupResult } from './regions';

// 현재 위치를 한 번 읽어 구역으로만 바꾼다. 좌표는 이 함수 밖으로 나가지 않는다.

export type LocateResult =
  | { status: 'ok'; result: LookupResult }
  | { status: 'denied' }
  | { status: 'unavailable'; message: string };

export async function requestForegroundPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function hasForegroundPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** 권한이 막혀 다시 물을 수 없는 상태인가 (그때는 기기 설정에서 켜야 한다) */
export async function isPermissionBlocked(): Promise<boolean> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.status !== 'granted' && p.canAskAgain === false;
  } catch {
    return false;
  }
}

export async function locateRegion(opts: { request?: boolean } = {}): Promise<LocateResult> {
  let granted = await hasForegroundPermission();
  if (!granted && opts.request) granted = await requestForegroundPermission();
  if (!granted) return { status: 'denied' };
  try {
    // 구역 판별에는 낮은 정확도로 충분하다. 최근 위치가 있으면 그걸 쓴다.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }).catch(() => null);
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const result = lookupRegion(pos.coords.latitude, pos.coords.longitude);
    return { status: 'ok', result };
  } catch (e) {
    return { status: 'unavailable', message: e instanceof Error ? e.message : String(e) };
  }
}
