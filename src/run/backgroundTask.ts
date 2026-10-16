import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type { RawPoint } from './session';

// 화면이 꺼진 상태에서도 러닝 위치를 받기 위한 백그라운드 작업.
// TaskManager.defineTask 는 반드시 모듈 최상단(전역)에서 불려야 하므로 _layout 에서 이 파일을 먼저 import 한다.
// 위치는 기기 안 임시 버퍼에만 쌓이고, 러닝이 끝나면 블록 ID로 바뀐 뒤 지워진다.

export const RUN_TASK = 'borderline-run-location';
export const RUN_BUFFER_KEY = 'borderline-run-buffer';

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
  const prev = await readBuffer();
  // 오래 달려도 버퍼가 무한히 커지지 않게 최근 2만 개만 둔다.
  const next = prev.concat(points).slice(-20000);
  await AsyncStorage.setItem(RUN_BUFFER_KEY, JSON.stringify(next));
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
      } else {
        // 앱이 백그라운드에서 다시 깨어난 경우: 화면이 돌아오면 버퍼에서 읽는다.
        await appendBuffer(points);
      }
    });
  } catch (e) {
    console.warn('[run] defineTask 실패', e);
  }
}
