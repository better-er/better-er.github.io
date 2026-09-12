import { loadTokenizer, TOKENIZER_BYTES } from './typing-tokenizer.js';
import { TokenChart } from './typing-chart.js';

const TOKENIZER_URL = 'assets/json/deepseek_v4_tokenizer.json';
const WINDOW_MS = 60000;

const CUSTOM_STORE_KEY = 'typing.customText';
const CUSTOM_MAX = 5000;

const SAMPLES = {
  zh: [
    '今天天气真不错，我想去东京的咖啡店坐一会儿，然后回家写代码。',
    '不管迷路多少次，只要还愿意往前走，就一定能找到属于自己的地方。',
    '练习的时候手指很痛，但这是我选的路，所以我会继续弹下去。',
    '大家一起练习到很晚，虽然很累，可是听到合奏的那一刻，觉得什么都值得了。',
    '春天的风从窗边吹进来，把写满歌词的本子翻得哗哗作响。',
    '第一次站上舞台的时候，灯光太亮，我什么都看不见，只听见自己的心跳。',
    '写歌词最难的不是押韵，而是把说不出口的话，写成别人也能唱出来的句子。',
    '把复杂的事情拆成一小步一小步，走起来就没有那么可怕了。',
    '午后的教室里只有风扇在转，阳光把桌面照得发白，安静得能听见笔尖的声音。',
    '如果现在放弃的话，以后回想起来一定会后悔，所以再撑一下也没关系。'
  ],
  en: [
    'The quick brown fox jumps over the lazy dog while the band keeps playing.',
    'Token speed depends on how the text is split before it reaches the model.',
    'Keep your fingers relaxed and let the rhythm carry you through the sentence.',
    'A static site can still run a full tokenizer if you load it lazily.',
    'Every mistake you correct is one less mistake you will make tomorrow.',
    'The rain kept falling through the night, washing the streets clean by morning.',
    'She packed her guitar carefully and walked out into the cold autumn air.',
    'Learning to type faster is mostly about learning to stop looking down.',
    'A good song does not need a perfect voice, only an honest one.',
    'We rehearsed the same eight bars for an hour and finally it felt right.'
  ],
  code: [
    'def fibonacci(n):\n    return n if n < 2 else fibonacci(n-1) + fibonacci(n-2)\n',
    'const total = items.reduce((sum, item) => sum + item.price, 0);',
    'for (let i = 0; i < list.length; i++) {\n  console.log(list[i].name);\n}\n',
    'async function load(url) {\n  const res = await fetch(url);\n  return res.json();\n}\n',
    'def parse(text):\n    parts = text.split()\n    return [p for p in parts if p]\n',
    'import math\n\ndef dist(a, b):\n    return math.hypot(a[0] - b[0], a[1] - b[1])\n',
    'class Counter:\n    def __init__(self):\n        self.n = 0\n\n    def add(self, k=1):\n        self.n += k\n',
    'const seen = new Set();\nfor (const id of ids) {\n  if (!seen.has(id)) seen.add(id);\n}\n',
    'try {\n  const data = await readFile(path);\n} catch (err) {\n  console.error(err);\n}\n',
    'export function sum(nums) {\n  return nums.reduce((a, b) => a + b, 0);\n}\n'
  ]
};

const state = {
  tokenizer: null,
  mode: 'target',
  cat: 'zh',
  target: '',
  targetTokens: [],
  charToToken: [],
  input: '',
  startTime: 0,
  endTime: 0,
  running: false,
  finished: false,
  composing: false,
  completedTokens: 0,
  correctChars: 0,
  totalKeystrokes: 0,
  totalErrors: 0,
  samples: [],
  lastSampleTokens: 0,
  lastSampleChars: 0,
  customText: '',
  lastEncode: 0,
  encodeTimer: 0,
  rafId: 0
};

const el = (id) => document.getElementById(id);

let chart = null;

// 把当前计数写进曲线，只有数值变化时才落点
function recordChart() {
  if (!chart) return;
  if (!state.running && !state.finished) return;
  chart.push(performance.now(), state.completedTokens);
}

function escapeHtml(ch) {
  if (ch === '&') return '&amp;';
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  return ch;
}

