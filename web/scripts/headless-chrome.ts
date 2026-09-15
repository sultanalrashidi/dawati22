import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Just enough of the Chrome DevTools protocol to open a page and read values
 * out of it, with no Playwright. Used by the text-fit checks, which need a
 * real browser because only layout tells whether a text fits its box.
 *
 * Set CHROME to the browser binary if it is not in the usual place.
 */
export const CHROME = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);

type Reply = { result?: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } };

export async function launchChrome(executable = CHROME) {
  if (!executable) throw new Error('Chrome not found; set CHROME');
  const profile = mkdtempSync(join(tmpdir(), 'text-fit-'));
  const chrome = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise<string>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 20_000);
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.on('exit', code => reject(new Error(`Chrome exited with ${code}`)));
  });
  const target = await (await fetch(`${endpoint.replace(/^ws:\/\/([^/]+).*$/, 'http://$1')}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map<number, { resolve: (value: Reply) => void; reject: (error: Error) => void }>();
  const events: ((message: { method: string }) => void)[] = [];
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    const waiting = pending.get(message.id);
    if (waiting) {
      pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    } else if (message.method) for (const listener of [...events]) listener(message);
  };
  const send = (method: string, params: object = {}) => new Promise<Reply>((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  // Wide enough to lay many stages side by side.
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1200, deviceScaleFactor: 1, mobile: false });
  return {
    async evaluate<T>(expression: string): Promise<T> {
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
      return reply.result?.value as T;
    },
    async open(url: string) {
      const loaded = new Promise<void>(resolve => {
        const listener = (message: { method: string }) => {
          if (message.method === 'Page.loadEventFired') { events.splice(events.indexOf(listener), 1); resolve(); }
        };
        events.push(listener);
      });
      await send('Page.navigate', { url });
      await loaded;
    },
    async close() {
      socket.close();
      const exited = new Promise(resolve => { chrome.once('exit', resolve); setTimeout(resolve, 3000); });
      chrome.kill();
      await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

/** In the page: wait for the fitted texts to settle, after the fonts are in. */
export const SETTLED = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 600 && !document.querySelector('[data-stage] [data-text-overflow]'); i++) await wait(100);
  await document.fonts.ready;
  for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await wait(300);
})()`;
