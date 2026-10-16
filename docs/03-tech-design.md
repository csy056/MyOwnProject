# 03. 기술 설계

## 한눈에 보기

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 앱 | Expo SDK 58 (React Native 0.88) + TypeScript + Expo Router | 하나의 코드로 Android·iOS·웹. EAS로 Mac 없이 빌드·제출 |
| 스토리 | ink 스크립트 → `inkjs`로 실행 | 분기 스토리 전용 언어. 코드 없이 글로 쓴다. `scripts/compile-story.mjs`로 컴파일 |
| 상태 | zustand + AsyncStorage | 모든 데이터는 기기 안에 저장. 서버 없음 |
| 위치 | expo-location + 내장 시·군·구 경계 데이터 | 좌표를 기기 안에서 구역 이름으로만 바꾼다 |
| 러닝 | expo-location + expo-task-manager | 개발 빌드는 화면을 꺼도 기록(Android 포그라운드 서비스, iOS 위치 표시줄). "항상 허용" 권한은 요청하지 않는다. Expo Go·웹은 화면 켜 둠 |
| 음성·진동 | expo-speech, expo-haptics | 달리는 동안 화면을 보지 않게 |
| 지도 그림 | react-native-svg | 지도 타일 없이 블록 격자만 그린다 |
| 광고·결제 | `src/monetization` 추상화 + 시뮬레이션 | 계정이 생기면 실제 SDK로 바꾼다 |

## 폴더 구조

```
story/                 ink 스토리 원본 (작가가 수정하는 곳)
  main.ink             변수, 허브, 이벤트 분배기 (엔진 담당)
  *.ink                본문
scripts/
  compile-story.mjs    ink → src/story/story.json
  playtest.mjs         자동 플레이 검사 (막힘, 엔딩 도달, 미완성 문구)
  build-regions.mjs    전국 경계 → src/data/regions.json
  make-icons.mjs       앱 아이콘 생성
  play-cli.mjs         터미널에서 스토리를 한 단계씩 플레이 (기획 검토, 플레이테스트)
  build-web-demo.mjs   웹 빌드를 한 장짜리 데모 페이지로 묶기 (정적 호스팅용)
data/raw/              원본 경계 데이터 (KOSTAT 2013 단순화본)
src/
  app/                 화면 (Expo Router: 파일 하나 = 화면 하나)
    index.tsx          타이틀
    onboarding.tsx     세계관 소개, 만 14세 확인, 위치 동의
    start.tsx          시작 구역 판별·선택, 루트 선택
    game.tsx           스토리 화면 (상태 바, 본문, 선택지, 엔딩)
    run.tsx            러닝 (준비 → 기록 → 원정 보고)
    territory.tsx      되찾은 지도
    records.tsx        단서, 무전, 구역, 엔딩 도감
    settings.tsx       글자 크기, 음성, 위치, 상점, 초기화
  engine/              ink 래퍼, 게임 세션(저장·되감기·러닝 반영), 조사 처리
  location/            구역 판별, 밤낮
  run/                 블록 격자, 러닝 세션(치트 필터·포위), 보상, 위치 수집
  content/             무전 기록, 엔딩 이름
  monetization/        광고·결제 추상화
  state/               저장소
  ui/                  테마, 공용 컴포넌트, 공유
tests/                 단위 테스트 (jest)
```

## 데이터 흐름

```
[위치] → lookupRegion (기기 안) → 구역 이름 → ink 변수(dome_name, area_name, area_kind ...)
[실제 시각] → isNight → ink 변수 is_night (진행할 때마다)
[러닝] → 세션(메모리) → 블록 ID + 요약 → 저장소(ownedCells, totals, pendingRun)
        → 다음에 스토리 화면을 열 때 ink 변수(run_*, last_run_*, pending_debrief, food, parts)로 반영
[ink] → 화면(page) 단위 출력 → game.tsx
```

- 허브 선택지는 허브에 도착할 때 계산된다. 그래서 러닝 결과가 반영되면 허브를 다시 그린다 (`refreshHubIfIdle`).
- 선택할 때마다 직전 상태를 `rewind`로 저장한다. 체력이나 정신이 바닥난 선택에서는 바로 엔딩으로 가므로, 사망·회색 엔딩에서 보상형 광고로 되감으면 그 선택 직전으로 돌아간다.
- 저장에는 스토리 버전(컴파일 결과의 해시)이 붙는다. 업데이트로 스토리가 바뀌면 변수(체력, 단서, 장 진행)만 옮겨 허브에서 이어 간다.

