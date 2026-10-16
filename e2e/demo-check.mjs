import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import { chromium } from 'playwright';
const dir = path.resolve(process.argv[2]);
const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith('/a/b/')) { res.writeHead(404); return res.end('nope'); }
  const rel = url.slice(5) || 'index.html';
  const f = path.join(dir, rel);
  if (rel === 'index.html' || !fs.existsSync(f)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${fs.readFileSync(path.join(dir, 'index.html'), 'utf8')}</body></html>`);
  }
  res.writeHead(200, { 'content-type': 'text/javascript' }); fs.createReadStream(f).pipe(res);
}).listen(4174);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' }); // 위치 권한 없음
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('http://localhost:4174/a/b/index.html');
await page.locator('[data-testid="onb-next"]').waitFor({ timeout: 20000 });
await page.locator('[data-testid="onb-next"]').click();
await page.locator('[data-testid="onb-age-yes"]').click();
await page.locator('[data-testid="onb-consent-yes"]').click();
await page.waitForTimeout(11000);
await page.locator('[data-testid="pick-survivor"]').click();
await page.locator('[data-testid="sido-부산광역시"]').click();
await page.locator('[data-testid="region-해운대구"]').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'e2e/demo-game.png' });
console.log('url now', page.url(), 'errors', errs.length, errs.slice(0, 5));
await b.close(); srv.close();
