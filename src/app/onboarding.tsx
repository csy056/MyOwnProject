import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requestForegroundPermission } from '@/location/locate';
import { useGame } from '@/state/store';
import { Button, Card, Screen, T } from '@/ui/components';
import { colors, space } from '@/ui/theme';

type Step = 'intro' | 'age' | 'consent' | 'minor';

export default function Onboarding() {
  const [step, setStep] = useState<Step>('intro');
  const [busy, setBusy] = useState(false);
  const set = useGame((s) => s.set);
  const hasSave = useGame((s) => !!s.save);

  const finish = () => {
    set({ onboarded: true });
    router.replace(hasSave ? '/' : '/start');
  };

  if (step === 'intro') {
    return (
      <Screen>
        <View style={styles.block}>
          <T faint mono size={13}>04:12</T>
          <T size={20} style={styles.lead}>
            412일 전 새벽, 대한민국의 모든 시와 군이 경계선을 따라 솟아오른 벽에 갇혔다.
          </T>
          <T dim style={styles.para}>사람이 다니지 않는 곳은 회색이 되어 지워진다.</T>
          <T dim style={styles.para}>살아남은 사람들은 매일 길을 걷고 달려서 선을 긋는다.</T>
          <T style={styles.para}>지금 당신이 있는 동네가, 이야기의 무대가 된다.</T>
        </View>
        <Button testID="onb-next" kind="primary" label="시작하기" onPress={() => setStep('age')} />
      </Screen>
    );
  }

  if (step === 'age') {
    return (
      <Screen>
        <View style={styles.block}>
          <T size={20} style={styles.lead}>만 14세 이상인가요?</T>
          <T dim>
            이 게임은 위치 정보를 사용합니다. 위치정보법에 따라 만 14세 미만은 법정대리인의 동의가 필요해, 위치 기능 없이 플레이하게 됩니다.
          </T>
        </View>
        <Button testID="onb-age-yes" kind="primary" label="네, 만 14세 이상입니다" onPress={() => { set({ ageConfirmed: true }); setStep('consent'); }} />
        <Button testID="onb-age-no" label="아니요" onPress={() => { set({ ageConfirmed: false, locationConsent: false }); setStep('minor'); }} />
      </Screen>
    );
  }

  if (step === 'minor') {
    return (
      <Screen>
        <View style={styles.block}>
          <T size={20} style={styles.lead}>위치 없이 시작합니다</T>
          <T dim>시작할 구역은 직접 고를 수 있습니다. 러닝(선 긋기)과 구역 발견 기능은 꺼집니다. 설정에서 언제든 바꿀 수 있습니다.</T>
        </View>
        <Button testID="onb-minor-ok" kind="primary" label="계속" onPress={finish} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.block}>
        <T size={20} style={styles.lead}>위치 정보 이용 안내</T>
        <Card>
          <T style={styles.item}>· 시작 구역 판별: 현재 위치를 기기 안에서 시·군·구 이름으로만 바꿉니다. 좌표는 저장하지 않습니다.</T>
          <T style={styles.item}>· 구역 발견: 앱을 켤 때 있는 시·군·구를 기록해 새 구역을 해금합니다.</T>
          <T style={styles.item}>· 러닝(선택): 달린 길을 약 110m 크기 블록으로 바꿔 기기에만 저장합니다. 원래 경로 좌표는 러닝이 끝나면 지웁니다.</T>
          <T style={[styles.item, { color: colors.accent }]}>· 위치 정보는 서버로 전송하지 않습니다.</T>
        </Card>
        <T faint size={13}>동의하지 않아도 구역을 직접 골라 처음부터 끝까지 플레이할 수 있습니다. 설정에서 언제든 철회할 수 있습니다.</T>
      </View>
      <Button
        testID="onb-consent-yes"
        kind="primary"
        label={busy ? '권한 요청 중…' : '동의하고 위치 사용'}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          const granted = await requestForegroundPermission();
          setBusy(false);
          set({ locationConsent: granted });
          finish();
        }}
      />
      <Button testID="onb-consent-no" label="위치 없이 하기" onPress={() => { set({ locationConsent: false }); finish(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: space.xxl, gap: space.md },
  lead: { lineHeight: 32, marginBottom: space.sm },
  para: { marginTop: space.xs },
  item: { marginVertical: space.xs, fontSize: 15, lineHeight: 24 },
});
