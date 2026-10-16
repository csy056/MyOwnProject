import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { newlyUnlocked, type RadioLog } from '@/content/radio';
import { isNight } from '@/location/daynight';
import { watchRewardedAd } from '@/monetization';
import { computeReward, localDateKey, REWARD_RULES, type RunReward } from '@/run/rewards';
import { addPoint, createSession, formatDuration, formatPace, summarize, type RawPoint, type RunEvent, type RunSession, type RunSummary } from '@/run/session';
import { drainBuffer, startTracking, type Tracker } from '@/run/tracker';
import { useGame } from '@/state/store';
import { Button, Card, Header, Screen, T } from '@/ui/components';
import { cellsToAscii, shareText } from '@/ui/share';
import { colors, fonts, space } from '@/ui/theme';

type Phase = 'ready' | 'starting' | 'running' | 'result';

type Result = { summary: RunSummary; reward: RunReward; radio: RadioLog[]; doubled: boolean };

const KM_LINES = [
  '선이 이어진다. 회색이 한 걸음 물러난다.',
  '숨이 고르다. 벽 소리가 조금 작아진다.',
  '발밑의 색이 돌아온다. 계속.',
  '누군가 이 길을 기억할 것이다.',
];

function speak(text: string) {
  if (!useGame.getState().voiceCues) return;
  Speech.stop();
  Speech.speak(text, { language: 'ko-KR', rate: 1.0 });
}

