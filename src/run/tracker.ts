import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { clearBuffer, readBuffer, RUN_ACTIVE_KEY, RUN_TASK, subscribeRunPoints, toRawPoint } from './backgroundTask';
import type { RawPoint } from './session';

// 러닝 위치 수집.
// - 개발 빌드: 화면을 꺼도 기록한다. Android는 알림이 뜨는 포그라운드 서비스, iOS는 위치 표시줄을 띄운다.
//   둘 다 "앱 사용 중" 권한만 쓰고, "항상 허용"(백그라운드 위치) 권한은 요청하지 않는다.
// - Expo Go·웹: 백그라운드 작업이 지원되지 않아 화면을 켜 둔 채로 기록한다.

export type TrackerMode = 'background' | 'foreground';
export type Tracker = { mode: TrackerMode; stop: () => Promise<void> };

const KEEP_AWAKE_TAG = 'borderline-run';

async function canRunTask(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await TaskManager.isAvailableAsync();
  } catch {
    return false;
  }
}

/** 러닝이 아닌데 남아 있는 위치 작업(앱이 러닝 중 종료된 경우)을 멈춘다. */
export async function stopOrphanedTracking() {
  try {
    if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(RUN_TASK))) {
      await Location.stopLocationUpdatesAsync(RUN_TASK);
    }
  } catch {
    // 작업이 등록되지 않았으면 무시한다.
  }
  await AsyncStorage.removeItem(RUN_ACTIVE_KEY).catch(() => {});
}

/** 위치 동의 철회, 데이터 삭제 때: 추적을 멈추고 임시 버퍼를 지운다. */
export async function stopAllTracking() {
  await stopOrphanedTracking();
  await clearBuffer();
}

async function requestServiceNotification() {
  // Android 13+는 포그라운드 서비스 알림을 보이려면 알림 권한이 필요하다. 거부해도 기록은 된다.
  if (Platform.OS !== 'android') return;
  try {
    const next = await import('expo-location/next');
    await next.Location.requestNotificationPermissions();
  } catch {
    // 지원되지 않거나 거부됨
  }
}

export async function startTracking(onPoints: (points: RawPoint[]) => void, preferBackground = true): Promise<Tracker> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('위치 권한이 필요합니다. 설정에서 위치 접근을 허용해 주세요.');
  await clearBuffer();

  if (preferBackground && (await canRunTask())) {
    const unsub = subscribeRunPoints(onPoints);
    try {
      await requestServiceNotification();
      await AsyncStorage.setItem(RUN_ACTIVE_KEY, String(Date.now()));
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
          killServiceOnDestroy: true,
        },
      });
      return {
        mode: 'background',
        stop: async () => {
          unsub();
          await stopOrphanedTracking();
          await clearBuffer();
        },
      };
    } catch (e) {
      unsub();
      await AsyncStorage.removeItem(RUN_ACTIVE_KEY).catch(() => {});
      console.warn('[run] 화면 꺼짐 기록을 시작하지 못해 화면 켜 둠 모드로 전환', e);
    }
  }

  const sub = await Location.watchPositionAsync(
    {
      accuracy: Platform.OS === 'web' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 2000,
    },
    (loc) => onPoints([toRawPoint(loc)]),
  );
  await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
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

/**
 * 앱이 러닝 중에 종료됐다가 다시 열렸을 때: 남은 작업을 멈추고, 그때까지 쌓인 위치를 돌려준다.
 * 러닝 표시가 없으면(이미 정상 종료됨) 버퍼는 버린다.
 */
export async function recoverInterruptedRun(): Promise<RawPoint[]> {
  const active = await AsyncStorage.getItem(RUN_ACTIVE_KEY).catch(() => null);
  const pts = active ? await readBuffer() : [];
  await stopOrphanedTracking();
  await clearBuffer();
  return pts;
}
