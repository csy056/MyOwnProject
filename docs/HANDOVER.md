# 인수인계서 (로컬 세션용)

> 작성: 2026-10-17 04:20 KST · 클라우드 세션에서 로컬(일반) Claude Code 세션으로 넘기기 위한 문서
> 저장소: `csy056/MyOwnProject` · 브랜치: `claude/tender-faraday-7l5mh7` (main에는 아직 합치지 않았다)

새 세션은 이 문서만 읽고 바로 이어서 일할 수 있어야 한다. 클라우드 컨테이너에만 있던 파일(브라우저 테스트 스크립트, 화면 캡처)은 모두 저장소로 옮겼다.

---

## 1. 한 줄 요약

**"경계선"(가제)** 은 대한민국 모든 시·군이 행정 경계를 따라 벽에 갇힌 세계를 배경으로 한 위치 적응형 생존 텍스트 RPG(모바일, Expo)다. 실제로 달린 길이 이야기 속 지도를 되찾는다. **MVP가 완성됐다.** 앱, 스토리 전체, 러닝 모드, 테스트, 웹 데모가 동작한다. 남은 일은 실제 기기 검증, 1.1 기능, 오너의 계정·법률 작업이다.

- **웹 데모(비공개):** https://claude.ai/artifact/LNMqNqv1MRrRjUkqvvm5JJ
  - 버전 1이다. 플레이테스트 반영 전 빌드라서 최신 코드보다 오래됐다. 다시 게시하는 방법은 6장에 있다.
  - 위치와 러닝 기능은 빠져 있다. 시작 구역을 직접 골라 플레이한다.

## 2. 로컬에서 시작하기

```bash
git clone https://github.com/csy056/MyOwnProject.git
cd MyOwnProject
git checkout claude/tender-faraday-7l5mh7
npm install                     # Node 22 권장 (클라우드에서는 v22.22.0 사용)
npm run check                   # 스토리 컴파일 + 자동 플레이 1500회 + 타입 검사 + 테스트 56개
```

실행:

| 목적 | 명령 | 비고 |
| --- | --- | --- |
| 휴대폰에서 실행 | `npm start` → 휴대폰 Expo Go로 QR 스캔 | Expo Go는 화면 꺼짐 상태의 러닝 기록과 이미지 공유가 안 된다 |
| 브라우저에서 실행 | `npm run web` | 위치는 브라우저 권한으로 동작한다. 러닝은 화면을 켜 둔 채로 테스트한다 |
| 실제 기기 빌드 | `npx eas-cli@latest build --profile development --platform android` | 화면 꺼짐 러닝 기록, 이미지 공유, 알림을 검증하려면 개발 빌드가 필요하다 (`eas.json`은 아직 없다. `npx eas-cli@latest build:configure`로 만든다) |
| 터미널에서 스토리만 | `node scripts/play-cli.mjs new --save /tmp/p.json` → `choose <n>` | 기획 검토, 플레이테스트용 |

`npm start`, `npm run web` 전에 `story/*.ink`가 자동으로 컴파일된다 (`prestart`, `preweb`).

## 3. 무엇이 어디에 있나

```
docs/                    기획·설계 문서 (아래 표)
docs/screenshots/        README용 화면 캡처
story/*.ink              스토리 원본 (ink). 엔진 연결은 main.ink
src/app/                 화면 (Expo Router): index, onboarding, start, game, run, territory, records, settings, legal
src/engine/              ink 래퍼(storyEngine), 게임 세션(gameSession: 저장·되감기·러닝 반영·허브 안내), 조사(josa)
src/location/            전국 구역 판별(regions), 위치 읽기(locate), 밤낮(daynight)
src/run/                 블록 격자(grid), 러닝 세션(session: 치트 필터·포위), 보상(rewards), 위치 수집(tracker, backgroundTask), GPX 가져오기(gpx)
src/content/             무전 기록(radio), 엔딩 이름과 대표 문장(endings), 도윤 대사(quotes), 약관 초안(legal)
src/monetization/        광고·결제 추상화 (지금은 시뮬레이션)
src/state/store.ts       zustand + AsyncStorage 저장소 (서버 없음)
src/data/regions.json    전국 229개 구역 경계 (scripts/build-regions.mjs로 생성)
src/story/story.json     컴파일된 스토리 (직접 고치지 않는다)
scripts/                 compile-story, playtest(자동 플레이 봇), play-cli, build-regions, make-icons, build-web-demo
e2e/                     브라우저 흐름 테스트(Playwright): shots.mjs, server.mjs, demo-check.mjs
tests/                   jest 테스트 56개 (logic, story, session, regressions, gpx)
```