export default function Run() {
  const consent = useGame((s) => s.locationConsent);
  const age = useGame((s) => s.ageConfirmed);
  const world = useGame((s) => s.world);
  const hasGame = useGame((s) => !!s.save);
  const rewardedToday = useGame((s) => s.rewardedByDate[localDateKey()] ?? 0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [log, setLog] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<Tracker['mode'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const sessionRef = useRef<RunSession | null>(null);
  const trackerRef = useRef<Tracker | null>(null);

  const allowed = consent && age === true;

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // 앱이 러닝 중에 종료됐다가 돌아온 경우: 남은 버퍼를 기록으로 복구한다.
  useEffect(() => {
    drainBuffer().then((pts) => {
      if (pts.length < 2) return;
      const s = createSession(pts[0].timestamp);
      const owned = useGame.getState().ownedCells;
      for (const p of pts) addPoint(s, p, (id) => !!owned[id]);
      sessionRef.current = s;
      finish(pts[pts.length - 1].timestamp);
    });
    return () => {
      trackerRef.current?.stop();
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushLog = (line: string) => setLog((l) => [line, ...l].slice(0, 30));

  const onEvents = (events: RunEvent[]) => {
    const s = sessionRef.current!;
    for (const e of events) {
      if (e.type === 'km') {
        const blocks = Object.keys(s.newCells).length;
        const line = `${e.km}km. 블록 ${blocks}칸 탈환. ${KM_LINES[(e.km - 1) % KM_LINES.length]}`;
        pushLog(line);
        speak(`${e.km}킬로미터. 블록 ${blocks}칸.`);
      } else if (e.type === 'loop') {
        pushLog(`포위 성공. 고리 안쪽 ${e.cells}칸이 색을 되찾는다. (새로 ${e.newCells}칸)`);
        speak(`포위 성공. ${e.cells}칸을 되찾았습니다.`);
        if (useGame.getState().haptics && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (e.type === 'vehicle') {
        pushLog('속도가 너무 빠르다. 차량 이동 구간은 선으로 치지 않는다.');
      } else if (e.type === 'mocked') {
        pushLog('가짜 위치 신호가 감지되었다. 이 신호는 기록하지 않는다.');
      }
    }
  };

  const onPoints = (points: RawPoint[]) => {
    const s = sessionRef.current;
    if (!s) return;
    const owned = useGame.getState().ownedCells;
    for (const p of points) onEvents(addPoint(s, p, (id) => !!owned[id]));
  };

  const start = async () => {
    setError(null);
    setPhase('starting');
    sessionRef.current = createSession(Date.now());
    setLog([]);
    try {
      const t = await startTracking(onPoints);
      trackerRef.current = t;
      setMode(t.mode);
      setPhase('running');
      pushLog(isNight() ? '밤의 원정. 밝은 옷, 주변 소리. 회색은 어둠을 좋아한다.' : '원정 시작. 첫 선을 긋는다.');
      speak('원정을 시작합니다. 화면을 보지 않아도 됩니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('ready');
    }
  };

  const finish = (now = Date.now()) => {
    const s = sessionRef.current;
    if (!s) return;
    const summary = summarize(s, now);
    const store = useGame.getState();
    const dateKey = localDateKey();
    const before = store.totals;
    let reward: RunReward = { food: 0, parts: 0, capped: false };
    let radio: RadioLog[] = [];
    if (summary.valid) {
      reward = computeReward(summary, store.rewardedByDate[dateKey] ?? 0);
      store.commitRun(
        {
          endedAt: now,
          km: summary.km,
          paceSec: summary.paceSec,
          durationMs: summary.durationMs,
          newCells: summary.newCells.length,
          loops: summary.loops,
          regionArea: store.world?.area,
        },
        summary.newCells,
        summary.loops,
        { km: summary.km, paceSec: summary.paceSec, newCells: summary.newCells.length, loop: summary.loops > 0, food: reward.food, parts: reward.parts },
        dateKey,
        !reward.capped && reward.food + reward.parts > 0,
      );
      radio = newlyUnlocked(before, useGame.getState().totals);
    }
    setResult({ summary, reward, radio, doubled: false });
    setPhase('result');
    speak(summary.valid ? `원정 종료. ${summary.km.toFixed(1)}킬로미터, 블록 ${summary.newCells.length}칸.` : '원정 종료.');
  };

  const stop = async () => {
    await trackerRef.current?.stop();
    trackerRef.current = null;
    finish();
  };

  if (!allowed) {
    return (
      <Screen>
        <Header title="선 긋기" onBack={() => router.back()} />
        <Card>
          <T>러닝 모드는 위치 정보가 필요합니다.</T>
          <T dim style={{ marginTop: space.sm }}>
            {age === false ? '만 14세 미만은 법정대리인 동의 절차가 마련되기 전까지 러닝 모드를 쓸 수 없습니다.' : '설정에서 위치 사용에 동의하면 실제로 달린 길로 구역을 되찾을 수 있습니다.'}
          </T>
          <T faint size={13} style={{ marginTop: space.sm }}>러닝을 하지 않아도 메인 이야기는 끝까지 볼 수 있습니다.</T>
        </Card>
        {age !== false ? <Button label="설정으로" onPress={() => router.push('/settings')} /> : null}
      </Screen>
    );
  }

  if (phase === 'result' && result) {
    const { summary, reward } = result;
    const owned = Object.keys(useGame.getState().ownedCells);
    const ascii = cellsToAscii(owned, new Set(summary.newCells));
    const dateKey = localDateKey();
    const canDouble = summary.valid && !reward.capped && reward.food + reward.parts > 0 && !result.doubled && !useGame.getState().doubledByDate[dateKey];
    const shareMsg =
      `[경계선] 벽이 생긴 지 412일째, ${world ? `${world.area}에서 ` : ''}${summary.km.toFixed(2)}km를 달려 블록 ${summary.newCells.length}칸을 되찾았다.` +
      `${summary.loops ? ` 포위 ${summary.loops}회.` : ''} 평균 ${formatPace(summary.paceSec)}/km\n\n${ascii}\n\n달려라. 지도에서 지워지기 전에.\n#경계선 #선긋기 #러닝`;
    return (
      <Screen>
        <Header title="원정 보고" onBack={() => router.back()} />
        {!summary.valid ? (
          <Card>
            <T>너무 짧아 원정으로 기록되지 않았다.</T>
            <T dim style={{ marginTop: space.sm }}>최소 {300}m 이상 달리거나 걸어야 선이 남는다.</T>
          </Card>
        ) : (
          <>
            <View style={styles.bigRow}>
              <Stat label="거리" value={`${summary.km.toFixed(2)}`} unit="km" />
              <Stat label="시간" value={formatDuration(summary.durationMs)} />
              <Stat label="페이스" value={formatPace(summary.paceSec)} />
            </View>
            <View style={styles.bigRow}>
              <Stat label="새 블록" value={`${summary.newCells.length}`} unit="칸" accent />
              <Stat label="포위" value={`${summary.loops}`} unit="회" />
              <Stat label="밟은 블록" value={`${summary.totalCells}`} unit="칸" />
            </View>
            <Card>
              <T mono size={15} style={{ letterSpacing: 2 }}>{ascii}</T>
              <T faint size={12} style={{ marginTop: space.sm }}>■ 이번에 되찾은 블록 · ▣ 원래 내 블록 (축소 그림)</T>
            </Card>
            <Card>
              {reward.capped ? (
                <T dim>오늘 보급은 이미 {REWARD_RULES.dailyRewardedRuns}번 받았다. 블록과 기록은 그대로 남는다.</T>
              ) : (
                <T>보급: 식량 +{reward.food * (result.doubled ? 2 : 1)} · 부품 +{reward.parts * (result.doubled ? 2 : 1)}</T>
              )}
              {hasGame ? <T faint size={13} style={{ marginTop: space.xs }}>거점으로 돌아가면 "원정 보고"를 할 수 있다.</T> : null}
            </Card>
            {result.radio.length ? (
              <Card style={{ borderColor: colors.accent }}>
                <T style={{ color: colors.accent }}>새 무전 수신</T>
                {result.radio.map((r) => (
                  <T key={r.id} dim>· {r.title} ({r.from})</T>
                ))}
              </Card>
            ) : null}
            {canDouble ? (
              <Button
                testID="btn-double"
                label="광고 보고 보급 두 배"
                sub="하루 한 번"
                onPress={async () => {
                  if (!(await watchRewardedAd('run_double'))) return;
                  const st = useGame.getState();
                  if (st.pendingRun) st.set({ pendingRun: { ...st.pendingRun, food: st.pendingRun.food * 2, parts: st.pendingRun.parts * 2 } });
                  st.set({ doubledByDate: { ...st.doubledByDate, [dateKey]: true } });
                  setResult({ ...result, doubled: true });
                }}
              />
            ) : null}
            <Button label="공유하기" onPress={() => shareText(shareMsg)} />
          </>
        )}
        {hasGame ? <Button kind="primary" label="거점으로 돌아가기" onPress={() => router.replace('/game')} /> : null}
        <Button kind="ghost" label="처음 화면으로" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (phase === 'running' || phase === 'starting') {
    const s = sessionRef.current;
    const now = Date.now();
    const km = s ? s.distanceM / 1000 : 0;
    const pace = s && km >= 0.2 ? s.movingMs / 1000 / km : 0;
    return (
      <Screen scroll={false}>
        <T faint mono size={12}>{mode === 'background' ? '화면을 꺼도 기록됩니다' : '화면을 켠 채로 두세요 (이 환경에서는 백그라운드 기록이 꺼져 있습니다)'}</T>
        <View style={styles.runHero}>
          <Text style={styles.runKm}>{km.toFixed(2)}</Text>
          <T dim>km</T>
        </View>
        <View style={styles.bigRow}>
          <Stat label="시간" value={formatDuration(s ? now - s.startedAt : 0)} />
          <Stat label="페이스" value={formatPace(pace)} />
          <Stat label="새 블록" value={`${s ? Object.keys(s.newCells).length : 0}`} unit="칸" accent />
        </View>
        <View style={styles.log}>
          {log.map((l, i) => (
            <T key={i} dim={i > 0} size={14}>{l}</T>
          ))}
        </View>
        <Button testID="btn-stop" kind="danger" label={phase === 'starting' ? '위치 신호를 찾는 중…' : '원정 종료'} disabled={phase === 'starting'} onPress={stop} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="선 긋기" onBack={() => router.back()} />
      <T size={20} style={{ marginBottom: space.sm }}>실제로 달린 길이 선이 된다.</T>
      <T dim>달린 길 위의 블록(약 110m)을 되찾는다. 출발한 자리로 돌아와 고리를 닫으면, 안쪽 블록까지 한꺼번에 되찾는다.</T>
      <Card>
        <T size={14}>· 화면을 보지 않아도 된다. 1km마다 음성으로 알려 준다.</T>
        <T size={14}>· 주변 소리가 들리게 이어폰 볼륨을 낮춘다.</T>
        <T size={14}>· 차도, 사유지, 출입 금지 구역(군사시설 등)에는 들어가지 않는다.</T>
        {isNight() ? <T size={14} style={{ color: colors.accent }}>· 지금은 밤이다. 밝은 옷을 입고, 밝은 길로만 달린다.</T> : null}
        <T faint size={13} style={{ marginTop: space.sm }}>걷기도 된다. 25km/h를 넘는 구간(차량)과 가짜 위치는 기록하지 않는다.</T>
      </Card>
      <T faint size={13} style={{ marginBottom: space.sm }}>
        오늘 보급 {Math.min(rewardedToday, REWARD_RULES.dailyRewardedRuns)}/{REWARD_RULES.dailyRewardedRuns}회 · 위치는 블록으로 바뀌어 기기에만 저장된다
      </T>
      {error ? <T style={{ color: colors.danger, marginBottom: space.sm }}>{error}</T> : null}
      <Button testID="btn-start-run" kind="primary" label="원정 출발" onPress={start} />
    </Screen>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.accent }]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  runHero: { alignItems: 'center', marginVertical: space.xl },
  runKm: { color: colors.text, fontSize: 84, fontFamily: fonts.mono, fontWeight: '700' },
  bigRow: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  stat: { flex: 1, backgroundColor: colors.bgRaised, borderRadius: 8, padding: space.md, borderWidth: 1, borderColor: colors.line },
  statLabel: { color: colors.textDim, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 22, fontFamily: fonts.mono, marginTop: 4 },
  statUnit: { color: colors.textDim, fontSize: 13 },
  log: { flex: 1, gap: space.sm, marginVertical: space.lg, overflow: 'hidden' },
});
