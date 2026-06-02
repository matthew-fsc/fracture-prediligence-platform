import { chromium } from 'playwright';
import fs from 'fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'C:\\Users\\mtbaj\\AppData\\Local\\Temp\\screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const netErrs = [];
page.on('response', r => { if (r.status() >= 400) netErrs.push(`${r.status()} ${r.url()}`); });

// ── Enter demo with access code ──────────────────────────────────────────────
console.log('Entering demo...');
await page.goto('http://localhost:5173/demo', { waitUntil: 'networkidle', timeout: 15000 });
// Fill in demo access code
await page.fill('input[placeholder="Access code"]', 'cepa-live-demo');
await page.click('button:has-text("Open demo")');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}\\05_demo_entered.png` });
console.log('Screenshot 5: demo entered');
console.log('Current URL:', page.url());

// ── Navigate to demo home ─────────────────────────────────────────────────────
await page.goto('http://localhost:5173/demo/home', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\06_demo_dashboard.png`, fullPage: false });
console.log('Screenshot 6: demo dashboard');

// ── Navigate demo company workspace to see header/switcher ────────────────────
await page.goto('http://localhost:5173/demo/company', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\07_demo_company_workspace.png`, fullPage: false });
console.log('Screenshot 7: demo company workspace');

// ── Try opening demo readiness page ──────────────────────────────────────────
await page.goto('http://localhost:5173/demo/readiness', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\08_demo_readiness.png`, fullPage: false });
console.log('Screenshot 8: demo readiness');

console.log('\nNetwork errors captured:', netErrs.slice(0, 10));

await browser.close();
console.log('Done.');
