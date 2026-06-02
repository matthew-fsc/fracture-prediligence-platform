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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Capture console errors
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

// 1. Demo home
console.log('1. demo home...');
await page.goto('http://localhost:5173/demo', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\01_demo_home.png` });

// 2. Sign-in page
console.log('2. sign-in...');
await page.goto('http://localhost:5173/sign-in', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\02_sign_in.png` });

// 3. Settings (redirects to sign-in without auth)
console.log('3. settings...');
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\03_settings.png` });

// 4. Demo company workspace
console.log('4. demo company...');
await page.goto('http://localhost:5173/demo/company', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\04_demo_company.png` });
if (consoleErrors.length) console.log('Console errors:', consoleErrors.slice(0, 5));

await browser.close();
console.log('Done. Files in:', OUT);
