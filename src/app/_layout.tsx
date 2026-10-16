import '@/run/backgroundTask';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { onHydrationSettled } from '@/state/store';
import { SimulatorHost } from '@/ui/SimulatorHost';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// 저장소 불러오기가 끝날 때까지 기다린다. 실패해도 새 상태로 연다. (빈 화면에 갇히지 않게)
function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => onHydrationSettled(() => setHydrated(true)), []);
  return hydrated;
}

export default function RootLayout() {
  const hydrated = useStoreHydrated();

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
      <SimulatorHost />
    </SafeAreaProvider>
  );
}