| 문서 | 읽을 때 |
| --- | --- |
| [00. 컨셉과 냉정한 검토](00-concept-review.md) | 왜 이 게임인가, 약점, 지표와 손절 기준, 플레이테스트 점수 |
| [01. 아이데이션](01-ideation.md) | 오너가 내린 결정 기록 |
| [02. 러닝 모드](02-running-mode.md) | KYRO·INTVL·ZRX 조사, 땅따먹기 규칙, 치트 기준, 안전, 로드맵 |
| [03. 기술 설계](03-tech-design.md) | 데이터 흐름, 빌드·출시, 광고·결제 연결 방법, 웹 데모 만들기 |
| [04. 스토리 바이블](04-story-bible.md) | 세계관, 인물, 3막, 엔딩. 스토리를 고치기 전에 반드시 읽는다 |
| [05. 스토리 작성 가이드](05-story-guide.md) | ink 규칙, 노트 이름 계약, 보상 크기, 태그 |

## 4. 오너가 내린 결정 (바꾸려면 오너에게 묻는다)

| 항목 | 결정 |
| --- | --- |
| 플랫폼 | 모바일 앱 (Android 먼저, iOS 동시 목표) |
| 핵심 루프 | 스토리 분기 중심 텍스트 RPG |
| 수익 | 무료 + 광고/인앱 결제 |
| 모티브 | 서울2033. 단, IP는 독자적으로 (지하철 중심 서사를 피함) |
| 무대 | 서울만이 아니라 전국. 해외 접속은 외부인 루트 |
| 위치 기능 | MVP에 L1 시작 거점, L2 지역 이벤트, L3 구역 발견, L4 실제 밤낮 모두 포함 |
| 러닝 | "일본 러닝 땅따먹기"(실제로는 한국 앱 KYRO) 같은 플러스 알파. 재미·바이럴·러너 호감을 노림 |
| 개발 방식 | 오너는 코딩 경험이 적다. 코드는 Claude가 쓴다 |

## 5. 현재 상태와 검증 결과

| 검사 | 결과 | 다시 돌리는 법 |
| --- | --- | --- |
| jest | 56개 통과 | `npm test` |
| 스토리 자동 플레이 3000회 | 엔딩 7개 모두 도달, 막힘 0. 사망·회색 27%, 탈출·잔류 50%, 진실 23%, 평균 선택 66회, 한 화면 최대 8문단 | `node scripts/playtest.mjs 3000` |
| 타입 검사 | 통과 | `npm run typecheck` |
| 브라우저 흐름 | 생존자(마포), 러닝(석촌호수 고리 → 원정 보고), 외부인(도쿄), 농어촌(양평), GPX 가져오기와 중복 거절. 오류 0건 | 7장 참고 |
| 코드 리뷰 1차 | 4개 관점, 반박 검증 후 확인된 51건 모두 수정 | - |
| 페르소나 플레이테스트 | 러너·스토리 팬·퍼블리셔 3명. 도입 7~9, 스토리 8~9, 러닝 연동 4~7, 바이럴 5~6. 지적 사항 대부분 반영 | `scripts/play-cli.mjs` |

**검증하지 못한 것 (중요):**

1. **실제 휴대폰 검증.** GPS 오차, 배터리, 화면 꺼짐 기록(Android 포그라운드 서비스, iOS 위치 표시줄), 이미지 공유(`react-native-view-shot`), 햅틱, 음성 안내. 모두 개발 빌드가 필요하다.
2. **늦게 바뀐 코드의 2차 리뷰.** 사용 한도 때문에 실행하지 못했다. 1차 리뷰 이후 바뀐 부분을 같은 방식(관점별 리뷰 → 반박 검증)으로 다시 본다. 대상은 `git diff f61705e HEAD -- src tests`로 확인한다.
   - `src/engine/gameSession.ts`: 치명적 선택 시 즉시 엔딩, 하루 유지비, 허브 안내
   - `src/app/game.tsx`: 엔딩 공유 카드, 변화량 표시
   - `src/app/run.tsx`, `src/run/gpx.ts`: GPX 가져오기, 도윤 대사 카드
