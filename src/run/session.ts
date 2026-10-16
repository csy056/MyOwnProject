import { cellOf, cellsAlongSegment, cellsInsideLoop, haversineM, type CellId } from './grid';

// 러닝 한 번의 기록. 순수 함수로만 상태를 바꿔 테스트하기 쉽게 한다.
// 원래 좌표(path)는 메모리에만 있고 러닝이 끝나면 버린다.

export const RUN_RULES = {
  maxAccuracyM: 35, // 이보다 부정확한 위치는 버린다
  maxSpeedMps: 7, // 25.2km/h 초과 구간은 차량으로 보고 버린다
  vehicleStreak: 4, // 연속 초과 횟수가 이만큼이면 "차량 의심" 경고
  minMoveM: 3, // 이보다 작은 이동은 GPS 떨림으로 본다
  minSpeedMps: 0.3, // 이보다 느린 이동(시속 약 1km)은 제자리 떨림으로 본다
  maxGapS: 60, // 신호가 이보다 오래 끊기면 그 사이 이동은 세지 않는다
  maxSegmentM: 400,
  pathSampleM: 10,
  loopCloseM: 35, // 출발점 근처로 이만큼 돌아오면 고리가 닫힌 것
  loopMinPerimeterM: 300,
  loopMinCells: 4,
  minRunKm: 0.3, // 이보다 짧으면 원정으로 치지 않는다
} as const;

export type RawPoint = {
  lat: number;
  lon: number;
  accuracy: number | null;
  timestamp: number;
  mocked?: boolean;
};

type PathPt = { lat: number; lon: number; cumM: number };

export type RunSession = {
  startedAt: number;
  endedAt?: number;
  last?: { lat: number; lon: number; t: number; acc: number };
  distanceM: number;
  movingMs: number;
  cells: Record<CellId, 1>; // 이번 러닝에서 밟거나 포위한 블록
  newCells: Record<CellId, 1>; // 그중 원래 내 땅이 아니던 블록
  path: PathPt[];
  loops: number;
  loopCells: number;
  rejected: { accuracy: number; speed: number; mocked: number };
  speedStreak: number;
  vehicleSuspect: boolean;
  kmAnnounced: number;
};

export type RunEvent =
  | { type: 'km'; km: number }
  | { type: 'loop'; cells: number; newCells: number }
  | { type: 'vehicle' }
  | { type: 'mocked' };

export function createSession(now: number): RunSession {
  return {
    startedAt: now,
    distanceM: 0,
    movingMs: 0,
    cells: {},
    newCells: {},
    path: [],
    loops: 0,
    loopCells: 0,
    rejected: { accuracy: 0, speed: 0, mocked: 0 },
    speedStreak: 0,
    vehicleSuspect: false,
    kmAnnounced: 0,
  };
}

function claim(s: RunSession, ids: CellId[], isOwned: (id: CellId) => boolean): number {
  let added = 0;
  for (const id of ids) {
    if (s.cells[id]) continue;
    s.cells[id] = 1;
    if (!isOwned(id)) {
      s.newCells[id] = 1;
      added++;
    }
  }
  return added;
}

