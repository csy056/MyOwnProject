// =====================================================================
// 경계선 (가제) — 메인 스토리
// 이 파일은 변수, 공용 함수, 허브(하루 루프), 이벤트 분배기를 담는다.
// 본문은 각 INCLUDE 파일에 있다. 작성 규칙은 docs/05-story-guide.md 참고.
// =====================================================================

INCLUDE prologue.ink
INCLUDE act1.ink
INCLUDE act2.ink
INCLUDE act3.ink
INCLUDE endings.ink
INCLUDE base.ink
INCLUDE run_debrief.ink
INCLUDE events_common.ink
INCLUDE events_metro.ink
INCLUDE events_city.ink
INCLUDE events_county.ink
INCLUDE events_coastal.ink
INCLUDE events_unique.ink

// ---------------------------------------------------------------------
// 앱이 설정하는 변수 (위치, 실제 시간, 러닝). 스토리에서 값을 바꾸지 않는다.
// ---------------------------------------------------------------------
VAR route = "survivor"      // survivor | outsider
VAR dome_name = "서울"       // 갇힌 벽의 이름
VAR area_name = "마포구"     // 시작 거점이 있는 구역
VAR area_kind = "metro"     // metro | city | county
VAR coastal = false         // 바다에 닿은 구역인가
VAR area_key = ""           // 고유 이벤트 구역 키, 없으면 ""
VAR is_night = false        // 실제 시각이 밤인가 (19시~06시)
VAR run_count = 0           // 누적 러닝 횟수
VAR run_km_total = 0.0      // 누적 러닝 거리(km)
VAR cells_total = 0         // 누적 탈환 블록 수
VAR loops_total = 0         // 누적 포위(닫힌 고리) 횟수
VAR pending_debrief = false // 보고하지 않은 러닝이 있는가
VAR last_run_km = 0.0       // 마지막 러닝 거리(km)
VAR last_run_cells = 0      // 마지막 러닝에서 새로 탈환한 블록 수
VAR last_run_loop = false   // 마지막 러닝에서 고리를 닫았는가
VAR last_run_pace_sec = 0   // 마지막 러닝 평균 페이스(1km당 초). 0이면 기록 없음

// ---------------------------------------------------------------------
// 게임 상태. 스토리가 공용 함수로 바꾼다.
// ---------------------------------------------------------------------
VAR day = 412               // 벽이 생긴 지 며칠째
VAR hp = 7                  // 체력 0~10
VAR mind = 8                // 정신 0~10
VAR food = 4                // 식량 (하루 1 소모)
VAR parts = 2               // 부품 (거점 강화에 사용)
VAR trust = 0               // 거점 신뢰 -5~10
VAR clues = 0               // 모은 단서 수
VAR chapter = 0             // 끝낸 장 수 (0~8)
VAR next_chapter_day = 412  // 다음 장을 열 수 있는 날
VAR up_water = false        // 거점 강화: 정수기
VAR up_generator = false    // 거점 강화: 발전기
VAR up_barricade = false    // 거점 강화: 방벽

// 앱이 한국어 조사를 붙여 준다. kind: eun(은/는) i(이/가) eul(을/를) wa(와/과) ro(으로/로) a(아/야)
EXTERNAL josa(word, kind)

-> start

// ---------------------------------------------------------------------
// 공용 함수
// ---------------------------------------------------------------------
=== function josa(word, kind) ===
// 앱이 연결되지 않았을 때를 위한 대체 구현 (조사 없이 단어만)
~ return word

=== function clamp(v, lo, hi) ===
~ return MAX(lo, MIN(hi, v))

=== function add_hp(x) ===
~ hp = clamp(hp + x, 0, 10)

=== function add_mind(x) ===
~ mind = clamp(mind + x, 0, 10)

=== function add_food(x) ===
~ food = MAX(food + x, 0)

=== function add_parts(x) ===
~ parts = MAX(parts + x, 0)

=== function add_trust(x) ===
~ trust = clamp(trust + x, -5, 10)

=== function add_clue() ===
~ clues = clues + 1

=== function base_place() ===
{ area_kind == "county":
    ~ return "마을회관"
- else:
    ~ return "주민센터"
}

