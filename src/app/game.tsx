import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ENDING_INFO } from '@/content/endings';
import { abandonGame, applyPendingRun, choose, currentStats, dailyUpkeep, ensureLoaded, grantDiscoveryReward, hubHints, nextPage, rewindLastChoice } from '@/engine/gameSession';
import type { Stats } from '@/engine/storyEngine';
import { isNight } from '@/location/daynight';
import { locateRegion } from '@/location/locate';
import { watchRewardedAd } from '@/monetization';
import { useGame } from '@/state/store';
import { Button, T } from '@/ui/components';
import { shareText } from '@/ui/share';
import { ShareCard, useShareCard } from '@/ui/ShareCard';
import { colors, fonts, space, textSizes } from '@/ui/theme';

type Delta = { label: string; value: number; color: string; upkeep?: boolean };

const DELTA_LABELS: Partial<Record<keyof Stats, [string, string]>> = {
  hp: ['체력', colors.danger],
  mind: ['정신', colors.mind],
  food: ['식량', colors.good],
  parts: ['부품', colors.accent],
  trust: ['신뢰', colors.text],
  clues: ['단서', colors.accent],
};

function diff(a: Stats | null, b: Stats | null): Delta[] {
  if (!a || !b) return [];
  // 하루 유지비는 사건 결과와 떼어 흐리게 따로 보인다.
  const upkeep = dailyUpkeep(a, b);
  const out: Delta[] = [];
  for (const [k, [label, color]] of Object.entries(DELTA_LABELS) as [keyof Stats, [string, string]][]) {
    const u = (upkeep as Record<string, number | undefined>)[k] ?? 0;
    const d = b[k] - a[k] - u;
    if (d !== 0) out.push({ label, value: d, color });
  }
  for (const [k, v] of Object.entries(upkeep) as [keyof typeof upkeep, number][]) {
    if (!v) continue;
    const [label] = DELTA_LABELS[k as keyof Stats]!;
    out.push({ label: `하루 지남 · ${label}`, value: v, color: colors.textFaint, upkeep: true });
  }
  return out;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={styles.meterRow}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 10, now: value, text: `${label} ${value}/10` }}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={styles.meter}>
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={[styles.meterCell, { backgroundColor: i < value ? color : colors.line }]} />
        ))}
      </View>
    </View>
  );
}

function HubPanel() {
  const hints = hubHints();
  if (!hints) return null;
  return (
    <View style={styles.hubPanel} accessibilityRole="summary">
      <Text style={styles.hubGoal}>{hints.goal}</Text>
      {hints.next ? <Text style={styles.hubGoal}>{hints.next}</Text> : null}
      {hints.warnings.map((w) => (
        <Text key={w} style={styles.hubWarn}>
          {w}
        </Text>
      ))}
    </View>
  );
}