function pickSample(cat) {
  const list = SAMPLES[cat] || SAMPLES.zh;
  return list[Math.floor(Math.random() * list.length)];
}

function resetStats() {
  state.input = '';
  state.startTime = 0;
  state.endTime = 0;
  state.running = false;
  state.finished = false;
  state.completedTokens = 0;
  state.correctChars = 0;
  state.totalKeystrokes = 0;
  state.totalErrors = 0;
  state.samples = [];
  state.lastSampleTokens = 0;
  state.lastSampleChars = 0;
  el('input').value = '';
  if (chart) chart.reset();
  renderStats();
}

function loadTarget(text) {
  state.target = text;
  state.targetTokens = state.tokenizer.tokenizeWithSpans(text);
  state.charToToken = new Array(text.length).fill(-1);
  for (let t = 0; t < state.targetTokens.length; t++) {
    const tok = state.targetTokens[t];
    for (let i = tok.start; i < tok.end; i++) state.charToToken[i] = t;
  }
  el('target-token-count').textContent = String(state.targetTokens.length);
  el('target-char-count').textContent = String(text.length);
  // 必须先清空旧输入再渲染，否则新原文会被旧输入逐字标红
  resetStats();
  renderTarget();
}

function renderTarget() {
  const text = state.target;
  const input = state.input;
  const starts = new Set(state.targetTokens.map((t) => t.start));
  let html = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cls = ['ch'];
    if (starts.has(i)) cls.push('tok-start');
    if (i < input.length) cls.push(input[i] === ch ? 'ok' : 'bad');
    if (i === input.length) cls.push('cursor');
    const shown = ch === '\n' ? '↵\n' : escapeHtml(ch);
    html += '<span class="' + cls.join(' ') + '">' + shown + '</span>';
  }
  if (input.length >= text.length) {
    html += '<span class="ch cursor"></span>';
  }
  el('target-text').innerHTML = html;
}

// 取最近 60 秒窗口内的增量之和，除以窗口实际跨度
// 增量允许为负，所以自由输入删字时速度会跟着降下来
function windowRate(kind, currentTime) {
  const start = currentTime - WINDOW_MS;
  let tokens = 0;
  let chars = 0;
  let earliest = currentTime;
  for (const s of state.samples) {
    if (s.time < start) continue;
    tokens += s.tokens;
    chars += s.chars;
    if (s.time < earliest) earliest = s.time;
  }
  const dt = (currentTime - earliest) / 1000;
  if (dt <= 0.001) return 0;
  return (kind === 'tokens' ? tokens : chars) / dt;
}

function renderStats() {
  const now = performance.now();
  const acc = state.totalKeystrokes > 0
    ? (1 - state.totalErrors / state.totalKeystrokes) * 100
    : 100;
  el('stat-acc').textContent = acc.toFixed(1).replace(/\.0$/, '');

  // 打完定格后展示全程平均速度，而不是清零
  if (state.finished) {
    const span = (state.endTime - state.startTime) / 1000;
    const avgTps = span > 0.001 ? state.completedTokens / span : 0;
    const avgCpm = span > 0.001 ? (state.correctChars / span) * 60 : 0;
    el('stat-tps').textContent = avgTps.toFixed(2);
    el('stat-cpm').textContent = String(Math.round(avgCpm));
    el('stat-time').textContent = span.toFixed(1);
    el('stat-total').textContent = String(state.completedTokens);
    return;
  }

  if (!state.running) {
    el('stat-tps').textContent = '0.00';
    el('stat-cpm').textContent = '0';
    el('stat-time').textContent = '0.0';
    el('stat-total').textContent = '0';
    return;
  }

  const tps = windowRate('tokens', now);
  const cps = windowRate('chars', now);
  el('stat-tps').textContent = tps.toFixed(2);
  el('stat-cpm').textContent = String(Math.round(cps * 60));
  el('stat-time').textContent = ((now - state.startTime) / 1000).toFixed(1);
  el('stat-total').textContent = String(state.completedTokens);
}

function drawChart() {
  if (!chart) return;
  if (!state.startTime) {
    chart.clear();
    return;
  }
  chart.draw(performance.now(), state.startTime);
}

function tick() {
  renderStats();
  recordChart();
  drawChart();
  if (state.running) state.rafId = requestAnimationFrame(tick);
}