=== function main_ready() ===
{ chapter >= 8:
    ~ return false
}
{ day < next_chapter_day:
    ~ return false
}
// 2막(4장)은 단서 2개 이상, 3막(7장)은 단서 4개 이상이 있어야 열린다.
{ chapter == 3 && clues < 2:
    ~ return false
}
{ chapter == 6 && clues < 4:
    ~ return false
}
~ return true

// ---------------------------------------------------------------------
// 시작
// ---------------------------------------------------------------------
=== start ===
{ route == "outsider":
    -> prologue_outsider ->
- else:
    -> prologue_survivor ->
}
-> hub

// ---------------------------------------------------------------------
// 허브: 하루에 한 가지 행동을 고른다
// ---------------------------------------------------------------------
=== hub ===
# CLEAR
# HUB
{ hp <= 0:
    -> ending_death
}
{ mind <= 0:
    -> ending_erased
}
// 허브 분위기 문장: 장마다 따로 돌린다. {cycle:}이라 직전 문장이 바로 다시 나오지 않는다.
//   3장 뒤: 태민이 돌아와 누워 있다 / 5장 뒤: 말소단의 소금 / 6장 뒤(7장 앞뒤): 회색이 거점 안으로 번진다
{ is_night:
    {
    - chapter >= 6:
        {cycle:
        - 밤이다. 장판의 연필색이 어제보다 한 뼘 들어왔다. 다들 그쪽으로는 발을 뻗지 않고 잔다.
        - 밤이다. 근무표 맨 아래 이름이 또 흐려졌다. 서진이 손전등을 입에 물고 그 이름을 덧쓴다.
        - 밤이다. 언덕 쪽 창이 희다. 달도 없는데 꼭대기만 빛난다.
        - 밤이다. {base_place()} 창문에 덧댄 판자 틈으로 회색빛이 스민다. 판자 하나가 더 늘었다.
        }
    - chapter >= 5:
        {cycle:
        - 밤이다. 문 앞 보도블록에 소금 자국이 아직 하얗다. 손전등이 지나갈 때마다 두 줄이 반짝인다.
        - 밤이다. 창가 매트리스에서 태민의 발이 담요 아래서 박자를 센다.
        - 밤이다. 멀리서 회색인들이 발을 끄는 소리가 들린다.
        - 밤이다. 발전기 소리 사이로 누군가 잠꼬대를 한다.
        }
    - chapter >= 3:
        {cycle:
        - 밤이다. 창가 매트리스에서 태민의 발이 담요 아래서 박자를 센다. 하나, 둘. 하나, 둘.
        - 밤이다. {base_place()} 창문에 덧댄 판자 틈으로 회색빛이 스민다.
        - 밤이다. 멀리서 회색인들이 발을 끄는 소리가 들린다.
        - 밤이다. 발전기 소리 사이로 누군가 잠꼬대를 한다.
        }
    - else:
        {cycle:
        - 밤이다. {base_place()} 창문에 덧댄 판자 틈으로 회색빛이 스민다.
        - 밤이다. 멀리서 회색인들이 발을 끄는 소리가 들린다.
        - 밤이다. 발전기 소리 사이로 누군가 잠꼬대를 한다.
        }
    }
- else:
    {
    - chapter >= 6:
        {cycle:
        - 장판의 연필색이 어제보다 한 뼘 들어왔다. 보라가 그 경계에 테이프를 붙이고 날짜를 적는다.
        - 근무표 맨 아래 이름이 또 흐려졌다. 서진이 마커 뚜껑을 열었다가, 이름 주인을 불러 직접 쓰게 한다.
        - 아침 햇빛이 {base_place()} 바닥에 길게 눕는다. 문 쪽 끝만 색이 옅다. 어제는 문밖까지만 그랬다.
        - 강도윤이 신발 끈을 고쳐 매며 창밖을 본다. 오늘은 선을 세는 눈이 아니다. 남은 길을 세는 눈이다.
        }
    - chapter >= 5:
        {cycle:
        - 문 앞 보도블록에 소금 자국이 아직 하얗다. 도윤이 드나들 때마다 운동화 코로 한 번씩 문지른다.
        - 창가 매트리스에서 태민의 발이 담요 아래서 박자를 센다. 보라가 그 발목에 양말을 신겨 준다.
        - 강도윤이 신발 끈을 고쳐 매며 창밖을 본다. 오늘 그을 선을 세는 눈이다.
        - 윤보라가 약 상자를 정리하며 콧노래를 부른다. 음정이 하나도 맞지 않는다.
        }
    - chapter >= 3:
        {cycle:
        - 창가 매트리스에서 태민의 발이 담요 아래서 박자를 센다. 도윤이 지나가다 그 박자에 맞춰 걸음을 늦춘다.
        - 아침 햇빛이 {base_place()} 바닥에 길게 눕는다. 벽 쪽 하늘만 색이 옅다.
        - 강도윤이 신발 끈을 고쳐 매며 창밖을 본다. 오늘 그을 선을 세는 눈이다.
        - 윤보라가 약 상자를 정리하며 콧노래를 부른다. 음정이 하나도 맞지 않는다.
        }
    - else:
        {cycle:
        - {josa(area_name, "eun")} 오늘도 조용하다. 바람이 부는데 간판 하나 삐걱이지 않는다.
        - 아침 햇빛이 {base_place()} 바닥에 길게 눕는다. 벽 쪽 하늘만 색이 옅다.
        - 강도윤이 신발 끈을 고쳐 매며 창밖을 본다. 오늘 그을 선을 세는 눈이다.
        - 윤보라가 약 상자를 정리하며 콧노래를 부른다. 음정이 하나도 맞지 않는다.
        }
    }
}
// 원정 보고는 맨 위에 둔다. (손에 익은 첫 자리를 눌러 보고를 놓치지 않게)
+ {pending_debrief} [원정 보고를 한다]
    -> debrief