3. **게시된 웹 데모의 실제 렌더링.** 클라우드 세션에는 게시된 페이지를 직접 볼 도구가 없었다. 같은 조건(하위 경로, 위치 권한 없음)은 로컬에서 재현해 확인했다 (`e2e/demo-check.mjs`).

## 6. 남은 일 (우선순위 순)

| 순위 | 할 일 | 메모 |
| --- | --- | --- |
| 1 | 실제 기기 개발 빌드로 러닝 테스트 | 5장 "검증하지 못한 것" 1번 |
| 1 | 늦게 바뀐 코드 2차 리뷰 | 5장 2번 |
| 1 | 건강 앱 자동 가져오기 (Health Connect, HealthKit 운동 경로) | GPX 가져오기는 완료. `src/run/gpx.ts`의 `checkImport` → 세션 처리 흐름을 재사용한다. 네이티브 모듈이라 개발 빌드가 필요하다 |
| 2 | 실제 날짜로 장 열기 (4장부터 "다음 날 또는 오늘 원정"), 저녁 알림 | 40~60분이면 끝나 재방문 이유가 약하다. 밸런스를 다시 맞춰야 한다 |
| 2 | 새 대화가 있는 거점 인물 표시 | 강화 비용·효과 표시는 허브 안내판에 넣었다 |
| 2 | 7장 이후 허브 긴장 유지 (쉬기 제한 또는 하루마다 정신 감소) | 클라이맥스 직전 긴장이 풀린다 |
| 2 | 경제 압박 (4장부터 식량 소모 증가 등) + "합리적 봇" 시뮬레이션 | 사람은 식량이 남아돌아 러닝 보급의 체감이 약하다. 지금 봇은 무작위라 사람보다 훨씬 자주 죽는다 |
| 2 | 웹 데모 다시 게시 | 아래 명령으로 만든 뒤 같은 artifact URL로 게시한다 |
| 3 | 낮을 전제로 쓴 탐색 이벤트에 밤 문장 분기 | |
| 3 | `play-cli` 보급 계산을 앱의 `computeReward`와 맞추기 | |
| 3 | 스토리의 반복 모티프 줄이기 ("한 번도 흐트러지지 않는다" 등) | 편집 보고에서 남긴 약점 |

웹 데모를 다시 만드는 법:

```bash
npx expo export --platform web --output-dir dist
node scripts/build-web-demo.mjs web-demo    # web-demo/index.html + web-demo/js/*.js
```

`web-demo/index.html`을 페이지로, `web-demo/files.json`의 매핑을 추가 파일로 해서 같은 artifact URL에 게시한다. 게시 서비스는 `_`로 시작하는 경로를 거부하므로 스크립트는 `js/` 아래에 둔다.

## 7. 브라우저 흐름 테스트 (e2e)

클라우드에서는 미리 설치된 Chromium을 썼다. 로컬에서는 Playwright 브라우저를 한 번 설치한다.

```bash
npx playwright install chromium          # 처음 한 번
npx expo export --platform web --output-dir dist
npm run e2e:serve                        # 터미널 1: dist를 http://localhost:4173 으로 서빙
npm run e2e                              # 터미널 2: 전체 흐름. 캡처는 e2e/shots/ (git 제외)
node e2e/shots.mjs http://localhost:4173 e2e/shots gpx    # 흐름 하나만: survivor, run, outsider, rural, gpx
```

- 이미 설치된 Chrome을 쓰려면 `CHROMIUM_PATH=/경로/chrome`을 붙인다.
- 러닝 흐름은 위치를 1초마다 옮기며 고리를 도는 시뮬레이션이라 약 5분 걸린다.
- 결과 끝에 `오류 N건`이 나오고, `e2e/shots/errors.txt`에 콘솔·페이지 오류가 모인다.

## 8. 출시 전에 오너가 직접 해야 할 일

