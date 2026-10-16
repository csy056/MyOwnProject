# 05. 스토리 작성 가이드 (ink)

스토리는 [ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) 문법으로 `story/` 폴더에 쓴다. 코드를 몰라도 이 문서의 규칙만 지키면 된다. 세계관과 인물은 [04. 스토리 바이블](04-story-bible.md)을 따른다.

## 확인 명령

```bash
npm run story          # 컴파일 → src/story/story.json
npm run story:test     # 자동 플레이 1500회: 막힘, 엔딩 도달, 미완성 문구 검사
```

## 파일과 담당 노트

| 파일 | 노트(knot) | 형식 |
| --- | --- | --- |
| `main.ink` | 변수, 공용 함수, 허브, 분배기 | 수정 금지 (엔진 담당) |
| `prologue.ink` | `prologue_survivor`, `prologue_outsider` | 터널 |
| `act1.ink` | `act1_ch1` ~ `act1_ch3` | 터널 |
| `act2.ink` | `act2_ch4` ~ `act2_ch6` | 터널 |
| `act3.ink` | `act3_ch7`, `act3_ch8` | 터널. `act3_ch8`은 반드시 엔딩으로 분기하고 돌아오지 않는다 |
| `endings.ink` | `ending_escape`, `ending_stay`, `ending_truth_erase`, `ending_truth_redraw`, `ending_truth_self`, `ending_death`, `ending_erased` | `-> END`로 끝 |
| `base.ink` | `base_visit` | 터널 |
| `run_debrief.ink` | `run_debrief` | 터널 |
| `events_common.ink` | `ev_common_01`~`12`, `ev_quiet`, `ev_night_01`~`04`, `ev_night_quiet` | 터널 |
| `events_metro.ink` | `ev_metro_01`~`08` | 터널 |
| `events_city.ink` | `ev_city_01`~`08` | 터널 |
| `events_county.ink` | `ev_county_01`~`08` | 터널 |
| `events_coastal.ink` | `ev_coastal_01`~`05` | 터널 |
| `events_unique.ink` | `ev_u_<구역키>_1`~`3` (6개 구역) | 터널 |

노트 이름은 위 표와 정확히 같아야 한다. 하위 스티치(`= 이름`)나 보조 노트는 자유롭게 만들어도 되지만, 다른 파일과 겹치지 않게 파일 접두사를 붙인다. (예: `ev_metro_03_escape`)

## 터널 규칙

- **터널**은 `->->`로 끝나는 노트다. 분배기가 `-> ev_metro_03 ->`처럼 부르고, 끝나면 하루가 지나간다.
- 모든 갈래가 결국 `->->`에 도달해야 한다. `-> DONE`, `-> END`, `-> hub`를 쓰지 않는다. (엔딩 파일과 `act3_ch8`만 예외)
- 갈래를 모을 때는 gather(`-`)를 쓴다.

```ink
=== ev_metro_03 ===
# TITLE: 멈춘 에스컬레이터
지하철역 입구. 멈춘 에스컬레이터 위에 누군가 운동화 한 켤레를 가지런히 벗어 두었다.
* [운동화를 챙긴다]
    밑창이 거의 새것이다. 강도윤이 좋아하겠다.
    ~ add_parts(1)
* [아래로 내려간다]
    계단 끝에서 회색빛이 올라온다. 숨을 참고 세 계단만 더 내려간다.
    ~ add_mind(-1)
    ~ add_food(2)
- ->->
```

## 변수와 함수

### 읽기만 하는 변수 (앱이 넣어 준다)

| 변수 | 값 |
| --- | --- |
| `route` | `"survivor"` / `"outsider"` |
| `dome_name` | 갇힌 벽 이름. "서울", "수원시" |
| `area_name` | 거점 구역. "마포구", "양평군" |
| `area_kind` | `"metro"` / `"city"` / `"county"` |
| `coastal` | 해안 구역 여부 |
| `area_key` | 고유 구역 키 또는 `""` |
| `is_night` | 실제 시각이 밤(19~06시)인가 |
| `run_count`, `run_km_total`, `cells_total`, `loops_total` | 누적 러닝 기록 |
| `last_run_km`, `last_run_cells`, `last_run_loop` | 마지막 러닝 기록 |

