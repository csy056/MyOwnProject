import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { LBS_TERMS, LEGAL_VERSION, PRIVACY_POLICY } from '@/content/legal';
import { Card, Header, Screen, T } from '@/ui/components';
import { colors, space } from '@/ui/theme';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const d = doc === 'lbs' ? LBS_TERMS : PRIVACY_POLICY;
  return (
    <Screen>
      <Header title={d.title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Card style={{ borderColor: colors.accentDim }}>
        <T dim size={13}>이 문서는 초안입니다. 출시 전에 운영자 정보를 채우고 법률 검토를 받아야 합니다. (버전 {LEGAL_VERSION})</T>
      </Card>
      {d.sections.map((s) => (
        <View key={s.heading} style={{ marginTop: space.lg, gap: space.xs }}>
          <T>{s.heading}</T>
          {s.body.map((b, i) => (
            <T key={i} dim size={15}>
              {b}
            </T>
          ))}
        </View>
      ))}
    </Screen>
  );
}
