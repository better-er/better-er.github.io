// typing 页面的验证脚本，在仓库根目录执行：node tests/run_tests.mjs
import fs from 'node:fs';
import { TypingTokenizer } from '../assets/js/typing-tokenizer.js';

const TOKENIZER_PATH = 'assets/json/deepseek_v4_tokenizer.json';

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.log('  ✗ ' + name + (detail ? '  ' + detail : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

const tokenizer = new TypingTokenizer(JSON.parse(fs.readFileSync(TOKENIZER_PATH, 'utf8')));

// ============ 一、分词正确性 ============
// 对照值由官方 tokenizers 库对同一份 tokenizer.json 生成，逐 id 比对
const REFERENCE = {
  zh: '今天天气真不错，我想去东京的咖啡店坐一会儿，然后回家写代码。',
  mixed: 'MyGO!!!!! 的歌词写得很棒，尤其是「春日影」那一段。',
  code: 'def fibonacci(n):\n    return n if n < 2 else fibonacci(n-1) + fibonacci(n-2)\n',
  emoji: '价格是 12345 元，涨幅 3.14%，emoji 测试 🎸🎶 以及全角标点：！？。'
};

const EXPECTED_IDS = {
  zh: [5237, 16652, 1584, 12433, 303, 11458, 1063, 39813, 301, 18818, 4400, 4255, 25530, 303, 4272, 13985, 2935, 12837, 320],
  mixed: [6759, 17992, 27656, 3, 223, 301, 56792, 2935, 20737, 15358, 303, 13162, 3064, 114649, 1917, 3073, 993, 14858, 320],
  code: [3465, 55155, 3913, 3395, 361, 1354, 313, 855, 313, 818, 223, 20, 3006, 55155, 3913, 15, 19, 11, 940, 55155, 3913, 15, 20, 682],
  emoji: [5820, 389, 223, 6895, 1883, 223, 1673, 303, 47080, 223, 21, 16, 929, 10295, 18872, 7063, 223, 10251, 7351, 239, 119, 53153, 117, 223, 3515, 984, 2877, 1701, 985, 768, 1175, 1148, 320]
};

section('一、分词正确性');
for (const [key, text] of Object.entries(REFERENCE)) {
  const ids = tokenizer.encode(text);
  const same = ids.length === EXPECTED_IDS[key].length && ids.every((v, i) => v === EXPECTED_IDS[key][i]);
  check(key + ' 与官方 id 序列一致，共 ' + ids.length + ' 个 token', same, same ? '' : JSON.stringify(ids));
}

// spans 必须与 encode 对齐且完整覆盖原文
for (const [key, text] of Object.entries(REFERENCE)) {
  const spans = tokenizer.tokenizeWithSpans(text);
  const ids = tokenizer.encode(text);
  const sameOrder = spans.length === ids.length && spans.every((s, i) => s.id === ids[i]);
  let cursor = 0;
  let covered = true;
  for (const s of spans) {
    if (s.start < cursor || s.end < s.start) covered = false;
    cursor = s.end;
  }
  if (cursor !== text.length) covered = false;
  check(key + ' spans 顺序与 encode 一致且覆盖完整', sameOrder && covered);
}

// 词表不应有重复键，否则字节映射会错乱
{
  const raw = fs.readFileSync(TOKENIZER_PATH, 'utf8');
  const vocabStart = raw.indexOf('"vocab"', raw.indexOf('"model"'));
  const seen = new Set();
  let depth = 1;
  let i = raw.indexOf('{', vocabStart) + 1;
  let inStr = false;
  let esc = false;
  let strStart = -1;
  let dup = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      strStart = i;
    } else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) break;
    } else if (c === ':' && depth === 1) {
      const key = JSON.parse(raw.slice(strStart, i).trim());
      if (seen.has(key)) dup++;
      else seen.add(key);
    }
    i++;
  }
  check('词表 128000 个键无重复', dup === 0, dup ? '重复 ' + dup + ' 个' : '');
}

