// Packaged-app E2E for the `?` shortcut viewer and JSONC-preserving editor.
// Usage: node tools/shortcut-settings-e2e.mjs /path/to/cmux-browser/chrome
import {spawn, spawnSync} from 'node:child_process';
import {closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const binary = process.argv[2];
const nativeKeyHelper = process.argv[3] || '';
if (!binary) throw new Error('packaged browser path is required');
const startupUrl = nativeKeyHelper === '--direct'
  ? 'chrome://cmux-configure/?section=details'
  : 'about:blank';

const root = mkdtempSync(join(tmpdir(), 'cmux-shortcut-settings-'));
const profile = join(root, 'profile');
const config = join(root, 'cmux.json');
const logPath = join(root, 'browser.log');
writeFileSync(config, `{
  // This comment and browser setting must survive shortcut edits.
  "browser": {"newTabPage": "blank"},
  "keybindings": []
}
`);
const log = openSync(logPath, 'w');
const browserArguments = [
  `--user-data-dir=${profile}`,
  '--remote-debugging-port=0',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  startupUrl,
];
if (nativeKeyHelper === '--direct') {
  browserArguments.unshift('--headless=new');
}
const browser = spawn(binary, browserArguments, {
  detached: true,
  env: {...process.env, DISPLAY: process.env.DISPLAY || ':1', CMUX_CONFIG: config},
  stdio: ['ignore', log, log],
});

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(description, callback, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await callback();
      if (last) return last;
    } catch (error) {
      last = error.message;
    }
    await sleep(100);
  }
  throw new Error(`${description} timed out (${String(last)})`);
}

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = () => reject(new Error('CDP socket failed'));
    });
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      const resolve = this.pending.get(message.id);
      if (resolve) {
        this.pending.delete(message.id);
        resolve(message);
      }
    };
  }
  send(method, params = {}) {
    return new Promise(resolve => {
      const id = ++this.id;
      this.pending.set(id, resolve);
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.text || 'evaluation failed');
    }
    return response.result?.result?.value;
  }
  close() { this.socket.close(); }
}

let port;
let passed = 0;
function check(description, condition, detail = '') {
  if (!condition) throw new Error(`${description}${detail ? `: ${detail}` : ''}`);
  ++passed;
  console.log(`PASS ${description}`);
}

