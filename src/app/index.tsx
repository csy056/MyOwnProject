import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGame } from '@/state/store';
import { Button, Screen, T } from '@/ui/components';
import { colors, fonts, space } from '@/ui/theme';

export default function Title() {
  const onboarded = useGame((s) => s.onboarded);
  const save = useGame((s) => s.save);
  const world = useGame((s) => s.world);
  const totals = useGame((s) => s.totals);

  useEffect(() => {
    if (!onboarded) router.replace('/onboarding');
  }, [onboarded]);

  const canContinue = !!save && !!world;

  return (
    <Screen>
      <View style={styles.hero}>
        <T faint mono size={13}>벽이 생긴 지 412일</T>
        <T style={styles.title}>경계선</T>
        <T dim center>달려라. 지도에서 지워지기 전에.</T>
      </View>

      <View style={{ gap: space.xs }}>
        {canContinue ? (
          <Button testID="btn-continue" kind="primary" label="이어하기" sub={world!.dome === world!.area ? world!.area : `${world!.dome} · ${world!.area}`} onPress={() => router.push('/game')} />
        ) : null}
        <Button
          testID="btn-new"
          kind={canContinue ? 'default' : 'primary'}
          label="새로 시작"
          sub={canContinue ? '지금 진행 중인 이야기는 사라집니다' : undefined}
          onPress={() => router.push('/start')}
        />
        <Button testID="btn-run" label="선 긋기 (러닝)" sub={totals.runs ? `누적 ${totals.km.toFixed(1)}km · 블록 ${totals.cells}칸` : '실제로 달려서 구역을 되찾습니다'} onPress={() => router.push('/run')} />
        <Button testID="btn-map" label="되찾은 지도" onPress={() => router.push('/territory')} />
        <Button testID="btn-records" label="기록 (단서 · 무전 · 구역 · 엔딩)" onPress={() => router.push('/records')} />
        <Button testID="btn-settings" kind="ghost" label="설정" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.xxl * 2, paddingBottom: space.xxl * 1.5 },
  title: { fontSize: 52, lineHeight: 64, letterSpacing: 8, color: colors.text, fontFamily: fonts.body, fontWeight: '700', marginVertical: space.md },
});