### 상태 변수는 반드시 함수로 바꾼다

| 함수 | 효과 |
| --- | --- |
| `~ add_hp(x)` | 체력 ±x (0~10) |
| `~ add_mind(x)` | 정신 ±x (0~10) |
| `~ add_food(x)` | 식량 ±x |
| `~ add_parts(x)` | 부품 ±x |
| `~ add_trust(x)` | 거점 신뢰 ±x (-5~10) |
| `~ add_clue()` | 단서 +1. 같은 줄 또는 다음 줄에 `# CLUE: 단서 제목` 태그를 단다 |

`day`, `chapter`, `next_chapter_day`, `up_*`는 직접 바꾸지 않는다. (`base.ink`만 `up_water`, `up_generator`, `up_barricade`를 `true`로 바꿀 수 있다)

### 보상 크기 기준

| 구분 | 체력/정신 | 식량 | 부품 |
| --- | --- | --- | --- |
| 작은 이벤트 | ±1 | +1~2 | +1 |
| 위험한 선택 | -2 | +2~3 | +1~2 |
| 장(chapter) 보상 | ±2 | +2~3 | +2 |

식량은 하루 1씩 줄어든다. 탐색 이벤트의 평균 식량 수지는 +1 정도로 맞춘다. 너무 박하면 모두 굶어 죽고, 너무 후하면 긴장이 없다.

## 지명과 조사

- 지명은 변수로 쓴다: `{area_name}`, `{dome_name}`
- 지명 뒤에 조사가 오면 `josa` 함수를 쓴다. 받침에 맞춰 자동으로 붙는다.

```ink
{josa(area_name, "eun")} 조용하다.      → 마포구는 / 양평군은
{josa(dome_name, "eul")} 둘러싼 벽     → 서울을 / 수원시를
```

| kind | 조사 |
| --- | --- |
| `eun` | 은/는 |
| `i` | 이/가 |
| `eul` | 을/를 |
| `wa` | 와/과 |
| `ro` | 으로/로 |
| `a` | 아/야 |

- `{base_place()}`는 거점 건물 이름이다. (대도시·도시: 주민센터, 농어촌: 마을회관)

## 태그

| 태그 | 의미 |
| --- | --- |
| `# CLEAR` | 새 화면으로 넘어간다. 장면이 크게 바뀔 때 |
| `# TITLE: 제목` | 장면 제목을 표시한다. 이벤트·장의 첫 줄에 단다 |
| `# CLUE: 제목` | 단서를 수첩에 기록한다. `~ add_clue()`와 함께 |
| `# ENDING: id` | 엔딩. `endings.ink`에서만 쓴다 |

## 조건부 문장

```ink
{ is_night: 어둠 속에서 | 햇빛 아래에서 } 벽이 웅웅거린다.
{ route == "outsider": 거점 사람들이 아직 경계하는 눈으로 본다. }
{ run_count > 0: 지난 원정에서 그은 선이 아직 선명하다. | 도윤이 그어 둔 선을 따라 걷는다. }
+ { parts >= 2 } [부품으로 문을 고친다]
```

## 문체 체크리스트

- 짧고 건조한 현재형. 2인칭 금지, 주어 생략. "문을 연다."
- 한 장면 4~8문단. 길어지면 `# CLEAR`로 나눈다.
- 선택지는 2~4개, 12자 안팎의 동사형.
- 수치를 본문에 쓰지 않는다. 앱이 표시한다.
- 실존 기업·브랜드명 금지.
- 러너를 위한 디테일(페이스, 호흡, 오르막, 신발)을 자연스럽게 넣는다.
- 공통 이벤트는 어느 지역에서 읽어도 성립해야 한다.
