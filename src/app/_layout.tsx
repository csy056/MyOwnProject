import '@/run/backgroundTask';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useGame } from '@/state/store';
import { SimulatorHost } from '@/ui/SimulatorHost';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(() => useGame.persist.hasHydrated());
  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (useGame.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
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
