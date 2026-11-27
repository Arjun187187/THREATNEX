/**
 * Capture high-resolution screenshots of all 11 THREATNEX modules using Chrome DevTools Protocol.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.env.TEMP || 'C:\\tmp', 'threatnex-cdp-profile');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function postLogin() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      username_or_email: 'soc_lead_demo',
      password: 'ThreatNex2026!DemoPass',
    });

    const req = http.request(
      'http://127.0.0.1:8001/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Login failed with HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http
          .get('http://127.0.0.1:9222/json', (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve(JSON.parse(body)));
          })
          .on('error', reject);
      });
      const page = data.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Chrome remote debugging port 9222 not available');
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('[1/4] Authenticating with backend to obtain session cookies...');
  const tokens = await postLogin();
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  console.log('-> Authenticated successfully as soc_lead_demo.');

  console.log('[2/4] Launching headless Chrome with remote debugging on port 9222...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1440,900',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank',
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log('-> Connected to Chrome DevTools WebSocket.');

    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');

    console.log('[3/4] Injecting authentication cookies...');
    await cdp.send('Network.setCookie', {
      name: 'threatnex_access_token',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    });
    await cdp.send('Network.setCookie', {
      name: 'threatnex_refresh_token',
      value: refreshToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    });

    const pagesToCapture = [
      { name: '01_login.png', url: 'http://localhost:5173/login', delay: 1500, unauth: true },
      { name: '02_dashboard.png', url: 'http://localhost:5173/', delay: 2500 },
      { name: '03_ioc_investigation.png', url: 'http://localhost:5173/ioc-search', delay: 2000 },
      { name: '04_threat_intelligence.png', url: 'http://localhost:5173/threat-intel', delay: 2500 },
      { name: '05_ai_analyst.png', url: 'http://localhost:5173/ai-analyst', delay: 2000 },
      { name: '06_watchlists.png', url: 'http://localhost:5173/watchlists', delay: 2000 },
      { name: '07_alerts.png', url: 'http://localhost:5173/alerts', delay: 2000 },
      { name: '08_case_management.png', url: 'http://localhost:5173/investigations', delay: 2000 },
      { name: '09_reports.png', url: 'http://localhost:5173/reports', delay: 2000 },
      { name: '10_audit_logs.png', url: 'http://localhost:5173/audit-logs', delay: 2000 },
      { name: '11_settings.png', url: 'http://localhost:5173/settings', delay: 2000 },
    ];

    console.log('[4/4] Capturing screenshots of all 11 modules...');
    for (const item of pagesToCapture) {
      if (item.unauth) {
        // Clear cookie for login screenshot
        await cdp.send('Network.clearBrowserCookies');
      } else {
        // Re-inject cookies for authenticated routes
        await cdp.send('Network.setCookie', {
          name: 'threatnex_access_token',
          value: accessToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        });
        await cdp.send('Network.setCookie', {
          name: 'threatnex_refresh_token',
          value: refreshToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        });
      }

      await cdp.send('Page.navigate', { url: item.url });
      await new Promise((r) => setTimeout(r, item.delay));

      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
      });

      const outPath = path.join(SCREENSHOTS_DIR, item.name);
      fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
      console.log(`  -> Captured ${item.name} (${fs.statSync(outPath).size} bytes)`);
    }

    cdp.close();
    console.log('\nAll 11 application screenshots successfully saved to docs/screenshots/');
  } finally {
    chromeProc.kill();
  }
}

main().catch((err) => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