try {
  port = await waitFor('DevTools endpoint', () => {
    if (browser.exitCode !== null) throw new Error(`browser exited ${browser.exitCode}`);
    try {
      return Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    } catch {
      return 0;
    }
  }, 30000);

  if (nativeKeyHelper === '--direct') {
    const response = await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(startupUrl)}`,
      {method: 'PUT'});
    if (!response.ok) {
      throw new Error(`opening Keyboard settings failed: HTTP ${response.status}`);
    }
  }

  const initialTarget = await waitFor('initial page', async () =>
    (await json('/json')).find(target => target.type === 'page' &&
      (nativeKeyHelper === '--direct'
        ? target.url.includes('cmux-configure')
        : target.url === 'about:blank')));
  check('initial packaged browser page is available', Boolean(initialTarget));
  if (nativeKeyHelper === '--direct') {
    check('packaged browser started on Keyboard settings',
      initialTarget.url.includes('cmux-configure'));
  } else {
    if (!nativeKeyHelper) throw new Error('native key helper is required');
    const nativeProbe = new Cdp(initialTarget.webSocketDebuggerUrl);
    await nativeProbe.open();
    await nativeProbe.send('Runtime.enable');
    await nativeProbe.evaluate(`(() => {
      window.__cmuxNativeKeys = [];
      addEventListener('keydown', event => window.__cmuxNativeKeys.push({
        key: event.key,
        code: event.code,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }));
      return true;
    })()`);
    let keyResult;
    await waitFor('mapped cmux window', () => {
      keyResult = spawnSync(nativeKeyHelper, [String(browser.pid)], {
        env: {...process.env, DISPLAY: process.env.DISPLAY || ':1'},
        encoding: 'utf8',
      });
      return keyResult.status === 0 && keyResult.stdout.includes(`requested=${browser.pid}`) &&
        keyResult.stdout.includes(`pid=${browser.pid}`);
    }, 60000);
    console.log(`Native key target: ${keyResult.stdout.trim()}`);
    check('native X11 question-mark event was sent to the isolated browser',
      keyResult.status === 0, keyResult.stderr.trim());
    await sleep(300);
    const rendererKeys = await Promise.race([
      nativeProbe.evaluate('window.__cmuxNativeKeys'),
      sleep(2000).then(() => 'probe timed out'),
    ]);
    console.log(`Renderer key events: ${JSON.stringify(rendererKeys)}`);
    nativeProbe.close();
  }

  const settingsTarget = await waitFor('Keyboard settings opened by ?', async () =>
    (await json('/json')).find(target => target.type === 'page' &&
      (target.url.includes('cmux-configure') || target.url.includes('cmux://settings'))));
  check(nativeKeyHelper === '--direct'
    ? 'in-app shortcut viewer opens'
    : '? opens the in-app shortcut viewer', Boolean(settingsTarget));

  const settings = new Cdp(settingsTarget.webSocketDebuggerUrl);
  await settings.open();
  await settings.send('Runtime.enable');
  await waitFor('shortcut viewer rendered', () => settings.evaluate(`
    document.querySelector('#details:not([hidden])') &&
    document.querySelectorAll('#shortcut-rows .shortcut-row').length > 0
  `));
  const summary = await settings.evaluate(`({
    keyboardVisible: Boolean(document.querySelector('#details:not([hidden])')),
    rows: document.querySelectorAll('#shortcut-rows .shortcut-row').length,
    hasQuestionMark: [...document.querySelectorAll('#shortcut-rows .shortcut-row')]
      .some(row => row.textContent.includes('settings.shortcuts')),
    hasAdd: Boolean(document.querySelector('#add-shortcut')),
    hasEdit: Boolean(document.querySelector('.edit-shortcut')),
  })`);
  check('Keyboard panel is visible', summary.keyboardVisible);
  check('current bindings are listed', summary.rows > 20, `${summary.rows} rows`);
  check('current ? binding is listed', summary.hasQuestionMark);
  check('add and edit controls are visible', summary.hasAdd && summary.hasEdit);

  await settings.evaluate(`(() => {
    document.querySelector('#add-shortcut').click();
    document.querySelector('#editor-key').value = 'ctrl+alt+y';
    document.querySelector('#editor-command').value = 'sidebar.toggle';
    document.querySelector('#editor-when').value = '!terminalFocused';
    document.querySelector('#editor-when').dispatchEvent(new Event('input'));
    return true;
  })()`);
  const preview = await settings.evaluate(
    `document.querySelector('#editor-preview').textContent`);
  check('pending preference is shown before saving',
    preview.includes('ctrl+alt+y') && preview.includes('sidebar.toggle') &&
      preview.includes('when !terminalFocused'), preview);
  await settings.evaluate(`(() => {
    document.querySelector('#shortcut-editor').requestSubmit();
    return true;
  })()`);
  await waitFor('new preference saved', () => settings.evaluate(
    `document.querySelector('#status').textContent.includes('saved to cmux.json')`));
  check('new shortcut preference saves through the UI', true);

  await settings.evaluate(`(() => {
    const row = [...document.querySelectorAll('#shortcut-rows .shortcut-row')]
      .find(candidate => candidate.querySelector('.shortcut-source')?.textContent.includes('cmux.json') &&
        candidate.textContent.includes('ctrl+alt+y'));
    if (!row) return false;
    row.querySelector('.edit-shortcut').click();
    document.querySelector('#editor-key').value = 'ctrl+alt+u';
    document.querySelector('#shortcut-editor').requestSubmit();
    return true;
  })()`);
  await waitFor('edited preference saved', () => settings.evaluate(`
    !document.querySelector('#shortcut-editor').hidden ? false :
      [...document.querySelectorAll('#shortcut-rows .shortcut-row')]
        .some(row => row.textContent.includes('ctrl+alt+u') && row.textContent.includes('cmux.json'))
  `));
  check('existing shortcut preference edits through the UI', true);
  settings.close();

  const saved = readFileSync(config, 'utf8');
  check('JSONC comment survives editing', saved.includes('This comment and browser setting'));
  check('unrelated browser preference survives editing', saved.includes('"newTabPage": "blank"'));
  check('old shortcut receives a removal override',
    saved.includes('"key": "ctrl+alt+y", "command": "-sidebar.toggle"'));
  check('edited shortcut is persisted last',
    saved.lastIndexOf('"key": "ctrl+alt+u"') > saved.lastIndexOf('"key": "ctrl+alt+y"'));
  console.log(`Shortcut settings packaged E2E: ${passed} passed`);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  if (port) {
    try {
      const targets = await json('/json');
      console.error(`Page targets: ${targets.filter(target => target.type === 'page')
        .map(target => target.url).join(', ')}`);
    } catch {}
  }
  console.error(`Browser log: ${logPath}`);
  process.exitCode = 1;
} finally {
  if (browser.exitCode === null) {
    try { process.kill(-browser.pid, 'SIGTERM'); } catch {}
    await Promise.race([new Promise(resolve => browser.once('exit', resolve)), sleep(5000)]);
    if (browser.exitCode === null) {
      try { process.kill(-browser.pid, 'SIGKILL'); } catch {}
    }
  }
  closeSync(log);
  if (!process.exitCode) rmSync(root, {recursive: true, force: true});
}