+ {main_ready()} [이야기를 따라간다]
    -> main_story
+ [주변을 탐색한다]
    -> explore
+ [거점을 돌본다]
    -> base
+ [쉰다]
    -> rest

=== main_story ===
# CLEAR
// 보고하지 않은 원정이 있으면 장에 들어가기 전에 먼저 보고한다. (8장은 돌아오지 않는다)
{ pending_debrief:
    -> run_debrief ->
    ~ pending_debrief = false
}
# CLEAR
{ chapter:
- 0: -> act1_ch1 ->
- 1: -> act1_ch2 ->
- 2: -> act1_ch3 ->
- 3: -> act2_ch4 ->
- 4: -> act2_ch5 ->
- 5: -> act2_ch6 ->
- 6: -> act3_ch7 ->
- 7: -> act3_ch8 ->
}
~ chapter = chapter + 1
~ next_chapter_day = day + 2
{ chapter == 7:
    ~ next_chapter_day = day + 1
}
-> day_end

=== debrief ===
# CLEAR
-> run_debrief ->
~ pending_debrief = false
-> hub

=== base ===
# CLEAR
-> base_visit ->
-> day_end

=== rest ===
# CLEAR
{cycle:
- 낡은 매트리스에 몸을 눕힌다. 천장의 얼룩이 오늘따라 지도처럼 보인다.
- 담요를 머리끝까지 덮는다. 발전기 소리가 자장가처럼 낮게 깔린다.
- 아무것도 하지 않기로 한다. 그것도 일이다. 윤보라가 그렇게 말했다.
}
~ add_hp(2)
~ add_mind(1)
-> day_end

// ---------------------------------------------------------------------
// 하루의 끝
// ---------------------------------------------------------------------
=== day_end ===
~ day = day + 1
{ food > 0:
    ~ food = food - 1
- else:
    ~ add_hp(-1)
    먹을 것이 없다. 빈속으로 잠든다.
}
{ up_water:
    ~ add_hp(1)
}
{ up_generator:
    ~ add_mind(1)
}
{ is_night && RANDOM(1, 100) <= 30:
    -> night_event
}
-> hub

=== night_event ===
# CLEAR
{ up_barricade && RANDOM(1, 100) <= 50:
    방벽 너머에서 무언가 긁는 소리가 들리다가 멎는다. 방벽이 제 몫을 했다.
    -> hub
}
{ night_event > 4:
    -> ev_night_quiet ->
- else:
    {shuffle once:
    - -> ev_night_01 ->
    - -> ev_night_02 ->
    - -> ev_night_03 ->
    - -> ev_night_04 ->
    }
}
-> hub

