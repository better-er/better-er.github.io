// 累计 token 折线图，横轴是时间，纵轴是当前 token 数
// 自由输入模式下 token 数会回落，曲线随之向下，斜率就是此刻的速度

const WINDOW_MS = 60000;
const PAD = { left: 42, right: 12, top: 12, bottom: 22 };

export class TokenChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.samples = [];
    this.lastValue = null;
    this.resize();
  }

  reset() {
    this.samples = [];
    this.lastValue = null;
    this.clear();
  }

  // 只在数值变化时入样，避免堆一堆重复点
  push(time, value) {
    if (this.lastValue === value) return;
    this.lastValue = value;
    this.samples.push({ time, value });
    if (this.samples.length > 20000) this.samples.splice(0, 10000);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || this.canvas.clientWidth || 600);
    const h = rect.height || this.canvas.clientHeight || 160;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  clear() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#fbfcfe';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  draw(now, startTime) {
    if (!this.width || !this.height) this.resize();
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    this.clear();

    if (!this.samples.length) {
      ctx.fillStyle = '#b6bec7';
      ctx.font = '13px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('开始打字后这里会画出 token 累计曲线', W / 2, H / 2);
      return;
    }

    // 横轴取最近 60 秒，总时长不足 60 秒就显示全程
    const tEnd = Math.max(now, this.samples[this.samples.length - 1].time);
    const elapsed = tEnd - startTime;
    const span = Math.min(WINDOW_MS, Math.max(1000, elapsed));
    const tStart = tEnd - span;

    // 窗口内的数据点
    const inWindow = this.samples.filter((s) => s.time >= tStart);
    if (!inWindow.length) inWindow.push(this.samples[this.samples.length - 1]);

    let maxV = 0;
    let minV = Infinity;
    for (const s of inWindow) {
      if (s.value > maxV) maxV = s.value;
      if (s.value < minV) minV = s.value;
    }
    if (minV === Infinity) minV = 0;

    // 纵轴取整到好看的刻度，下界留余量，回落时线条不贴轴
    const niceStep = (raw) => {
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
      for (const m of [1, 2, 2.5, 5, 10]) {
        if (raw <= mag * m) return mag * m;
      }
      return mag * 10;
    };
    const rawRange = Math.max(2, maxV - minV);
    const yStep = niceStep(rawRange / 4);
    let yMin = Math.max(0, Math.floor(minV / yStep) * yStep);
    let yMax = Math.ceil((maxV + rawRange * 0.08) / yStep) * yStep;
    if (yMax <= yMin) yMax = yMin + yStep;

    const xOf = (t) => PAD.left + ((t - tStart) / span) * plotW;
    const yOf = (v) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // 网格与刻度
    ctx.strokeStyle = '#eef2f6';
    ctx.fillStyle = '#a7b0b9';
    ctx.lineWidth = 1;
    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = yMin; v <= yMax + 1e-6; v += yStep) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), PAD.left - 6, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // 横轴按秒取整，标签读起来整齐
    const xStepSec = niceStep(span / 1000 / 3.5);
    const firstSec = Math.ceil((tStart - startTime) / 1000 / xStepSec) * xStepSec;
    const lastSec = (tEnd - startTime) / 1000;
    for (let sec = firstSec; sec <= lastSec + 1e-6; sec += xStepSec) {
      const x = Math.round(xOf(startTime + sec * 1000)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + plotH);
      ctx.stroke();
      ctx.fillText(Math.round(sec) + 's', x, PAD.top + plotH + 6);
    }

    // 曲线下方的浅色填充
    ctx.beginPath();
    ctx.moveTo(xOf(inWindow[0].time), yOf(Math.max(yMin, inWindow[0].value)));
    for (const s of inWindow) ctx.lineTo(xOf(s.time), yOf(s.value));
    ctx.lineTo(xOf(inWindow[inWindow.length - 1].time), PAD.top + plotH);
    ctx.lineTo(xOf(inWindow[0].time), PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(74, 127, 212, 0.10)';
    ctx.fill();

    // 主曲线，用阶梯线表现离散的 token 完成时刻
    ctx.beginPath();
    ctx.strokeStyle = '#4a7fd4';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let prev = null;
    for (const s of inWindow) {
      const x = xOf(s.time);
      const y = yOf(s.value);
      if (prev === null) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, yOf(prev.value));
        ctx.lineTo(x, y);
      }
      prev = s;
    }
    ctx.stroke();

    // 末端圆点，标出当前值
    if (prev) {
      ctx.beginPath();
      ctx.arc(xOf(prev.time), yOf(prev.value), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4a7fd4';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 右上角显示当前值
    ctx.fillStyle = '#6b7680';
    ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('当前 ' + (prev ? prev.value : 0) + ' token', W - PAD.right, 2);
  }
}
