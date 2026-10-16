import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { clearBuffer, readBuffer, RUN_TASK, subscribeRunPoints, toRawPoint } from './backgroundTask';
import type { RawPoint } from './session';

// 러닝 위치 수집. 가능하면 백그라운드(화면 꺼도 기록), 안 되면 포그라운드(화면 켜 둠)로 동작한다.
// Expo Go 와 웹에서는 백그라운드 작업이 지원되지 않아 포그라운드로 동작한다.

export type TrackerMode = 'background' | 'foreground';
export type Tracker = { mode: TrackerMode; stop: () => Promise<void> };

const KEEP_AWAKE_TAG = 'borderline-run';

async function canUseBackground(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (!(await TaskManager.isAvailableAsync())) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  } catch {
    return false;
  }
}

export async function startTracking(onPoints: (points: RawPoint[]) => void, preferBackground = true): Promise<Tracker> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('위치 권한이 필요합니다.');
  await clearBuffer();

  if (preferBackground && (await canUseBackground())) {
    try {
      const unsub = subscribeRunPoints(onPoints);
      await Location.startLocationUpdatesAsync(RUN_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 2000,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: '경계선: 선을 긋는 중',
          notificationBody: '달린 길을 블록으로 기록합니다. 좌표는 기기 밖으로 나가지 않습니다.',
          notificationColor: '#e8a33d',
        },
      });
      return {
        mode: 'background',
        stop: async () => {
          unsub();
          try {
            if (await Location.hasStartedLocationUpdatesAsync(RUN_TASK)) await Location.stopLocationUpdatesAsync(RUN_TASK);
          } catch {}
          await clearBuffer();
        },
      };
    } catch (e) {
      console.warn('[run] 백그라운드 시작 실패, 포그라운드로 전환', e);
    }
  }

  await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Platform.OS === 'web' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 2000,
    },
    (loc) => onPoints([toRawPoint(loc)]),
  );
  return {
    mode: 'foreground',
    stop: async () => {
      sub.remove();
      try {
        await deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // 화면 꺼짐 방지가 켜지지 않았던 경우(일부 브라우저) 무시한다.
      }
      await clearBuffer();
    },
  };
}

/** 앱이 백그라운드에서 돌아왔을 때 쌓인 위치를 꺼낸다. */
export async function drainBuffer(): Promise<RawPoint[]> {
  const pts = await readBuffer();
  if (pts.length) await clearBuffer();
  return pts;
}