export default function Game() {
  const save = useGame((s) => s.save);
  const world = useGame((s) => s.world);
  const textSize = useGame((s) => s.textSize);
  const haptics = useGame((s) => s.haptics);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const card = useShareCard();

  // 화면에 들어올 때마다: 엔진 준비, 러닝 결과 반영, 구역 발견(L3)
  useFocusEffect(
    useCallback(() => {
      if (!ensureLoaded()) {
        router.replace('/');
        return;
      }
      applyPendingRun();
      setStats(currentStats());
      const { locationConsent, ageConfirmed } = useGame.getState();
      if (!locationConsent || !ageConfirmed) return;
      let alive = true;
      locateRegion().then((r) => {
        if (!alive || r.status !== 'ok' || r.result.type !== 'inside') return;
        const region = r.result.region;
        if (useGame.getState().discover(region.id)) {
          grantDiscoveryReward();
          setStats(currentStats());
          setToast(`새 구역 발견: ${region.dome} ${region.area}. 기록이 해금되었다.`);
        }
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [save?.screen.pageIndex, save?.screen.pages]);

  if (!save || !world) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const screen = save.screen;
  const page = screen.pages[Math.min(screen.pageIndex, screen.pages.length - 1)];
  const lastPage = screen.pageIndex >= screen.pages.length - 1;
  const sz = textSizes[textSize];
  const night = isNight();

  const onChoose = (index: number) => {
    const before = currentStats();
    if (haptics && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    choose(index);
    const after = currentStats();
    setStats(after);
    setDeltas(diff(before, after));
  };

  const onNext = () => {
    setDeltas([]);
    nextPage();
  };

  // 엔딩 패널은 엔딩 본문의 마지막 장을 읽은 뒤에 보인다. 알 수 없는 엔딩이어도 버튼은 항상 보인다.
  const ending = screen.ended && lastPage ? (ENDING_INFO[screen.endingId ?? ''] ?? { title: '이야기의 끝', hint: '' }) : undefined;
  const canRewind = !!ending && (screen.endingId === 'death' || screen.endingId === 'erased') && !!save.rewind;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.status}>
        <Pressable onPress={() => router.navigate('/')} accessibilityRole="button" accessibilityLabel="메뉴" hitSlop={10}>
          <Text style={styles.menu}>≡</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTop}>
            {world.dome === world.area ? world.area : `${world.dome} · ${world.area}`} · {stats?.day ?? 412}일째 {night ? '· 밤' : ''}
          </Text>
          <View style={styles.statusRow}>
            <Meter label="체력" value={stats?.hp ?? 0} color={colors.danger} />
            <Meter label="정신" value={stats?.mind ?? 0} color={colors.mind} />
          </View>
          <Text style={styles.statusBottom}>
            식량 {stats?.food ?? 0} · 부품 {stats?.parts ?? 0} · 신뢰 {stats?.trust ?? 0} · 단서 {stats?.clues ?? 0}
          </Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {deltas.length > 0 && !screen.ended ? (
          <View style={styles.deltas}>
            {deltas.map((d) => (
              <Text key={d.label} style={[styles.delta, { borderColor: d.color, color: d.color }, d.upkeep && styles.deltaUpkeep]}>
                {d.label} {d.value > 0 ? `+${d.value}` : d.value}
              </Text>
            ))}
          </View>
        ) : null}
        {page?.title ? <Text style={styles.pageTitle}>{page.title}</Text> : null}
        {page?.lines.map((l, i) =>
          l.kind === 'clue' ? (
            <View key={i} style={styles.clue}>
              <Text style={styles.clueLabel}>단서 기록</Text>
              <Text style={styles.clueText}>{l.text}</Text>
            </View>
          ) : (
            <Text key={i} style={[styles.para, { fontSize: sz.body, lineHeight: sz.line }]}>
              {l.text}
            </Text>
          ),
        )}

        {lastPage && page?.hub && !screen.ended ? <HubPanel /> : null}

        {ending ? (
          <View style={styles.ending}>
            <ShareCard
              cardRef={card.ref}
              data={{
                day: stats?.day ?? 412,
                kicker: `경계선 · ENDING · ${stats?.day ?? 412}일째`,
                headline: ending.title,
                sub: world.dome === world.area ? `${world.dome} 벽 안` : `${world.dome} 벽 안, ${world.area}`,
                quote: ending.line,
              }}
            />
            {canRewind ? (
              <Button
                testID="btn-rewind"
                kind="primary"
                label="광고 보고 되감기"
                sub="마지막 선택 직전으로 돌아갑니다 (체력·정신·식량 조금 회복)"
                onPress={async () => {
                  if (await watchRewardedAd('rewind')) {
                    rewindLastChoice();
                    ensureLoaded();
                    setStats(currentStats());
                    setDeltas([]);
                  }
                }}
              />
            ) : null}
            <Button
              label="공유하기"
              sub="이미지 카드로 공유 (지원되지 않으면 문구로)"
              onPress={async () => {
                if (await card.shareImage()) return;
                await shareText(
                  `[경계선] ${world.dome === world.area ? `${world.dome} 벽 안에서` : `${world.dome} 벽 안, ${world.area}에서`} ${stats?.day ?? 412}일째.\n엔딩: ${ending.title}${ending.line ? `\n“${ending.line}”` : ''}\n\n달려라. 지도에서 지워지기 전에.\n#경계선 #선긋기`,
                ).then((r) => {
                  if (r === 'copied') setToast('공유 문구를 복사했습니다.');
                  else if (r === 'failed') setToast('공유하지 못했습니다.');
                });
              }}
            />
            <Button
              label="처음으로"
              kind="ghost"
              onPress={() => {
                abandonGame();
                router.replace('/');
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      {!screen.ended || !lastPage ? (
        <View style={styles.choices}>
          {!lastPage ? (
            <Button testID="btn-next" label="계속" onPress={onNext} />
          ) : (
            screen.choices.map((c, i) => (
              <Button key={`${c.index}-${c.text}`} testID={`choice-${i}`} label={c.text} onPress={() => onChoose(c.index)} />
            ))
          )}
          {lastPage && page?.hub ? (
            <View style={styles.hubRow}>
              <Pressable testID="hub-run" style={styles.hubBtn} onPress={() => router.push('/run')} accessibilityRole="button">
                <Text style={styles.hubBtnText}>선 긋기 (러닝)</Text>
              </Pressable>
              <Pressable style={styles.hubBtn} onPress={() => router.push('/records')} accessibilityRole="button">
                <Text style={styles.hubBtnText}>기록</Text>
              </Pressable>
              <Pressable style={styles.hubBtn} onPress={() => router.push('/territory')} accessibilityRole="button">
                <Text style={styles.hubBtnText}>지도</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  status: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  menu: { color: colors.text, fontSize: 26, width: 28 },
  statusTop: { color: colors.textDim, fontSize: 13, fontFamily: fonts.body },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { color: colors.textDim, fontSize: 12 },
  statusBottom: { color: colors.textFaint, fontSize: 12 },
  meter: { flexDirection: 'row', gap: 2, marginRight: 6 },
  meterCell: { width: 7, height: 8, borderRadius: 1 },
  body: { padding: space.lg, paddingBottom: space.xxl },
  pageTitle: { color: colors.textDim, fontSize: 14, letterSpacing: 2, marginBottom: space.md, fontFamily: fonts.body },
  para: { color: colors.text, marginBottom: space.md, fontFamily: fonts.body },
  clue: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: space.md, marginVertical: space.sm },
  clueLabel: { color: colors.accent, fontSize: 12, letterSpacing: 1 },
  clueText: { color: colors.text, fontSize: 15 },
  deltas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md },
  delta: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontSize: 12, overflow: 'hidden' },
  deltaUpkeep: { borderStyle: 'dashed' },
  choices: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bgSunken },
  ending: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  hubRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  hubPanel: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, gap: space.xs },
  hubGoal: { color: colors.textDim, fontSize: 14, lineHeight: 22, fontFamily: fonts.body },
  hubWarn: { color: colors.danger, fontSize: 14, lineHeight: 22, fontFamily: fonts.body },
  hubBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: colors.accentDim },
  hubBtnText: { color: colors.accent, fontSize: 13 },
  toast: { position: 'absolute', left: space.lg, right: space.lg, top: 90, backgroundColor: colors.bgRaised, borderColor: colors.accent, borderWidth: 1, borderRadius: 8, padding: space.md },
  toastText: { color: colors.text, fontSize: 14 },
});
