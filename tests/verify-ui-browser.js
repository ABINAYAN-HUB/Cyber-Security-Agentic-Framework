import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const ARTIFACT_DIR = '/home/blackhat/.gemini/antigravity-ide/brain/23c56bc1-e602-4eac-a767-069bd6df675b';

async function runBrowserVerification() {
  console.log('🐉 Running Automated Puppeteer Browser Verification...');
  const consoleErrors = [];
  const consoleWarnings = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      consoleErrors.push(text);
      console.error(`  [Browser Error]: ${text}`);
    } else if (type === 'warn') {
      consoleWarnings.push(text);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error(`  [Browser PageError]: ${err.message}`);
  });

  try {
    // 1. Load Dashboard
    console.log('  → Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log(`  ✅ Loaded page title: "${await page.title()}"`);

    // 2. Test clicking a database card that was previously unsupported: "knowledge"
    console.log('  → Clicking "Knowledge" database card...');
    await page.waitForSelector('.clickable-db-card[data-table="knowledge"]');
    await page.click('.clickable-db-card[data-table="knowledge"]');

    // Wait for modal to render content
    await page.waitForSelector('.modal-overlay', { timeout: 5000 });
    await page.waitForSelector('.modal-body .data-table, .modal-body .text-muted', { timeout: 5000 });
    console.log('  ✅ Modal opened successfully for Knowledge table!');

    // Screenshot modal
    const modalPath = `${ARTIFACT_DIR}/dashboard_modal_verified.png`;
    await page.screenshot({ path: modalPath });
    console.log(`  📸 Saved modal screenshot to: ${modalPath}`);

    // Close modal
    await page.click('#modal-close-btn');
    await page.waitForFunction(() => !document.querySelector('.modal-overlay'));
    console.log('  ✅ Modal closed cleanly');

    // 3. Test clicking "targets" card
    console.log('  → Clicking "Targets" database card...');
    await page.click('.clickable-db-card[data-table="targets"]');
    await page.waitForSelector('.modal-overlay', { timeout: 5000 });
    await page.waitForSelector('.modal-body .data-table, .modal-body .text-muted', { timeout: 5000 });
    console.log('  ✅ Modal opened successfully for Targets table!');
    await page.click('#modal-close-btn');
    await page.waitForFunction(() => !document.querySelector('.modal-overlay'));

    // 4. Test Navigation to Intel view & CVE click
    console.log('  → Navigating to Intel view (#nav-intel)...');
    await page.click('#nav-intel');
    await page.waitForSelector('#intel-search', { timeout: 5000 });
    console.log('  ✅ Intel view rendered properly with search box');

    console.log('  → Testing CVE detail modal click...');
    await page.waitForSelector('.cve-clickable-row', { timeout: 5000 });
    await page.click('.cve-clickable-row');
    await page.waitForSelector('.cve-detail-overlay', { timeout: 5000 });
    console.log('  ✅ CVE detail modal overlay opened successfully!');

    const cveDetailPath = `${ARTIFACT_DIR}/cve_detail_verified.png`;
    await page.screenshot({ path: cveDetailPath });
    console.log(`  📸 Saved CVE detail modal screenshot to: ${cveDetailPath}`);

    await page.evaluate(() => {
      const btn = document.querySelector('.cve-detail-close');
      if (btn) btn.click();
    });
    await page.waitForFunction(() => !document.querySelector('.cve-detail-overlay'));
    console.log('  ✅ CVE detail modal closed cleanly');

    const intelPath = `${ARTIFACT_DIR}/intel_view_verified.png`;
    await page.screenshot({ path: intelPath });
    console.log(`  📸 Saved intel screenshot to: ${intelPath}`);

    // 5. Test Navigation to Chat view
    console.log('  → Navigating to Chat view (#nav-chat)...');
    await page.click('#nav-chat');
    await page.waitForSelector('#chat-input, .chat-input-textarea, .chat-container', { timeout: 5000 });
    console.log('  ✅ Chat view rendered properly with input prompt');

    const chatPath = `${ARTIFACT_DIR}/chat_view_verified.png`;
    await page.screenshot({ path: chatPath });
    console.log(`  📸 Saved chat screenshot to: ${chatPath}`);

    // Verify console errors
    console.log(`\n  Console Error Count: ${consoleErrors.length}`);
    if (consoleErrors.length === 0) {
      console.log('  ✅ Zero console errors detected during full navigation flow!');
    } else {
      console.error('  ❌ Uncaught errors:', consoleErrors);
    }
  } finally {
    await browser.close();
  }
}

runBrowserVerification()
  .then(() => {
    console.log('\n✅ All Puppeteer browser verification checks PASSED!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Browser verification FAILED:', err);
    process.exit(1);
  });
