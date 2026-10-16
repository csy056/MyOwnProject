import { router } from 'expo-router';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { unloadEngine } from '@/engine/gameSession';
import { requestForegroundPermission } from '@/location/locate';
import { buy, PRODUCTS } from '@/monetization';
import { useGame } from '@/state/store';
import { Button, Card, Divider, Header, Screen, T } from '@/ui/components';
import { colors, space, type TextSize } from '@/ui/theme';

function confirm(title: string, message: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '확인', style: 'destructive', onPress: onOk },
  ]);
}

function Row({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {sub ? <T faint size={13}>{sub}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.line }} />
    </View>
  );
}

export default function Settings() {
  const s = useGame();

  return (
    <Screen>
      <Header title="설정" onBack={() => router.back()} />

      <T faint size={13}>글자 크기</T>
      <View style={styles.sizes}>
        {(['small', 'normal', 'large'] as TextSize[]).map((k) => (
          <View key={k} style={{ flex: 1 }}>
            <Button label={k === 'small' ? '작게' : k === 'normal' ? '보통' : '크게'} kind={s.textSize === k ? 'primary' : 'default'} onPress={() => s.set({ textSize: k })} />
          </View>
        ))}
      </View>

      <Row label="음성 안내" sub="러닝 중 1km마다 음성으로 알려 줍니다" value={s.voiceCues} onChange={(v) => s.set({ voiceCues: v })} />
      <Row label="진동" value={s.haptics} onChange={(v) => s.set({ haptics: v })} />

      <Divider />
      <T faint size={13}>위치 정보</T>
      {s.ageConfirmed === false ? (
        <T dim style={{ marginVertical: space.sm }}>만 14세 미만으로 설정되어 위치 기능이 꺼져 있습니다.</T>
      ) : (
        <Row
          label="위치 사용"
          sub="시작 구역 판별, 구역 발견, 러닝. 좌표는 기기 안에서 구역·블록으로만 바뀌고 전송되지 않습니다."
          value={s.locationConsent}
          onChange={async (v) => {
            if (!v) return s.set({ locationConsent: false });
            const ok = await requestForegroundPermission();
            s.set({ locationConsent: ok, ageConfirmed: s.ageConfirmed ?? true });
          }}
        />
      )}
      <Button
        kind="ghost"
        label="러닝 기록과 블록 지도 삭제"
        onPress={() =>
          confirm('러닝 기록 삭제', '되찾은 블록, 원정 기록, 무전 해금이 모두 지워집니다.', () =>
            s.set({ ownedCells: {}, totals: { runs: 0, km: 0, loops: 0, cells: 0 }, runHistory: [], pendingRun: null, radioRead: {} }),
          )
        }
      />

      <Divider />
      <T faint size={13}>상점</T>
      {s.adFree ? (
        <Card><T>광고 제거 적용됨. 고맙습니다, 선꾼.</T></Card>
      ) : (
        <>
          <Button label={`${PRODUCTS.remove_ads.title} · ${PRODUCTS.remove_ads.price}`} sub={PRODUCTS.remove_ads.description} onPress={() => buy('remove_ads')} />
          <Button label={`${PRODUCTS.supporter_pack.title} · ${PRODUCTS.supporter_pack.price}`} sub={PRODUCTS.supporter_pack.description} onPress={() => buy('supporter_pack')} />
        </>
      )}
      <T faint size={12}>현재 빌드는 결제·광고 시뮬레이션입니다. 실제 결제는 일어나지 않습니다.</T>

      <Divider />
      <Button
        kind="danger"
        label="모든 데이터 초기화"
        onPress={() =>
          confirm('모든 데이터 초기화', '진행 중인 이야기, 기록, 러닝 기록, 동의 내역이 모두 지워집니다.', () => {
            unloadEngine();
            s.wipeAll();
            router.replace('/onboarding');
          })
        }
      />
      <T faint size={12} style={{ marginTop: space.lg }}>
        경계선 (가제) · 개발 빌드{'\n'}구역 경계: 통계청 센서스용 행정구역경계(2013) 기반, 이후 행정구역 변경 반영
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sizes: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});