| 할 일 | 이유 |
| --- | --- |
| 위치기반서비스사업 신고 대상인지 확인 (KISA 위치정보지원센터 상담) | 좌표를 서버로 보내지 않아도 신고 대상일 수 있다. 미신고 운영 시 형사처벌 조항이 있다 |
| 약관 초안(`src/content/legal.ts`)에 운영자 정보를 채우고 법률 검토 | 개인정보처리방침, 위치기반서비스 이용약관 |
| Google Play 개발자 계정($25), Apple Developer($99), expo.dev 계정 | 빌드와 출시 |
| Play Console에 위치 유형 포그라운드 서비스 신고 | Android 러닝 기록. "항상 허용" 백그라운드 위치는 쓰지 않으므로 그 심사는 필요 없다 |
| AdMob 계정, 결제 상품 등록 (`remove_ads`, `supporter_pack`) | 광고·결제를 실제 SDK로 교체 (방법은 docs/03) |
| 게임 제목 확정과 상표 검색 | "경계선"은 가제 |
| 브랜치를 main에 합칠지 결정 | 모든 작업이 `claude/tender-faraday-7l5mh7`에 있다. PR은 만들지 않았다 |

## 9. 다음 세션이 알아야 할 함정

- **Expo SDK 58 / React Native 0.88 / TypeScript 6.** `AGENTS.md`에 따라 Expo API는 기억으로 쓰지 말고 `https://docs.expo.dev/versions/v58.0.0/` 문서로 확인한다. 패키지는 `npx expo install`로 추가한다.
- **TypeScript 6은 테스트 타입을 자동으로 넣지 않는다.** 테스트 파일 맨 위에 `/// <reference types="jest" />`가 필요하다.
- **스토리를 고친 뒤에는** `npm run story:test`로 막힘·엔딩 도달·미완성 문구를 확인한다. 노트 이름과 VAR 이름은 docs/05의 계약을 지킨다. `story.json`은 직접 고치지 않는다.
- **스토리 버전과 저장.** 컴파일할 때마다 `src/story/version.json`(내용 해시)이 바뀐다. 버전이 다른 저장은 변수만 옮겨 허브로 이어 간다. 이를 위해 `countAllVisits`를 켜 두었으니 끄지 않는다.
- **허브 선택지는 허브에 도착한 순간 계산된다.** 앱 쪽에서 ink 변수를 바꾼 뒤에는 `refreshHubIfIdle()`로 허브를 다시 그린다 (러닝 결과 반영이 그 예).
- **한 장면 8문단 제한.** 자동 플레이 봇은 `# CLEAR`로만 화면을 세지만, 앱은 `# TITLE`에서도 화면을 나눈다. 장 시작 전에 `# CLEAR`를 둔다.
- **웹 빌드는 스크립트 하나로 묶는다** (`app.json`의 `asyncRoutes.web: false`). 하위 경로 호스팅을 위해서다.
- **"항상 허용" 위치 권한을 다시 넣지 않는다.** Android는 포그라운드 서비스, iOS는 위치 표시줄로 충분하다 (expo-location 소스로 확인함). 넣으면 Play 백그라운드 위치 심사 대상이 된다.
- **구역 데이터**는 KOSTAT 2013 경계에 이후 변경을 반영한 것이다. 인천 2026 개편 구역(제물포구·영종구·검단구)은 경계를 근사했다.
- **자동 플레이 봇 수치는 사람의 난이도가 아니다.** 무작위로 고르므로 사람보다 훨씬 자주 죽는다. 사람 기준은 페르소나 플레이테스트를 함께 본다.

## 10. 작업 이력 요약

| 단계 | 커밋 범위 (대표) |
| --- | --- |
| 아이데이션·문서 | `690a7ff` ~ `c4d8a04` |
| 앱 골격, 전국 구역, 러닝 | `13076a5` ~ `fce6026` |
| 1차 코드 리뷰 수정 (51건) | `f61705e` |
| 스토리 완성·밸런싱·편집 | `6fb4fb5` |
| 플레이테스트 반영 (공정한 되감기, 공유 카드, 허브 안내, 원정 보고 우선) | `cbc4007`, `f9403d7` |
| GPX 가져오기, 강화 안내 | `f6f735b`, `398adeb` |
| 로컬 세션 인수인계 (e2e 이전, 캡처, 이 문서) | 이 문서가 포함된 커밋 |
