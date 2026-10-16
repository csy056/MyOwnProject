import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { startNewGame, unloadEngine } from '@/engine/gameSession';
import { locateRegion } from '@/location/locate';
import { DEFAULT_OUTSIDER_REGION_ID, regionById, regionsInSido, sidoList, type Region } from '@/location/regions';
import { useGame, type World } from '@/state/store';
import { Button, Card, Header, Screen, T } from '@/ui/components';
import { colors, space } from '@/ui/theme';

type Detect =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'inside'; region: Region }
  | { state: 'outside' }
  | { state: 'failed'; reason: string };

function toWorld(region: Region, route: World['route'], source: World['source']): World {
  return {
    route,
    regionId: region.id,
    sido: region.sido,
    dome: region.dome,
    area: region.area,
    kind: region.kind,
    coastal: region.coastal,
    key: region.key,
    source,
  };
}

export default function Start() {
  const consent = useGame((s) => s.locationConsent);
  const [detect, setDetect] = useState<Detect>({ state: 'idle' });
  const [picking, setPicking] = useState<null | World['route']>(null);

  const runDetect = useCallback(async () => {
    setDetect({ state: 'locating' });
    const r = await locateRegion();
    if (r.status === 'ok') setDetect(r.result.type === 'inside' ? { state: 'inside', region: r.result.region } : { state: 'outside' });
    else setDetect({ state: 'failed', reason: r.status === 'denied' ? '위치 권한이 없습니다.' : '위치를 읽지 못했습니다.' });
  }, []);

  useEffect(() => {
    if (consent) runDetect();
  }, [consent, runDetect]);

  const begin = (region: Region, route: World['route'], source: World['source']) => {
    const world = toWorld(region, route, source);
    const store = useGame.getState();
    store.setWorld(world);
    if (source === 'gps') store.discover(region.id);
    unloadEngine();
    startNewGame(world);
    router.replace('/game');
  };

  if (picking) {
    return <RegionPicker route={picking} onBack={() => setPicking(null)} onPick={(r) => begin(r, picking, 'manual')} />;
  }

  const entry = regionById(DEFAULT_OUTSIDER_REGION_ID)!;

  return (
    <Screen>
      <Header title="어디에서 시작할까" onBack={() => router.back()} />

      {detect.state === 'locating' ? (
        <Card><T dim>현재 위치를 시·군·구로 바꾸는 중…</T></Card>
      ) : null}

      {detect.state === 'inside' ? (
        <Card>
          <T faint size={13}>{detect.region.sido}</T>
          <T size={20} style={{ marginVertical: space.sm }}>
            {detect.region.dome} 벽 안, {detect.region.area}
          </T>
          <T dim>이곳에서 412일을 버틴 생존자로 시작합니다.</T>
          <View style={{ height: space.md }} />
          <Button testID="start-here" kind="primary" label="여기서 생존자로 시작" onPress={() => begin(detect.region, 'survivor', 'gps')} />
          <Button testID="start-outsider-here" label="외부인으로 이곳에 들어가기" sub="벽 바깥에서 막 들어온 사람" onPress={() => begin(detect.region, 'outsider', 'gps')} />
        </Card>
      ) : null}

      {detect.state === 'outside' ? (
        <Card>
          <T size={20} style={{ marginBottom: space.sm }}>당신은 벽 바깥에 있습니다.</T>
          <T dim>412일 동안 아무도 들어가지 못한 곳으로, 처음 들어가는 사람이 됩니다.</T>
          <View style={{ height: space.md }} />
          <Button testID="start-outsider-default" kind="primary" label={`${entry.dome} ${entry.area}로 들어가기`} onPress={() => begin(entry, 'outsider', 'manual')} />
          <Button label="들어갈 구역 고르기" onPress={() => setPicking('outsider')} />
        </Card>
      ) : null}

      {detect.state === 'failed' ? (
        <Card>
          <T dim>{detect.reason} 구역을 직접 골라 시작할 수 있습니다.</T>
          <Button label="다시 시도" kind="ghost" onPress={runDetect} />
        </Card>
      ) : null}

      <View style={{ height: space.lg }} />
      <T faint size={13} style={{ marginBottom: space.xs }}>직접 고르기</T>
      <Button testID="pick-survivor" label="구역을 골라 생존자로 시작" onPress={() => setPicking('survivor')} />
      <Button testID="pick-outsider" label="구역을 골라 외부인으로 시작" onPress={() => setPicking('outsider')} />
      {!consent ? <T faint size={13} style={{ marginTop: space.md }}>위치 사용에 동의하면 지금 있는 동네가 자동으로 무대가 됩니다. (설정)</T> : null}
    </Screen>
  );
}

function RegionPicker({ route, onBack, onPick }: { route: World['route']; onBack: () => void; onPick: (r: Region) => void }) {
  const [sido, setSido] = useState<string | null>(null);
  return (
    <Screen>
      <Header title={sido ?? '시·도 고르기'} onBack={sido ? () => setSido(null) : onBack} />
      <T faint size={13} style={{ marginBottom: space.sm }}>{route === 'outsider' ? '외부인으로 들어갈 구역' : '생존자로 시작할 구역'}</T>
      <View style={styles.grid}>
        {sido
          ? regionsInSido(sido).map((r) => (
              <Pressable key={r.id} testID={`region-${r.area}`} style={styles.cell} onPress={() => onPick(r)} accessibilityRole="button">
                <T>{r.area}</T>
                <T faint size={12}>{r.kind === 'metro' ? '대도시' : r.kind === 'city' ? '도시' : '농어촌'}{r.coastal ? ' · 해안' : ''}{r.key ? ' · 고유 이야기' : ''}</T>
              </Pressable>
            ))
          : sidoList().map((s) => (
              <Pressable key={s} testID={`sido-${s}`} style={styles.cell} onPress={() => setSido(s)} accessibilityRole="button">
                <T>{s}</T>
              </Pressable>
            ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: space.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgRaised,
  },
});
