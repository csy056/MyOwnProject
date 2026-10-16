// 웹 빌드를 실제 브라우저로 돌려 주요 화면을 찍고, 콘솔 오류를 모은다.
// 사용법: node shots.mjs <baseUrl> <outDir> [flows=all]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = path.resolve(process.argv[3] ?? './shots');
const flows = (process.argv[4] ?? 'survivor,run,outsider,rural').split(',');
fs.mkdirSync(out, { recursive: true });

const errors = [];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newPage(geo) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    geolocation: { ...geo, accuracy: 10 },
    permissions: ['geolocation'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`);
  });
  return { ctx, page };
}

const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log('shot', name);
}

async function onboard(page, consent = true) {
  await page.goto(base);
  await tid(page, 'onb-next').waitFor({ timeout: 20000 });
  return {
    async go(prefix) {
      if (prefix) await shot(page, `${prefix}-intro`);
      await tid(page, 'onb-next').click();
      await tid(page, 'onb-age-yes').click();
      if (prefix) await shot(page, `${prefix}-consent`);
      await tid(page, consent ? 'onb-consent-yes' : 'onb-consent-no').click();
    },
  };
}

/** 스토리를 몇 걸음 진행한다. 허브에 닿으면 멈춘다. */
async function playSteps(page, n, { stopAtHub = true, prefer = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(150);
    if (await tid(page, 'btn-next').isVisible().catch(() => false)) {
      await tid(page, 'btn-next').click();
      continue;
    }
    if (stopAtHub && (await tid(page, 'hub-run').isVisible().catch(() => false))) return 'hub';
    const choices = page.locator('[data-testid^="choice-"]');
    const count = await choices.count();
    if (count === 0) return 'end';
    await choices.nth(Math.min(prefer, count - 1)).click();
  }
  return 'steps';
}

if (flows.includes('survivor')) {
  const { page } = await newPage({ latitude: 37.5571, longitude: 126.9245 }); // 마포구 홍대입구
  await (await onboard(page)).go('01');
  await page.getByText('벽 안').first().waitFor({ timeout: 15000 });
  await shot(page, '03-start-gps');
  await tid(page, 'start-here').click();
  await page.waitForTimeout(800);
  await shot(page, '04-prologue');
  const r = await playSteps(page, 40);
  await shot(page, `05-after-prologue-${r}`);
  // 허브에서 탐색 몇 번
  for (let k = 0; k < 3; k++) {
    const choices = page.locator('[data-testid^="choice-"]');
    if ((await choices.count()) === 0) break;
    const texts = await choices.allInnerTexts();
    const ex = texts.findIndex((t) => t.includes('탐색'));
    await choices.nth(ex >= 0 ? ex : 0).click();
    await page.waitForTimeout(300);
    if (k === 0) await shot(page, '06-explore');
    await playSteps(page, 12);
  }
  await shot(page, '07-hub');
  await page.goto(`${base}/records`);
  await page.waitForTimeout(500);
  await shot(page, '08-records-clues');
  await page.context().close();
}

if (flows.includes('run')) {
  // 석촌호수 근처에서 작은 고리를 달린다 (반지름 70m, 초속 3.5m)
  const c = { latitude: 37.5097, longitude: 127.1038 };
  const { page, ctx } = await newPage(c);
  await (await onboard(page)).go();
  await page.getByText('벽 안').first().waitFor({ timeout: 15000 });
  await tid(page, 'start-here').click();
  await page.waitForTimeout(500);
  await page.goto(`${base}/run`);
  await tid(page, 'btn-start-run').waitFor({ timeout: 10000 });
  await shot(page, '10-run-ready');
  await tid(page, 'btn-start-run').click();
  const rM = 260, speed = 6;
  const steps = Math.round((2 * Math.PI * rM * 1.08) / speed);
  for (let i = 0; i <= steps; i++) {
    const a = (i * speed) / rM - Math.PI / 2;
    await ctx.setGeolocation({
      latitude: c.latitude + (rM * Math.sin(a)) / 111320,
      longitude: c.longitude + (rM * Math.cos(a)) / (111320 * Math.cos((c.latitude * Math.PI) / 180)),
      accuracy: 8,
    });
    await page.waitForTimeout(1000);
    if (i === Math.round(steps * 0.6)) await shot(page, '11-running');
  }
  await shot(page, '12-running-loop');
  await tid(page, 'btn-stop').click();
  await page.waitForTimeout(800);
  await shot(page, '13-run-result');
  await page.getByText('거점으로 돌아가기').click();
  await page.waitForTimeout(800);
  await playSteps(page, 40);
  const choices = page.locator('[data-testid^="choice-"]');
  const texts = await choices.allInnerTexts();
  const di = texts.findIndex((t) => t.includes('원정 보고'));
  if (di >= 0) {
    await choices.nth(di).click();
    await page.waitForTimeout(500);
    await shot(page, '14-debrief');
  } else {
    errors.push('[flow] 허브에 원정 보고 선택지가 없음: ' + texts.join(' / '));
  }
  await page.goto(`${base}/territory`);
  await page.waitForTimeout(600);
  await shot(page, '15-territory');
  await page.goto(`${base}/records`);
  await tid(page, 'tab-radio').click();
  await page.waitForTimeout(300);
  await shot(page, '16-radio');
  await ctx.close();
}

if (flows.includes('outsider')) {
  const { page, ctx } = await newPage({ latitude: 35.6812, longitude: 139.7671 }); // 도쿄
  await (await onboard(page)).go();
  await page.getByText('벽 바깥').first().waitFor({ timeout: 15000 });
  await shot(page, '20-start-abroad');
  await tid(page, 'start-outsider-default').click();
  await page.waitForTimeout(800);
  await shot(page, '21-outsider-prologue');
  await playSteps(page, 30);
  await shot(page, '22-outsider-hub');
  await ctx.close();
}

if (flows.includes('rural')) {
  const { page, ctx } = await newPage({ latitude: 37.4927, longitude: 127.4917 }); // 양평
  await (await onboard(page)).go();
  await page.getByText('벽 안').first().waitFor({ timeout: 15000 });
  await shot(page, '30-start-rural');
  await tid(page, 'start-here').click();
  await page.waitForTimeout(800);
  await playSteps(page, 30);
  await shot(page, '31-rural-hub');
  await ctx.close();
}

if (flows.includes('gpx')) {
  // 석촌호수 둘레를 한 시간 전에 달린 GPX 파일을 만들어 가져온다.
  const c = { latitude: 37.5097, longitude: 127.1038 };
  const rM = 300, speed = 3.2, every = 3;
  const n = Math.round((2 * Math.PI * rM * 1.03) / (speed * every));
  const start = Date.now() - 3600_000 - n * every * 1000;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * speed * every) / rM;
    const lat = c.latitude + (rM * Math.sin(a)) / 111320;
    const lon = c.longitude + (rM * Math.cos(a)) / (111320 * Math.cos((c.latitude * Math.PI) / 180));
    pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${new Date(start + i * every * 1000).toISOString()}</time></trkpt>`);
  }
  const gpxPath = path.join(out, 'lake.gpx');
  fs.writeFileSync(gpxPath, `<?xml version="1.0"?><gpx version="1.1" creator="Strava"><trk><name>Morning Run</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`);
  const { page, ctx } = await newPage(c);
  await (await onboard(page)).go();
  await page.getByText('벽 안').first().waitFor({ timeout: 15000 });
  await tid(page, 'start-here').click();
  await page.waitForTimeout(500);
  await page.goto(`${base}/run`);
  await tid(page, 'btn-import-gpx').waitFor({ timeout: 10000 });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tid(page, 'btn-import-gpx').click()]);
  await chooser.setFiles(gpxPath);
  await page.getByText('원정 보고').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot(page, '40-gpx-result');
  // 같은 파일을 다시 가져오면 거절된다
  await page.goto(`${base}/run`);
  await tid(page, 'btn-import-gpx').waitFor({ timeout: 10000 });
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), tid(page, 'btn-import-gpx').click()]);
  await chooser2.setFiles(gpxPath);
  await page.getByText('이미 가져온 기록').waitFor({ timeout: 10000 });
  await shot(page, '41-gpx-duplicate');
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(out, 'errors.txt'), errors.join('\n'));
console.log(`\n오류 ${errors.length}건`);
for (const e of errors.slice(0, 40)) console.log(e);
