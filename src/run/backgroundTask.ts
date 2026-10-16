import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type { RawPoint } from './session';

// 화면이 꺼진 상태에서도 러닝 위치를 받기 위한 백그라운드 작업.
// TaskManager.defineTask 는 반드시 모듈 최상단(전역)에서 불려야 하므로 _layout 에서 이 파일을 먼저 import 한다.
// 위치는 기기 안 임시 버퍼에만 쌓이고, 러닝이 끝나면 블록 ID로 바뀐 뒤 지워진다.

export const RUN_TASK = 'borderline-run-location';
export const RUN_BUFFER_KEY = 'borderline-run-buffer';
export const RUN_ACTIVE_KEY = 'borderline-run-active';
// Android AsyncStorage 한 칸은 약 2MB가 한계다. 점 하나가 약 120B이므로 8천 개(약 1MB, 2초 간격이면 4시간 반)로 둔다.
const BUFFER_MAX = 8000;

type Listener = (points: RawPoint[]) => void;
const listeners = new Set<Listener>();

export function subscribeRunPoints(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toRawPoint(l: LocationObject): RawPoint {
  return {
    lat: l.coords.latitude,
    lon: l.coords.longitude,
    accuracy: l.coords.accuracy ?? null,
    timestamp: l.timestamp,
    mocked: l.mocked === true,
  };
}

export async function readBuffer(): Promise<RawPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_BUFFER_KEY);
    return raw ? (JSON.parse(raw) as RawPoint[]) : [];
  } catch {
    return [];
  }
}

export async function clearBuffer() {
  await AsyncStorage.removeItem(RUN_BUFFER_KEY).catch(() => {});
}

async function appendBuffer(points: RawPoint[]) {
  let prev: RawPoint[] = [];
  try {
    const raw = await AsyncStorage.getItem(RUN_BUFFER_KEY);
    prev = raw ? (JSON.parse(raw) as RawPoint[]) : [];
  } catch {
    // 읽지 못하면 기존 값을 덮어쓰지 않는다.
    return;
  }
  const next = prev.concat(points).slice(-BUFFER_MAX);
  await AsyncStorage.setItem(RUN_BUFFER_KEY, JSON.stringify(next)).catch(() => {});
}

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(RUN_TASK, async ({ data, error }) => {
      if (error || !data) return;
      const { locations } = data as { locations?: LocationObject[] };
      if (!locations?.length) return;
      const points = locations.map(toRawPoint);
      if (listeners.size > 0) {
        for (const fn of listeners) fn(points);
        return;
      }
      // 화면이 없는 상태(앱이 백그라운드에서 다시 깨어남). 진행 중인 러닝이 아니면 작업을 멈춘다.
      const active = await AsyncStorage.getItem(RUN_ACTIVE_KEY).catch(() => null);
      if (!active) {
        await Location.stopLocationUpdatesAsync(RUN_TASK).catch(() => {});
        return;
      }
      // 너무 오래된 러닝(12시간 이상)은 잊은 것으로 보고 멈춘다.
      if (Date.now() - Number(active) > 12 * 3600 * 1000) {
        await Location.stopLocationUpdatesAsync(RUN_TASK).catch(() => {});
        await AsyncStorage.removeItem(RUN_ACTIVE_KEY).catch(() => {});
        await clearBuffer();
        return;
      }
      await appendBuffer(points);
    });
  } catch (e) {
    console.warn('[run] defineTask 실패', e);
  }
}