/** 위치 하나를 기록에 반영한다. 세션 객체를 직접 바꾸고 발생한 사건을 돌려준다. */
export function addPoint(s: RunSession, p: RawPoint, isOwned: (id: CellId) => boolean): RunEvent[] {
  const events: RunEvent[] = [];
  if (p.mocked) {
    s.rejected.mocked++;
    if (s.rejected.mocked === 1) events.push({ type: 'mocked' });
    return events;
  }
  if (p.accuracy != null && p.accuracy > RUN_RULES.maxAccuracyM) {
    s.rejected.accuracy++;
    return events;
  }

  const acc = p.accuracy ?? 0;
  if (!s.last) {
    s.last = { lat: p.lat, lon: p.lon, t: p.timestamp, acc };
    s.path.push({ lat: p.lat, lon: p.lon, cumM: 0 });
    claim(s, [cellOf(p.lat, p.lon)], isOwned);
    return events;
  }

  const dt = (p.timestamp - s.last.t) / 1000;
  if (dt <= 0) return events;
  const d = haversineM(s.last.lat, s.last.lon, p.lat, p.lon);

  // 오래 끊겼다가 멀리서 돌아오면 그 사이 이동은 세지 않고 새로 시작한다.
  // 거의 제자리였다면(신호 대기, 신발 끈) 멈춘 것으로 보고 경로를 이어 간다.
  const paused = dt > RUN_RULES.maxGapS && d <= RUN_RULES.loopCloseM;
  if (paused) {
    s.last = { ...s.last, t: p.timestamp };
    return events;
  }
  if (dt > RUN_RULES.maxGapS || d > RUN_RULES.maxSegmentM) {
    s.last = { lat: p.lat, lon: p.lon, t: p.timestamp, acc };
    s.path = [{ lat: p.lat, lon: p.lon, cumM: s.distanceM }];
    return events;
  }
  // 제자리에서도 GPS는 몇 m씩 흔들린다. 두 위치의 정확도를 더한 거리 안쪽은 떨림으로 본다.
  // 기준점을 옮기지 않으므로 천천히 걸어도 거리가 쌓이면 결국 넘어선다.
  const jitter = Math.max(RUN_RULES.minMoveM, s.last.acc + acc);
  if (d < jitter) return events;

  const speed = d / dt;
  // 한참 제자리에 있다가 떨림이 기준을 넘은 경우: 거리로 세지 않고 기준점만 옮긴다.
  if (speed < RUN_RULES.minSpeedMps) {
    s.last = { lat: p.lat, lon: p.lon, t: p.timestamp, acc };
    return events;
  }
  if (speed > RUN_RULES.maxSpeedMps) {
    s.rejected.speed++;
    s.speedStreak++;
    if (s.speedStreak >= RUN_RULES.vehicleStreak) {
      if (!s.vehicleSuspect) {
        s.vehicleSuspect = true;
        events.push({ type: 'vehicle' });
      }
      // 차량 이동이 이어지면 그 뒤에 엉뚱하게 이어 붙지 않도록 기준점을 옮긴다.
      s.last = { lat: p.lat, lon: p.lon, t: p.timestamp, acc };
      s.path = [{ lat: p.lat, lon: p.lon, cumM: s.distanceM }];
    }
    // 한두 번 튄 위치는 버리고 기준점은 그대로 둔다.
    return events;
  }
  s.speedStreak = 0;
  s.vehicleSuspect = false;

  s.distanceM += d;
  if (speed > 0.5) s.movingMs += dt * 1000;
  claim(s, cellsAlongSegment(s.last.lat, s.last.lon, p.lat, p.lon), isOwned);
  s.last = { lat: p.lat, lon: p.lon, t: p.timestamp, acc };

  const tail = s.path[s.path.length - 1];
  if (!tail || haversineM(tail.lat, tail.lon, p.lat, p.lon) >= RUN_RULES.pathSampleM) {
    s.path.push({ lat: p.lat, lon: p.lon, cumM: s.distanceM });
  }

  // 고리 닫힘 검사: 충분히 돈 뒤 예전 지점 근처로 돌아왔는가
  const limit = s.distanceM - RUN_RULES.loopMinPerimeterM;
  for (let i = 0; i < s.path.length - 1; i++) {
    const q = s.path[i];
    if (q.cumM > limit) break;
    if (haversineM(q.lat, q.lon, p.lat, p.lon) <= RUN_RULES.loopCloseM) {
      const loop = s.path.slice(i);
      const inside = cellsInsideLoop(loop);
      if (inside.length >= RUN_RULES.loopMinCells) {
        const added = claim(s, inside, isOwned);
        s.loops++;
        s.loopCells += inside.length;
        events.push({ type: 'loop', cells: inside.length, newCells: added });
        // 같은 고리를 다시 세지 않도록 경로를 새로 시작한다.
        s.path = [{ lat: p.lat, lon: p.lon, cumM: s.distanceM }];
      } else {
        // 갔다가 되돌아온 짧은 왕복은 고리가 아니다. 왕복 구간만 잘라 내고 앞의 경로는 남겨,
        // 더 큰 고리가 나중에 닫힐 수 있게 한다.
        s.path = s.path.slice(0, i + 1);
      }
      break;
    }
  }

  const km = Math.floor(s.distanceM / 1000);
  if (km > s.kmAnnounced) {
    s.kmAnnounced = km;
    events.push({ type: 'km', km });
  }
  return events;
}

export type RunSummary = {
  startedAt: number;
  endedAt: number;
  km: number; // 소수 둘째 자리
  durationMs: number;
  movingMs: number;
  paceSec: number; // 1km당 초, 기록이 짧으면 0
  newCells: CellId[];
  totalCells: number;
  loops: number;
  valid: boolean; // 원정으로 칠 만큼 달렸는가
  rejectedRatio: number;
};

export function summarize(s: RunSession, now: number): RunSummary {
  const km = Math.round(s.distanceM / 10) / 100;
  const paceSec = km >= 0.2 && s.movingMs > 0 ? Math.round(s.movingMs / 1000 / km) : 0;
  const rejected = s.rejected.accuracy + s.rejected.speed + s.rejected.mocked;
  return {
    startedAt: s.startedAt,
    endedAt: now,
    km,
    durationMs: now - s.startedAt,
    movingMs: s.movingMs,
    paceSec,
    newCells: Object.keys(s.newCells),
    totalCells: Object.keys(s.cells).length,
    loops: s.loops,
    valid: km >= RUN_RULES.minRunKm,
    rejectedRatio: rejected / Math.max(1, rejected + s.path.length),
  };
}

export function formatPace(sec: number): string {
  if (!sec || !Number.isFinite(sec)) return "--'--\"";
  const t = Math.round(sec);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
