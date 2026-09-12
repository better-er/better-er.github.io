// DeepSeek 官方 tokenizer.json 的浏览器端 BPE 实现
// 结果与官方 tokenizers 库逐 token id 一致

// byte-level BPE 的字节到可见字符映射，与 GPT-2 一致
export function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }
  const map = new Map();
  for (let i = 0; i < bs.length; i++) map.set(bs[i], String.fromCodePoint(cs[i]));
  return map;
}

// DeepSeek 的 pre_tokenizer 是四段 Split 串联，前三条正则需要按顺序执行
const PRETOK = [
  /\p{N}{1,3}/gu,
  /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]+/gu,
  /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_|~][A-Za-z]+|[^\r\n\p{L}\p{P}\p{S}]?[\p{L}\p{M}]+| ?[\p{P}\p{S}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu
];

// 按官方顺序逐条正则切分文本
export function preTokenize(text) {
  let parts = [text];
  for (const re of PRETOK) {
    const next = [];
    for (const part of parts) {
      re.lastIndex = 0;
      let last = 0;
      let m;
      while ((m = re.exec(part)) !== null) {
        if (m.index > last) next.push(part.slice(last, m.index));
        next.push(m[0]);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < part.length) next.push(part.slice(last));
    }
    parts = next.filter((s) => s.length > 0);
  }
  return parts;
}

export class TypingTokenizer {
  constructor(json) {
    this.vocab = json.model.vocab;
    this.merges = json.model.merges;
    this.rank = new Map();
    for (let i = 0; i < this.merges.length; i++) {
      const m = this.merges[i];
      this.rank.set(typeof m === 'string' ? m : m.join(' '), i);
    }
    this.b2u = bytesToUnicode();
    this.encoder = new TextEncoder();
  }

  // 对一段 pre_token 做 byte-level 编码再执行 BPE 合并
  encodePiece(piece) {
    const bytes = this.encoder.encode(piece);
    const syms = [];
    for (const b of bytes) syms.push(this.b2u.get(b));
    const next = [];
    for (let i = 0; i < syms.length; i++) next.push(i + 1 < syms.length ? i + 1 : -1);
    let head = 0;
    while (true) {
      let best = Infinity;
      let bi = -1;
      for (let i = head; i !== -1; i = next[i]) {
        const j = next[i];
        if (j === -1) continue;
        const r = this.rank.get(syms[i] + ' ' + syms[j]);
        if (r !== undefined && r < best) {
          best = r;
          bi = i;
        }
      }
      if (bi === -1) break;
      const j = next[bi];
      syms[bi] = syms[bi] + syms[j];
      next[bi] = next[j];
      // 头节点被合并掉时必须移动头指针，否则会从已死节点开始遍历
      if (j === head) head = next[j];
    }
    const ids = [];
    for (let i = head; i !== -1; i = next[i]) {
      const id = this.vocab[syms[i]];
      if (id === undefined) throw new Error('未知 token 片段: ' + syms[i]);
      ids.push(id);
    }
    return ids;
  }

  // 字节数换算成 UTF-8 编码后的 UTF-16 长度
  utf8Length(n) {
    if (n <= 127) return 1;
    if (n <= 2047) return 2;
    if (n <= 65535) return 3;
    return 4;
  }

  // 返回 token id 数组
  encode(text) {
    const ids = [];
    for (const piece of preTokenize(text)) {
      for (const id of this.encodePiece(piece)) ids.push(id);
    }
    return ids;
  }

  // 预分词并给出每个 token 覆盖的字符区间，用于目标文本模式
  // 返回的 token 顺序与 encode 完全一致
  tokenizeWithSpans(text) {
    const tokens = [];
    let pos = 0;
    for (const piece of preTokenize(text)) {
      const start = pos;
      pos += piece.length;
      // 逐字节推进，同时记录每个 token 结束时的字符位置
      const bytes = this.encoder.encode(piece);
      const syms = [];
      // byteEnd 记录每个存活节点在原文中的结束字节偏移，合并时取右侧节点的值
      const byteEnd = [];
      for (let k = 0; k < bytes.length; k++) {
        syms.push(this.b2u.get(bytes[k]));
        byteEnd.push(k + 1);
      }
      // 字符位置到字节偏移的映射，用前缀编码长度生成，避免拆开代理对
      const charByte = [];
      for (let c = 0; c <= piece.length; c++) {
        charByte.push(this.encoder.encode(piece.slice(0, c)).length);
      }
      const next = [];
      for (let i = 0; i < syms.length; i++) next.push(i + 1 < syms.length ? i + 1 : -1);
      let head = 0;
      while (true) {
        let best = Infinity;
        let bi = -1;
        for (let i = head; i !== -1; i = next[i]) {
          const j = next[i];
          if (j === -1) continue;
          const r = this.rank.get(syms[i] + ' ' + syms[j]);
          if (r !== undefined && r < best) {
            best = r;
            bi = i;
          }
        }
        if (bi === -1) break;
        const j = next[bi];
        syms[bi] = syms[bi] + syms[j];
        byteEnd[bi] = byteEnd[j];
        next[bi] = next[j];
        if (j === head) head = next[j];
      }
      let cursor = start;
      let ci = 0;
      for (let i = head; i !== -1; i = next[i]) {
        const id = this.vocab[syms[i]];
        if (id === undefined) throw new Error('未知 token 片段: ' + syms[i]);
        while (charByte[ci] < byteEnd[i]) ci++;
        const end = start + ci;
        tokens.push({ id, start: cursor, end });
        cursor = end;
      }
    }
    return tokens;
  }
}

// 仓库内 assets/json/deepseek_v4_tokenizer.json 的原始字节数，即 6.07 MB。
// GitHub Pages 会按 Accept-Encoding 返回 gzip 版本，content-length 只有约 1.85 MB，
// 而 fetch 拿到的 body 是解压后的字节流，用 content-length 当分母会让进度虚高到三倍。
// 浏览器脚本无法要求不压缩，所以这里写死原始大小，tests/run_tests.mjs 会校验它与文件大小一致。
export const TOKENIZER_BYTES = 6367146;

// 让出一次事件循环，先把进度条和提示渲染出去，再跑会阻塞主线程的解析与词表构建
function yieldOnce() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// 带进度回调地加载 tokenizer.json
export async function loadTokenizer(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('分词器加载失败: HTTP ' + res.status);
  if (!res.body) {
    // 少数环境拿不到流式 body，只能一次性读，中途没有进度可报
    const json = await res.json();
    if (onProgress) onProgress(1);
    await yieldOnce();
    return new TypingTokenizer(json);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress) onProgress(Math.min(received / TOKENIZER_BYTES, 1));
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  if (onProgress) onProgress(1);
  await yieldOnce();
  return new TypingTokenizer(JSON.parse(new TextDecoder().decode(buf)));
}
