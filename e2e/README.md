# 브라우저 흐름 테스트 (Playwright)

웹 빌드를 실제 브라우저로 돌려 주요 흐름을 캡처하고 콘솔 오류를 모은다. 자세한 사용법은 `docs/HANDOVER.md` 7장.

| 파일 | 용도 |
| --- | --- |
| `server.mjs` | `dist`를 SPA 방식으로 서빙 (`npm run e2e:serve`) |
| `shots.mjs` | 흐름 실행: survivor, run, outsider, rural, gpx (`npm run e2e`) |
| `demo-check.mjs` | 웹 데모 페이지를 낯선 하위 경로·위치 권한 없음 조건에서 확인 (`node e2e/demo-check.mjs <web-demo 폴더>`) |
