// 전국 시·군·구 경계(KOSTAT 2013 단순화본)를 게임용 구역 데이터로 변환한다.
// 출처: https://github.com/southkorea/southkorea-maps (KOSTAT 센서스용 행정구역경계 2013)
// 2013년 이후 바뀐 행정구역은 아래 CHANGES 에서 보정한다.
// 사용법: node scripts/build-regions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'data/raw/kostat2013_municipalities_simple.json'), 'utf8'));

// 시·도 코드(앞 2자리) → [시·도 이름, 돔 이름(광역시 단위일 때)]
const SIDO = {
  11: ['서울특별시', '서울'],
  21: ['부산광역시', '부산'],
  22: ['대구광역시', '대구'],
  23: ['인천광역시', '인천'],
  24: ['광주광역시', '광주'],
  25: ['대전광역시', '대전'],
  26: ['울산광역시', '울산'],
  29: ['세종특별자치시', '세종'],
  31: ['경기도', null],
  32: ['강원특별자치도', null], // 2023 명칭 변경
  33: ['충청북도', null],
  34: ['충청남도', null],
  35: ['전북특별자치도', null], // 2024 명칭 변경
  36: ['전라남도', null],
  37: ['경상북도', null],
  38: ['경상남도', null],
  39: ['제주특별자치도', null],
};

// 바다에 닿은 구역 (시·도 코드:구역 이름)
const COASTAL = new Set([
  '21:기장군', '21:해운대구', '21:수영구', '21:남구', '21:영도구', '21:중구', '21:동구', '21:서구', '21:사하구', '21:강서구',
  '23:중구', '23:동구', '23:미추홀구', '23:연수구', '23:남동구', '23:서구', '23:강화군', '23:옹진군', '23:제물포구', '23:영종구', '23:검단구',
  '26:동구', '26:북구', '26:남구', '26:울주군',
  '31:김포시', '31:시흥시', '31:안산시', '31:화성시', '31:평택시',
  '32:고성군', '32:속초시', '32:양양군', '32:강릉시', '32:동해시', '32:삼척시',
  '34:당진시', '34:서산시', '34:태안군', '34:홍성군', '34:보령시', '34:서천군', '34:아산시',
  '35:군산시', '35:김제시', '35:부안군', '35:고창군',
  '36:영광군', '36:함평군', '36:무안군', '36:목포시', '36:신안군', '36:영암군', '36:해남군', '36:진도군', '36:완도군',
  '36:강진군', '36:장흥군', '36:보성군', '36:고흥군', '36:순천시', '36:여수시', '36:광양시',
  '37:울진군', '37:영덕군', '37:포항시', '37:경주시', '37:울릉군',
  '38:창원시', '38:거제시', '38:통영시', '38:고성군', '38:사천시', '38:남해군', '38:하동군',
  '39:제주시', '39:서귀포시',
]);

// 고유 이벤트가 있는 구역
const UNIQUE = {
  '11:종로구': 'seoul_jongno',
  '11:마포구': 'seoul_mapo',
  '11:영등포구': 'seoul_yeongdeungpo',
  '11:송파구': 'seoul_songpa',
  '21:해운대구': 'busan_haeundae',
  '25:유성구': 'daejeon_yuseong',
};

const round = (n) => Math.round(n * 10000) / 10000;

function polygonsOf(geom) {
  return geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
}

// 구역 이름 정리: 일반구가 있는 시는 시 단위로 묶는다. (예: 수원시영통구 → 수원시)
function baseName(sidoCode, name) {
  if (sidoCode >= 31) {
    const m = /^(.+?시)(.+구)$/.exec(name);
    if (m) return m[1];
    if (name === '청원군') return '청주시'; // 2014 청주시·청원군 통합
  }
  if (sidoCode === 23 && name === '남구') return '미추홀구'; // 2018 명칭 변경
  return name;
}

// 2026.7.1 인천 행정체제 개편 근사: 중구 영종도 → 영종구, 중구 내륙·동구 → 제물포구, 서구 북부 → 검단구.
// 경계 데이터가 없어 경도/위도 기준으로 나눈다. 정확한 경계 데이터가 생기면 교체한다.
function incheonSplit(name, ring) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  if (name === '중구') return cx < 126.585 ? '영종구' : '제물포구';
  if (name === '동구') return '제물포구';
  if (name === '서구') return cy > 37.57 ? '검단구' : '서구';
  return name;
}

const regions = new Map();

for (const f of src.features) {
  const code = f.properties.code;
  let sidoCode = Number(code.slice(0, 2));
  let name = baseName(sidoCode, f.properties.name);
  if (sidoCode === 37 && name === '군위군') sidoCode = 22; // 2023 군위군 대구 편입
  const [sido, metroDome] = SIDO[sidoCode];

  for (const poly of polygonsOf(f.geometry)) {
    let areaName = name;
    if (sidoCode === 23) areaName = incheonSplit(name, poly[0]);
    const id = `${sidoCode}:${areaName}`;
    if (!regions.has(id)) {
      const isMetro = metroDome !== null;
      let kind;
      if (sidoCode === 29) kind = 'city';
      else if (isMetro) kind = areaName.endsWith('군') ? 'county' : 'metro';
      else kind = areaName.endsWith('군') ? 'county' : 'city';
      regions.set(id, {
        id,
        sido,
        dome: isMetro ? metroDome : areaName,
        area: sidoCode === 29 ? '세종시' : areaName,
        kind,
        coastal: COASTAL.has(id),
        key: UNIQUE[id] ?? '',
        rings: [],
      });
    }
    const r = regions.get(id);
    for (const ring of poly) r.rings.push(ring.map(([x, y]) => [round(x), round(y)]));
  }
}

const out = [...regions.values()].map((r) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sx = 0, sy = 0, n = 0;
  for (const ring of r.rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    sx += x; sy += y; n++;
  }
  return { ...r, bbox: [minX, minY, maxX, maxY].map(round), center: [round(sx / n), round(sy / n)], rings: r.rings.map((ring) => ring.flat()) };
});

out.sort((a, b) => a.id.localeCompare(b.id, 'ko'));
const file = path.join(root, 'src/data/regions.json');
fs.writeFileSync(file, JSON.stringify(out));
const kinds = out.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});
console.log(`구역 ${out.length}개 저장 (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`, kinds,
  `해안 ${out.filter((r) => r.coastal).length}, 고유 ${out.filter((r) => r.key).length}, 돔 ${new Set(out.map((r) => r.sido + r.dome)).size}`);