## 실행과 검증

```bash
npm install
npm start               # Expo 개발 서버 (휴대폰의 Expo Go로 QR 스캔)
npm run web             # 브라우저에서 실행
npm run story:test      # 스토리 컴파일 + 자동 플레이 1500회
npm run typecheck       # 타입 검사
npm test                # 단위 테스트
npm run check           # 위 셋 모두
```

`npm start`, `npm run web` 전에 스토리가 자동으로 컴파일된다.

## 웹 데모 만들기

```bash
npx expo export --platform web --output-dir dist
node scripts/build-web-demo.mjs web-demo     # web-demo/index.html + js/*.js
```

웹 빌드는 화면별로 나누지 않고 스크립트 하나로 묶는다 (`app.json`의 `asyncRoutes.web: false`). 그래서 어떤 경로에 올려도 동작한다. 웹에서는 위치 권한 요청이 10초 안에 응답하지 않으면 거부로 보고 직접 선택으로 넘어간다.

## 빌드와 출시 (EAS)

1. [expo.dev](https://expo.dev) 계정을 만들고 `npx eas-cli@latest login`
2. `npx eas-cli@latest build:configure` → `eas.json` 생성
3. 개발 빌드: `npx eas-cli@latest build --profile development --platform android` (백그라운드 러닝 테스트는 개발 빌드에서만 가능)
4. 스토어 빌드: `npx eas-cli@latest build --profile production --platform all`
5. 제출: `npx eas-cli@latest submit -p android` / `-p ios`

필요한 계정: Google Play 개발자(1회 $25), Apple Developer(연 $99).

## 광고·결제를 실제 SDK로 바꾸는 방법

`src/monetization/index.ts`의 `MonetizationProvider`를 구현해 `setMonetizationProvider()`로 등록한다. 화면 코드는 바꾸지 않는다.

| 기능 | 추천 | 비고 |
| --- | --- | --- |
| 보상형 광고 | `react-native-google-mobile-ads` (AdMob) | 네이티브 모듈이라 개발 빌드 필요. 웹은 시뮬레이션 유지 |
| 인앱 결제 | RevenueCat (`react-native-purchases`) 또는 `expo-iap` | 상품 ID: `remove_ads`, `supporter_pack` |

광고 SDK에 위치·건강 데이터를 넘기지 않는다. (비개인화 광고 요청 옵션 사용)

## 구역 데이터

- 출처: 통계청 센서스용 행정구역경계 2013 단순화본 ([southkorea/southkorea-maps](https://github.com/southkorea/southkorea-maps))
- 보정한 변경 사항: 강원특별자치도(2023), 전북특별자치도(2024), 청주·청원 통합(2014), 인천 남구 → 미추홀구(2018), 군위군 대구 편입(2023), 인천 제물포구·영종구·검단구(2026.7, 경계 근사)
- 일반구가 있는 시(수원, 성남, 고양 등)는 시 단위로 묶는다.
- 해안 구역 목록과 고유 이야기 구역은 `scripts/build-regions.mjs`에 있다.
- 더 정확한 최신 경계가 필요하면 브이월드나 도로명주소 경계로 바꾸고 같은 스크립트로 다시 만든다.

## 알려진 한계

| 한계 | 영향 | 대응 |
| --- | --- | --- |
| Expo Go·웹은 백그라운드 위치를 지원하지 않는다 | 러닝 중 화면을 켜 둬야 한다 | 개발 빌드에서 테스트 |
| 인천 개편 구역 경계를 근사했다 | 경계 근처에서 구역이 틀릴 수 있다 | 최신 경계 데이터로 교체 |
| 경계 단순화로 해안선 근처 판별 오차 | 바닷가에서 가장 가까운 구역으로 잡힌다 (12km 이내) | 상동 |
| 광고·결제가 시뮬레이션이다 | 수익이 나지 않는다 | 계정 생성 후 SDK 연결 |