// ============ 二、内置素材 ============
section('二、内置素材');
{
  const src = fs.readFileSync('assets/js/typing.js', 'utf8');
  const start = src.indexOf('const SAMPLES = {');
  const end = src.indexOf('\n};', start);
  const block = src.slice(start, end + 2).trim();
  const SAMPLES = eval('(' + block.replace('const SAMPLES =', '') + ')');

  for (const cat of ['zh', 'en', 'code']) {
    const list = SAMPLES[cat];
    check(cat + ' 共 10 条', list.length === 10, '实际 ' + list.length);
    check(cat + ' 无重复', new Set(list).size === list.length);
    let allOk = true;
    for (const text of list) {
      const ids = tokenizer.encode(text);
      const spans = tokenizer.tokenizeWithSpans(text);
      const same = spans.length === ids.length && spans.every((s, i) => s.id === ids[i]);
      let cursor = 0;
      let covered = true;
      for (const s of spans) {
        if (s.start !== cursor) covered = false;
        cursor = s.end;
      }
      if (!same || !covered || cursor !== text.length || ids.length === 0) allOk = false;
    }
    check(cat + ' 每条都能正常分词且 spans 连续覆盖', allOk);
  }
}

// ============ 三、页面逻辑 ============
section('三、页面逻辑');

function makeCtx() {
  const noop = () => {};
  return {
    setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop,
    moveTo: noop, lineTo: noop, stroke: noop, fill: noop, closePath: noop,
    arc: noop, fillText: noop, save: noop, restore: noop
  };
}

function makeDom() {
  const nodes = new Map();
  function makeNode(id) {
    const cls = new Set();
    const listeners = new Map();
    return {
      id, textContent: '', value: '', hidden: false, innerHTML: '', dataset: {}, style: {},
      width: 800, height: 160, clientWidth: 800, clientHeight: 160,
      getBoundingClientRect: () => ({ width: 800, height: 160, top: 0, left: 0 }),
      getContext: () => makeCtx(),
      classList: {
        add: (c) => cls.add(c),
        remove: (c) => cls.delete(c),
        toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); },
        contains: (c) => cls.has(c)
      },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      emit: (type) => { for (const fn of listeners.get(type) ?? []) fn({ type }); },
      emitKey: (key, ctrl) => {
        const ev = { key, ctrlKey: !!ctrl, metaKey: false, preventDefault: () => {} };
        for (const fn of listeners.get('keydown') ?? []) fn(ev);
      },
      focus: () => {},
      querySelector: () => null
    };
  }
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeNode(id));
    return nodes.get(id);
  };
  return { get };
}

function makeButtons(prefix, key, values) {
  return values.map((v) => {
    const listeners = new Map();
    return {
      id: prefix + '-' + v,
      dataset: { [key]: v },
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      emit: (type) => { for (const fn of listeners.get(type) ?? []) fn({ type }); }
    };
  });
}

// 模块有缓存，每次复制一份再导入，保证拿到全新状态
let bootSeq = 0;

async function bootApp() {
  const dom = makeDom();
  const catButtons = makeButtons('cat', 'cat', ['zh', 'en', 'code', 'custom']);
  const modeButtons = makeButtons('mode', 'mode', ['target', 'free']);
  const store = new Map();
  // 还原 HTML 里的初始 hidden 属性，DOM 桩不带解析器
  dom.get('custom-panel').hidden = true;
  dom.get('app').hidden = true;
  dom.get('loader').hidden = false;

  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v)
  };
  globalThis.document = {
    getElementById: dom.get,
    querySelectorAll: (sel) => {
      if (sel === '#cat-group .chip') return catButtons;
      if (sel === '#mode-group .chip') return modeButtons;
      return [];
    },
    addEventListener: () => {}
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener: () => {} };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => null },
    json: async () => JSON.parse(fs.readFileSync(TOKENIZER_PATH, 'utf8'))
  });

  const source = fs.readFileSync('assets/js/typing.js', 'utf8')
    .replace("from './typing-tokenizer.js'", "from '../assets/js/typing-tokenizer.js'")
    .replace("from './typing-chart.js'", "from '../assets/js/typing-chart.js'");
  const tmp = 'tests/.boot_' + bootSeq++ + '.mjs';
  fs.writeFileSync(tmp, source);
  try {
    await import('../' + tmp);
  } finally {
    fs.unlinkSync(tmp);
  }
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 50));
    if (dom.get('target-text').innerHTML.length > 0) break;
  }
  await new Promise((r) => setTimeout(r, 300));

  return {
    dom,
    store,
    catButtons,
    modeButtons,
    debug: globalThis.window.__typingDebug,
    targetText: () => [...dom.get('target-text').innerHTML.matchAll(/>([^<]*)</g)]
      .map((m) => m[1].replace('\u21b5\n', '\n')).join(''),
    redCount: () => (dom.get('target-text').innerHTML.match(/bad/g) ?? []).length
  };
}

