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

// Track ALL network errors
const netErrs = [];
page.on('response', async r => {
  if (r.status() >= 400) {
    try {
      const body = await r.text().catch(() => '');
      netErrs.push(`${r.status()} ${r.url().replace('http://localhost:5173', '')} — ${body.slice(0,120)}`);
    } catch {}
  }
});

// Enter demo
await page.goto('http://localhost:5173/demo', { waitUntil: 'networkidle', timeout: 15000 });
await page.fill('input[placeholder="Access code"]', 'cepa-live-demo');
await page.click('button:has-text("Open demo")');
await page.waitForTimeout(2000);

// Navigate to home dashboard
await page.goto('http://localhost:5173/demo/home', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\09_dashboard_after_fix.png` });
console.log('Screenshot 9: dashboard after database fix');

// Scroll down to see more
await page.goto('http://localhost:5173/demo/company', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: `${OUT}\\10_company_workspace.png` });

// Try to expand the Owner Onboarding panel to see the invite form (used for adding clients)
try {
  const onboardBtn = page.locator('button:has-text("Owner Onboarding")').first();
  await onboardBtn.click({ timeout: 3000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}\\11_owner_onboarding_expanded.png` });
  console.log('Screenshot 11: owner onboarding expanded');
} catch (e) {
  console.log('Owner onboarding button not found:', e.message);
}

console.log('\n=== Network errors (all 4xx/5xx): ===');
netErrs.forEach(e => console.log(' ', e));

await browser.close();
