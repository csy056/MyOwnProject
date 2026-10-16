import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { parseCell } from '@/run/grid';
import { formatPace } from '@/run/session';
import { useGame } from '@/state/store';
import { Button, Card, Header, Screen, T } from '@/ui/components';
import { cellsToAscii, shareText } from '@/ui/share';
import { colors, space } from '@/ui/theme';

// 되찾은 블록을 "측량 도면"처럼 그린다. 실제 지도 타일은 쓰지 않는다. (위치 노출 최소화)
export default function Territory() {
  const owned = useGame((s) => s.ownedCells);
  const totals = useGame((s) => s.totals);
  const history = useGame((s) => s.runHistory);
  const world = useGame((s) => s.world);
  const { width } = useWindowDimensions();
  const size = Math.min(width - space.lg * 2, 520);

  const plan = useMemo(() => {
    const cells = Object.keys(owned).map(parseCell);
    if (cells.length === 0) return null;
    let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    for (const c of cells) {
      r0 = Math.min(r0, c.row); r1 = Math.max(r1, c.row);
      c0 = Math.min(c0, c.col); c1 = Math.max(c1, c.col);
    }
    const span = Math.max(r1 - r0 + 1, c1 - c0 + 1, 12) + 4;
    const cell = size / span;
    const offR = r0 - Math.floor((span - (r1 - r0 + 1)) / 2);
    const offC = c0 - Math.floor((span - (c1 - c0 + 1)) / 2);
    return { cells, cell, span, offR, offC };
  }, [owned, size]);

  const ascii = cellsToAscii(Object.keys(owned));

  return (
    <Screen>
      <Header title="되찾은 지도" onBack={() => router.back()} />
      <View style={styles.statsRow}>
        <T dim size={14}>블록 {totals.cells}칸</T>
        <T dim size={14}>누적 {totals.km.toFixed(1)}km</T>
        <T dim size={14}>포위 {totals.loops}회</T>
        <T dim size={14}>원정 {totals.runs}회</T>
      </View>

      {plan ? (
        <View style={[styles.plan, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            {Array.from({ length: plan.span + 1 }, (_, i) => (
              <Line key={`h${i}`} x1={0} y1={i * plan.cell} x2={size} y2={i * plan.cell} stroke={colors.line} strokeWidth={0.5} />
            ))}
            {Array.from({ length: plan.span + 1 }, (_, i) => (
              <Line key={`v${i}`} x1={i * plan.cell} y1={0} x2={i * plan.cell} y2={size} stroke={colors.line} strokeWidth={0.5} />
            ))}
            {plan.cells.map((c) => (
              <Rect
                key={`${c.row}:${c.col}`}
                x={(c.col - plan.offC) * plan.cell + 0.5}
                y={(plan.span - 1 - (c.row - plan.offR)) * plan.cell + 0.5}
                width={plan.cell - 1}
                height={plan.cell - 1}
                fill={colors.accent}
                opacity={0.85}
              />
            ))}
          </Svg>
        </View>
      ) : (
        <Card>
          <T>아직 되찾은 블록이 없다.</T>
          <T dim style={{ marginTop: space.sm }}>회색은 사람이 지나가지 않은 곳부터 지운다. 첫 선을 그어 보자.</T>
          <Button kind="primary" label="원정 출발" onPress={() => router.push('/run')} />
        </Card>
      )}
      <T faint size={12} style={{ marginTop: space.sm }}>한 칸 ≈ 110m. 위쪽이 북쪽. 실제 지도와 주소는 표시하지 않는다.</T>

      {history.length ? (
        <>
          <T style={{ marginTop: space.xl, marginBottom: space.sm }}>최근 원정</T>
          {history.slice(0, 10).map((h) => (
            <View key={h.endedAt} style={styles.histRow}>
              <T dim size={14}>{new Date(h.endedAt).toLocaleDateString('ko-KR')}</T>
              <T size={14}>{h.km.toFixed(2)}km · {formatPace(h.paceSec)} · +{h.newCells}칸{h.loops ? ` · 포위 ${h.loops}` : ''}</T>
            </View>
          ))}
        </>
      ) : null}

      {totals.cells > 0 ? (
        <Button
          label="지도 공유하기"
          onPress={() =>
            shareText(
              `[경계선] ${world ? `${world.dome} 벽 안에서 ` : ''}되찾은 블록 ${totals.cells}칸 · 누적 ${totals.km.toFixed(1)}km\n\n${ascii}\n\n달려라. 지도에서 지워지기 전에.\n#경계선 #선긋기 #러닝`,
            )
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  plan: { alignSelf: 'center', backgroundColor: colors.bgSunken, borderWidth: 1, borderColor: colors.line },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
});
