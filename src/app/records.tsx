import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ENDING_INFO, ENDING_ORDER } from '@/content/endings';
import { RADIO_LOGS } from '@/content/radio';
import { regionById, sidoList, TOTAL_REGION_COUNT } from '@/location/regions';
import { useGame } from '@/state/store';
import { Card, Header, Screen, T } from '@/ui/components';
import { colors, space } from '@/ui/theme';

type Tab = 'clues' | 'radio' | 'regions' | 'endings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'clues', label: '단서' },
  { key: 'radio', label: '무전' },
  { key: 'regions', label: '구역' },
  { key: 'endings', label: '엔딩' },
];

const CONDITION_LABEL = { runs: '원정', km: '누적 km', loops: '포위', cells: '블록' } as const;

export default function Records() {
  const [tab, setTab] = useState<Tab>('clues');
  const [openRadio, setOpenRadio] = useState<string | null>(null);
  const clues = useGame((s) => s.clues);
  const endings = useGame((s) => s.endings);
  const discovered = useGame((s) => s.discovered);
  const totals = useGame((s) => s.totals);
  const markRadioRead = useGame((s) => s.markRadioRead);
  const radioRead = useGame((s) => s.radioRead);

  return (
    <Screen>
      <Header title="기록" onBack={() => router.back()} />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]} accessibilityRole="tab">
            <T size={14} style={tab === t.key ? { color: colors.bg } : undefined}>{t.label}</T>
          </Pressable>
        ))}
      </View>

      {tab === 'clues' ? (
        clues.length ? (
          clues.map((c) => (
            <Card key={c.title}>
              <T>{c.title}</T>
              <T faint size={12}>{c.day}일째에 기록</T>
            </Card>
          ))
        ) : (
          <T dim>아직 기록한 단서가 없다. 벽은 아무것도 말해 주지 않는다. 아직은.</T>
        )
      ) : null}

      {tab === 'radio'
        ? RADIO_LOGS.map((r) => {
            const unlocked = totals[r.condition.kind] >= r.condition.atLeast;
            const open = openRadio === r.id;
            return (
              <Pressable
                key={r.id}
                disabled={!unlocked}
                onPress={() => {
                  setOpenRadio(open ? null : r.id);
                  markRadioRead(r.id);
                }}>
                <Card style={unlocked && !radioRead[r.id] ? { borderColor: colors.accent } : undefined}>
                  <T faint size={12}>{unlocked ? r.from : `잠김 · ${CONDITION_LABEL[r.condition.kind]} ${r.condition.atLeast} 이상`}</T>
                  <T style={!unlocked ? { color: colors.textFaint } : undefined}>{unlocked ? r.title : '······'}</T>
                  {open ? r.lines.map((l, i) => <T key={i} dim style={{ marginTop: space.sm }}>{l}</T>) : null}
                </Card>
              </Pressable>
            );
          })
        : null}

      {tab === 'regions' ? (
        <>
          <T dim style={{ marginBottom: space.sm }}>
            발견한 구역 {Object.keys(discovered).length} / {TOTAL_REGION_COUNT}. 다른 동네에서 앱을 켜면 그곳의 기록이 해금된다.
          </T>
          {sidoList().map((sido) => {
            const found = Object.keys(discovered)
              .map((id) => regionById(id))
              .filter((r) => r && r.sido === sido);
            if (!found.length) return null;
            return (
              <Card key={sido}>
                <T faint size={12}>{sido}</T>
                <T>{found.map((r) => r!.area).join(' · ')}</T>
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === 'endings'
        ? ENDING_ORDER.map((id) => (
            <Card key={id}>
              <T style={!endings[id] ? { color: colors.textFaint } : undefined}>{endings[id] ? ENDING_INFO[id].title : '???'}</T>
              <T faint size={12}>{endings[id] ? new Date(endings[id]).toLocaleDateString('ko-KR') : ENDING_INFO[id].hint}</T>
            </Card>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
});