// 定格后应显示全程平均速度，而不是清零
{
  const app = await bootApp();
  const { dom, debug } = app;
  const full = app.targetText();
  check('初始化后原文已加载', full.length > 0, '长度 ' + full.length);

  const input = dom.get('input');
  for (let k = 1; k <= 10; k++) {
    input.value = full.slice(0, Math.floor((full.length * k) / 10));
    input.emit('input');
    await new Promise((r) => setTimeout(r, 40));
  }
  await new Promise((r) => setTimeout(r, 300));

  const tps = dom.get('stat-tps').textContent;
  const total = Number(dom.get('stat-total').textContent);
  const time = Number(dom.get('stat-time').textContent);
  const tokens = debug.state.targetTokens.length;
  check('打完原文后已完成等于总 token 数', total === tokens, total + ' / ' + tokens);
  check('定格后 token/s 未清零', tps !== '0.00', 'tps = ' + tps);
  check('定格后 token/s 保留两位小数', /^\d+\.\d{2}$/.test(tps), 'tps = ' + tps);
  // 界面用时是一位小数，用区间反推真实平均是否落在其中
  const lo = total / (time + 0.05);
  const hi = total / Math.max(0.001, time - 0.05);
  check('定格值等于全程平均速度', Number(tps) >= lo - 0.01 && Number(tps) <= hi + 0.01,
    '显示 ' + tps + '，区间 [' + lo.toFixed(2) + ', ' + hi.toFixed(2) + ']');

  // 换素材时旧输入必须先清空，否则新原文会被逐字标红
  debug.state.input = full;
  dom.get('input').value = full;
  debug.loadTarget('这一段和刚才完全不同，用来验证标红问题。');
  await new Promise((r) => setTimeout(r, 100));
  check('换素材后无残留标红', app.redCount() === 0, '标红 ' + app.redCount());
  check('换素材后输入框已清空', dom.get('input').value.length === 0);
}

// 自定义原文模式
{
  const app = await bootApp();
  const { dom, debug } = app;
  check('初始素材行为可见', dom.get('cat-row').hidden === false);
  check('初始自定义面板隐藏', dom.get('custom-panel').hidden === true);

  app.catButtons[3].emit('click');
  await new Promise((r) => setTimeout(r, 100));
  check('切到自定义后面板展开', dom.get('custom-panel').hidden === false);

  const custom = '自定义一段话，用来测试照打原文模式下的分词。';
  dom.get('custom-text').value = custom;
  dom.get('btn-apply-custom').emit('click');
  await new Promise((r) => setTimeout(r, 200));
  check('应用后原文变成自定义内容', app.targetText() === custom);
  check('自定义内容写入 localStorage', app.store.get('typing.customText') === custom);

  dom.get('btn-reset').emit('click');
  await new Promise((r) => setTimeout(r, 150));
  check('自定义模式重来仍是同一段', app.targetText() === custom);

  app.modeButtons[1].emit('click');
  await new Promise((r) => setTimeout(r, 100));
  check('自由输入模式隐藏素材行', dom.get('cat-row').hidden === true);
  check('自由输入模式隐藏自定义面板', dom.get('custom-panel').hidden === true);

  app.modeButtons[0].emit('click');
  await new Promise((r) => setTimeout(r, 100));
  check('切回照打原文不报错且恢复素材行', dom.get('cat-row').hidden === false);
  check('切回后自定义内容仍在', debug.state.customText === custom);
}

console.log('\n结果：通过 ' + passed + ' 项，失败 ' + failed + ' 项');
process.exit(failed === 0 ? 0 : 1);