function startClock() {
  if (state.running || state.finished) return;
  state.running = true;
  state.startTime = performance.now();
  state.samples = [];
  state.lastSampleTokens = 0;
  state.lastSampleChars = 0;
  if (chart) chart.reset();
  cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(tick);
}

function stopClock() {
  state.running = false;
  state.finished = true;
  state.endTime = performance.now();
  cancelAnimationFrame(state.rafId);
  recordChart();
  renderStats();
  drawChart();
}

// 记录一次计数变化，按增量入样，负增量也照实记
function pushSample() {
  if (!state.running) return;
  const dt = state.completedTokens - state.lastSampleTokens;
  const dc = state.correctChars - state.lastSampleChars;
  state.lastSampleTokens = state.completedTokens;
  state.lastSampleChars = state.correctChars;
  if (dt === 0 && dc === 0) return;
  state.samples.push({ time: performance.now(), tokens: dt, chars: dc });
  if (state.samples.length > 4000) state.samples.splice(0, 2000);
}

function updateTarget(nextInput) {
  const text = state.target;
  const upto = Math.min(nextInput.length, text.length);
  let completed = 0;
  for (const tok of state.targetTokens) {
    if (tok.end > upto) break;
    let ok = true;
    for (let i = tok.start; i < tok.end; i++) {
      if (nextInput[i] !== text[i]) {
        ok = false;
        break;
      }
    }
    if (ok) completed++;
  }
  let correct = 0;
  for (let i = 0; i < upto; i++) if (nextInput[i] === text[i]) correct++;

  // 只在前进时更新，保证计数只增不减
  if (completed > state.completedTokens) state.completedTokens = completed;
  if (correct > state.correctChars) state.correctChars = correct;
  state.input = nextInput;
  renderTarget();
  recordChart();
  // 全部打完就停表，成绩定格
  if (state.completedTokens >= state.targetTokens.length && state.running) {
    stopClock();
  }
}

function updateFree(nextInput) {
  state.input = nextInput;
  const now = performance.now();
  clearTimeout(state.encodeTimer);
  const run = () => {
    // 自由输入按当前内容实时重算，token 数可以回落
    const ids = state.tokenizer.encode(nextInput);
    state.completedTokens = ids.length;
    state.correctChars = nextInput.length;
    pushSample();
    recordChart();
    renderStats();
    drawChart();
  };
  if (now - state.lastEncode > 150) {
    state.lastEncode = now;
    run();
  } else {
    state.encodeTimer = setTimeout(() => {
      state.lastEncode = performance.now();
      run();
    }, 120);
  }
}

function onInput() {
  const nextInput = el('input').value;
  const prevInput = state.input;
  if (!state.running && nextInput.length > 0) startClock();
  if (state.composing) return;

  if (state.mode === 'target') {
    if (nextInput.length > prevInput.length) {
      const added = nextInput.length - prevInput.length;
      for (let i = 0; i < added; i++) {
        const idx = prevInput.length + i;
        if (idx < state.target.length && nextInput[idx] !== state.target[idx]) state.totalErrors++;
      }
    }
    state.totalKeystrokes += Math.max(0, nextInput.length - prevInput.length);
    updateTarget(nextInput);
    pushSample();
  } else {
    if (nextInput.length > prevInput.length) state.totalKeystrokes += nextInput.length - prevInput.length;
    updateFree(nextInput);
  }
  renderStats();
}

function bindInput() {
  const input = el('input');
  input.addEventListener('compositionstart', () => {
    state.composing = true;
  });
  input.addEventListener('compositionend', () => {
    state.composing = false;
    onInput();
  });
  input.addEventListener('input', () => {
    if (state.composing) return;
    onInput();
  });
}

function setMode(mode) {
  state.mode = mode;
  for (const b of document.querySelectorAll('#mode-group .chip')) {
    b.classList.toggle('active', b.dataset.mode === mode);
  }
  el('target-panel').hidden = mode !== 'target';
  // 素材选择是照打原文的子类，自由输入模式下隐藏
  el('cat-row').hidden = mode !== 'target';
  if (mode !== 'target') el('custom-panel').hidden = true;
  else el('custom-panel').hidden = state.cat !== 'custom';
  el('input').value = '';
  el('footnote-text').textContent = mode === 'target'
    ? '照打原文模式下，token 边界取自目标文本，计数只增不减'
    : '自由输入模式下 token 数按当前输入实时重算，删字时计数会跟着回落';
  if (mode === 'target') {
    // 走 setCat 统一处理，自定义分类要恢复用户那段原文
    setCat(state.cat);
  } else {
    resetStats();
    el('input').focus();
  }
}