// ---------------------------------------------------------------------
// 탐색 분배기: 고유 구역 → 구역 성격 → 해안 → 공통 순으로 고른다
// ---------------------------------------------------------------------
=== explore ===
# CLEAR
~ temp r = RANDOM(1, 100)
{ area_key != "" && explore_unique < 3 && r <= 35:
    -> explore_unique
}
{ coastal && explore_coastal < 5 && r <= 55:
    -> explore_coastal
}
{ r <= 75:
    -> explore_kind
}
-> explore_common

=== explore_kind ===
{ area_kind:
- "metro": -> explore_metro
- "city": -> explore_city
- else: -> explore_county
}

=== explore_common ===
{ explore_common > 12:
    -> ev_quiet ->
- else:
    {shuffle once:
    - -> ev_common_01 ->
    - -> ev_common_02 ->
    - -> ev_common_03 ->
    - -> ev_common_04 ->
    - -> ev_common_05 ->
    - -> ev_common_06 ->
    - -> ev_common_07 ->
    - -> ev_common_08 ->
    - -> ev_common_09 ->
    - -> ev_common_10 ->
    - -> ev_common_11 ->
    - -> ev_common_12 ->
    }
}
-> day_end

=== explore_metro ===
{ explore_metro > 8:
    -> explore_common
}
{shuffle once:
- -> ev_metro_01 ->
- -> ev_metro_02 ->
- -> ev_metro_03 ->
- -> ev_metro_04 ->
- -> ev_metro_05 ->
- -> ev_metro_06 ->
- -> ev_metro_07 ->
- -> ev_metro_08 ->
}
-> day_end

=== explore_city ===
{ explore_city > 8:
    -> explore_common
}
{shuffle once:
- -> ev_city_01 ->
- -> ev_city_02 ->
- -> ev_city_03 ->
- -> ev_city_04 ->
- -> ev_city_05 ->
- -> ev_city_06 ->
- -> ev_city_07 ->
- -> ev_city_08 ->
}
-> day_end

=== explore_county ===
{ explore_county > 8:
    -> explore_common
}
{shuffle once:
- -> ev_county_01 ->
- -> ev_county_02 ->
- -> ev_county_03 ->
- -> ev_county_04 ->
- -> ev_county_05 ->
- -> ev_county_06 ->
- -> ev_county_07 ->
- -> ev_county_08 ->
}
-> day_end

=== explore_coastal ===
{shuffle once:
- -> ev_coastal_01 ->
- -> ev_coastal_02 ->
- -> ev_coastal_03 ->
- -> ev_coastal_04 ->
- -> ev_coastal_05 ->
}
-> day_end

=== explore_unique ===
{ area_key:
- "seoul_jongno":
    {shuffle once:
    - -> ev_u_seoul_jongno_1 ->
    - -> ev_u_seoul_jongno_2 ->
    - -> ev_u_seoul_jongno_3 ->
    }
- "seoul_mapo":
    {shuffle once:
    - -> ev_u_seoul_mapo_1 ->
    - -> ev_u_seoul_mapo_2 ->
    - -> ev_u_seoul_mapo_3 ->
    }
- "seoul_yeongdeungpo":
    {shuffle once:
    - -> ev_u_seoul_yeongdeungpo_1 ->
    - -> ev_u_seoul_yeongdeungpo_2 ->
    - -> ev_u_seoul_yeongdeungpo_3 ->
    }
- "seoul_songpa":
    {shuffle once:
    - -> ev_u_seoul_songpa_1 ->
    - -> ev_u_seoul_songpa_2 ->
    - -> ev_u_seoul_songpa_3 ->
    }
- "busan_haeundae":
    {shuffle once:
    - -> ev_u_busan_haeundae_1 ->
    - -> ev_u_busan_haeundae_2 ->
    - -> ev_u_busan_haeundae_3 ->
    }
- "daejeon_yuseong":
    {shuffle once:
    - -> ev_u_daejeon_yuseong_1 ->
    - -> ev_u_daejeon_yuseong_2 ->
    - -> ev_u_daejeon_yuseong_3 ->
    }
- else:
    -> explore_common
}
-> day_end
