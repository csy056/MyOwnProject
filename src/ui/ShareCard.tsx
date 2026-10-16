import * as Sharing from 'expo-sharing';
import { useRef, type ComponentRef, type Ref } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { colors, fonts, space } from './theme';

// 러닝 결과 공유 카드. 화면에 미리보기로 보이고, 그대로 이미지로 찍어 공유한다.
// 좌표나 실제 지도는 넣지 않는다.

export type ShareCardData = {
  headline: string; // 예: "마포구에서 5.20km"
  sub: string; // 예: "블록 46칸 탈환 · 포위 1회 · 5'48\"/km"
  ascii: string;
  day: number;
};

type ViewRef = ComponentRef<typeof View>;

export function ShareCard({ data, cardRef }: { data: ShareCardData; cardRef: Ref<ViewRef> }) {
  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      <Text style={styles.kicker}>경계선 · 벽이 생긴 지 {data.day}일</Text>
      <Text style={styles.headline}>{data.headline}</Text>
      <Text style={styles.sub}>{data.sub}</Text>
      <View style={styles.artBox}>
        <Text style={styles.art}>{data.ascii}</Text>
      </View>
      <Text style={styles.tagline}>달려라. 지도에서 지워지기 전에.</Text>
    </View>
  );
}

export function useShareCard() {
  const ref = useRef<ViewRef>(null);
  /** 이미지로 공유한다. 지원되지 않는 환경이면 false 를 돌려준다. */
  const shareImage = async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !ref.current) return false;
    try {
      if (!(await Sharing.isAvailableAsync())) return false;
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '원정 기록 공유' });
      return true;
    } catch {
      return false;
    }
  };
  return { ref, shareImage };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSunken,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentDim,
    padding: space.xl,
    marginVertical: space.sm,
  },
  kicker: { color: colors.textDim, fontSize: 12, letterSpacing: 1, fontFamily: fonts.mono },
  headline: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: space.md, fontFamily: fonts.body },
  sub: { color: colors.accent, fontSize: 15, marginTop: space.xs, fontFamily: fonts.body },
  artBox: { marginVertical: space.lg, alignItems: 'center' },
  art: { color: colors.text, fontFamily: fonts.mono, fontSize: 16, lineHeight: 18, letterSpacing: 3 },
  tagline: { color: colors.textDim, fontSize: 13, fontFamily: fonts.body },
});
