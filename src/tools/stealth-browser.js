// OpenClaw Cyber — Stealth Browser Tool
// Headless Puppeteer-based browser with anti-detection measures

export const definition = {
  type: 'function',
  function: {
    name: 'stealth_browser',
    description: 'Launch a stealth headless browser session with anti-detection measures. Navigate to URLs, take screenshots, extract data, fill forms, bypass WAFs and bot detection. Uses Puppeteer with fingerprint spoofing, WebGL spoofing, and navigator overrides.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        action: { type: 'string', enum: ['screenshot', 'extract', 'execute_js', 'fill_form', 'full_page'], description: 'Action to perform: screenshot, extract page content, execute JavaScript, fill form, or get full page HTML' },
        javascript: { type: 'string', description: 'JavaScript to execute on the page (for execute_js action)' },
        selector: { type: 'string', description: 'CSS selector to target (for extract or fill_form actions)' },
        value: { type: 'string', description: 'Value to fill (for fill_form action)' },
        wait_ms: { type: 'integer', description: 'Wait time after page load in ms (default: 3000)' },
        proxy: { type: 'string', description: 'Proxy URL (e.g., "socks5://127.0.0.1:9050" for Tor)' },
        user_agent: { type: 'string', description: 'Custom User-Agent string' }
      },
      required: ['url']
    }
  }
};

export async function execute(args) {
  const { url, action = 'extract', javascript, selector, value, wait_ms = 3000, proxy, user_agent } = args;

  let browser, page;
  
  try {
    const puppeteer = await import('puppeteer');
    
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--ignore-certificate-errors',
    ];

    if (proxy) {
      launchArgs.push(`--proxy-server=${proxy}`);
    }

    browser = await puppeteer.default.launch({
      headless: 'new',
      args: launchArgs,
      ignoreHTTPSErrors: true
    });

    page = await browser.newPage();

    // ─── Anti-Detection Measures ───
    await page.evaluateOnNewDocument(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Override chrome detection
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Override platform
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });

      // WebGL fingerprint spoofing
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.apply(this, arguments);
      };
    });

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent
    const ua = user_agent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(ua);

    // Extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    });

    // Navigate
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait additional time
    if (wait_ms > 0) {
      await new Promise(r => setTimeout(r, wait_ms));
    }

    let result = { success: true, url };

    switch (action) {
      case 'screenshot': {
        const { mkdirSync, existsSync } = await import('fs');
        const { join } = await import('path');
        const outDir = './openclaw-output';
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        const filename = `screenshot_${Date.now()}.png`;
        const filepath = join(outDir, filename);
        await page.screenshot({ path: filepath, fullPage: true });
        result.screenshot = filepath;
        result.message = `Screenshot saved to ${filepath}`;
        break;
      }

      case 'extract': {
        if (selector) {
          const elements = await page.$$eval(selector, els => els.map(el => ({
            text: el.textContent?.trim(),
            href: el.href || null,
            src: el.src || null,
            html: el.outerHTML?.slice(0, 200)
          })));
          result.elements = elements.slice(0, 50);
          result.count = elements.length;
        } else {
          const text = await page.evaluate(() => document.body.innerText);
          result.content = text.slice(0, 15000);
          result.title = await page.title();
        }
        break;
      }

      case 'execute_js': {
        if (!javascript) {
          result.success = false;
          result.error = 'No JavaScript provided';
          break;
        }
        const jsResult = await page.evaluate(javascript);
        result.js_result = jsResult;
        break;
      }

      case 'fill_form': {
        if (!selector || !value) {
          result.success = false;
          result.error = 'selector and value required for fill_form';
          break;
        }
        await page.type(selector, value, { delay: 50 });
        result.message = `Typed value into ${selector}`;
        break;
      }

      case 'full_page': {
        const html = await page.content();
        result.html = html.slice(0, 30000);
        result.title = await page.title();
        break;
      }
    }

    // Get cookies
    const cookies = await page.cookies();
    result.cookies = cookies.slice(0, 20).map(c => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly }));

    // Get console messages
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    result.console = consoleMsgs.slice(0, 10);

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