function readCustomStore() {
  try {
    return localStorage.getItem(CUSTOM_STORE_KEY) || '';
  } catch (err) {
    return '';
  }
}

function writeCustomStore(text) {
  try {
    localStorage.setItem(CUSTOM_STORE_KEY, text);
  } catch (err) {
    // 本地存储不可用时静默跳过，不影响使用
  }
}

function setCat(cat) {
  state.cat = cat;
  for (const b of document.querySelectorAll('#cat-group .chip')) {
    b.classList.toggle('active', b.dataset.cat === cat);
  }
  el('custom-panel').hidden = cat !== 'custom';
  if (state.mode !== 'target') return;
  if (cat === 'custom') {
    const saved = readCustomStore();
    if (saved) {
      el('custom-text').value = saved;
      state.customText = saved;
      loadTarget(saved);
    } else {
      // 没存过内容就清空，等用户自己填
      resetStats();
      el('target-text').innerHTML = '';
      el('target-token-count').textContent = '0';
      el('target-char-count').textContent = '0';
      el('custom-text').focus();
    }
    return;
  }
  loadTarget(pickSample(cat));
}

function applyCustom() {
  const text = el('custom-text').value.slice(0, CUSTOM_MAX);
  if (!text.trim()) {
    el('custom-text').focus();
    return;
  }
  state.customText = text;
  writeCustomStore(text);
  loadTarget(text);
  el('input').focus();
}

function bindToolbar() {
  for (const b of document.querySelectorAll('#mode-group .chip')) {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  }
  for (const b of document.querySelectorAll('#cat-group .chip')) {
    b.addEventListener('click', () => setCat(b.dataset.cat));
  }
  el('btn-reset').addEventListener('click', () => {
    if (state.mode !== 'target') {
      resetStats();
    } else if (state.cat === 'custom') {
      // 自定义模式重来就是重打同一段，不换素材
      const text = state.customText || el('custom-text').value || '';
      if (text) loadTarget(text);
      else resetStats();
    } else {
      loadTarget(pickSample(state.cat));
    }
    el('input').focus();
  });
  el('btn-apply-custom').addEventListener('click', applyCustom);
  el('custom-text').addEventListener('keydown', (e) => {
    // Ctrl + Enter 快捷应用
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyCustom();
    }
  });
}

async function init() {
  bindToolbar();
  bindInput();
  const t0 = performance.now();
  let shownPct = -1;
  const tokenizer = await loadTokenizer(TOKENIZER_URL, (p) => {
    const pct = Math.round(p * 100);
    el('loader-fill').style.width = pct + '%';
    if (pct === shownPct) return;
    shownPct = pct;
    el('loader-text').textContent = pct >= 100
      ? '下载完成，正在解析词表…'
      : '正在加载 DeepSeek 分词器 ' + (TOKENIZER_BYTES / (1024 * 1024)).toFixed(2) + ' MB · ' + pct + '%';
  });
  state.tokenizer = tokenizer;
  const cost = ((performance.now() - t0) / 1000).toFixed(1);
  el('loader-text').textContent = '分词器就绪，用时 ' + cost + ' 秒';
  el('loader').hidden = true;
  el('app').hidden = false;
  state.customText = readCustomStore();
  if (state.customText) el('custom-text').value = state.customText;
  chart = new TokenChart(el('chart'));
  window.addEventListener('resize', () => {
    if (!chart) return;
    chart.resize();
    drawChart();
  });
  setMode('target');
  el('input').focus();
  // 调试钩子，便于在浏览器控制台或测试里检查内部状态
  window.__typingDebug = { state, loadTarget, renderTarget, resetStats, pickSample };
}

init().catch((err) => {
  el('loader-text').textContent = '加载失败: ' + err.message;
  el('loader-fill').classList.add('error');
});
