// 全局状态
const state = {
    image: null,
    imageData: null,
    threshold: 60,
    fileName: '',
    detectedSplits: [],
    selectedSplits: new Set(),
    selectedParts: new Set(), // 切割结果中勾选要下载的块（index 集合）
    canvas: null,
    ctx: null,
    gutter: 24,
    hoverY: null, // 鼠标悬停最近的未选中分割线（用于预览）
};

// DOM 元素
const elements = {
    fileInput: document.getElementById('fileInput'),
    recut: document.getElementById('recut'),
    threshold: document.getElementById('threshold'),
    thresholdValue: document.getElementById('thresholdValue'),
    selectedCount: document.getElementById('selectedCount'),
    applySplit: document.getElementById('applySplit'),
    clearSelection: document.getElementById('clearSelection'),
    statusMessage: document.getElementById('statusMessage'),
    splitsPanel: document.getElementById('splitsPanel'),
    splitsSummary: document.getElementById('splitsSummary'),
    splitsWarning: document.getElementById('splitsWarning'),
    splitsList: document.getElementById('splitsList'),
    filePath: document.getElementById('filePath'),
    canvas: document.getElementById('canvas'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    dropHint: document.getElementById('dropHint'),
    partsPanel: document.getElementById('partsPanel'),
    partsSummary: document.getElementById('partsSummary'),
    partsSelectedCount: document.getElementById('partsSelectedCount'),
    downloadSelectedParts: document.getElementById('downloadSelectedParts'),
    partsGrid: document.getElementById('partsGrid'),
};

const DETECTED_COLORS = [
    'rgba(0, 168, 120, 0.9)',
    'rgba(0, 130, 220, 0.9)',
    'rgba(230, 140, 0, 0.9)',
    'rgba(120, 200, 60, 0.9)',
    'rgba(220, 90, 190, 0.9)',
];

const SELECTED_COLORS = [
    'rgba(255, 60, 60, 0.95)',
    'rgba(255, 140, 0, 0.95)',
    'rgba(0, 180, 255, 0.95)',
    'rgba(255, 0, 170, 0.95)',
    'rgba(120, 220, 0, 0.95)',
];

const DASH_LENGTH = 10;
const LEFT_GUTTER = 24;
const MIN_ARROW_PX = 14;
const SNAP_RADIUS = 28; // 点击吸附距离（屏幕像素，不受 canvas 缩放影响）
const HOVER_RADIUS = 34; // 悬停预览距离（屏幕像素），用于提示哪条线会被选中

// 初始化
function init() {
    state.canvas = elements.canvas;
    state.ctx = state.canvas.getContext('2d');

    // 事件监听
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.recut.addEventListener('click', segmentImage);
    elements.threshold.addEventListener('input', updateThresholdValue);
    elements.applySplit.addEventListener('click', applySplitAndSave);
    elements.clearSelection.addEventListener('click', clearSelection);
    elements.downloadSelectedParts.addEventListener('click', handleDownloadSelectedParts);
    elements.canvasWrapper.addEventListener('dragenter', handleDragEnter);
    elements.canvasWrapper.addEventListener('dragover', handleDragOver);
    elements.canvasWrapper.addEventListener('dragleave', handleDragLeave);
    elements.canvasWrapper.addEventListener('drop', handleDrop);
    elements.canvas.addEventListener('click', handleCanvasClick);
    elements.canvas.addEventListener('mousemove', handleCanvasMove);
    elements.canvas.addEventListener('mouseleave', clearCanvasHover);

    setDropHintVisible(true);
    showStatus('勾选分割线后，可下载全部块，或在「切割结果」中挑选部分块单独下载');
}

// 文件选择处理
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadFile(file);
}

function loadFile(file) {
    if (!file.type.startsWith('image/')) {
        showStatus('请选择 PNG/JPG 图片文件');
        return;
    }

    showStatus('正在加载图片...');
    state.fileName = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            state.image = img;
            loadImage(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 加载图片
function loadImage(img) {
    const scaleX = estimateDisplayScaleX(img.width + LEFT_GUTTER);
    const minArrowCanvasPx = MIN_ARROW_PX / Math.max(scaleX, 0.01);
    state.gutter = Math.max(LEFT_GUTTER, Math.ceil(minArrowCanvasPx + 10));

    // 设置 canvas 尺寸（左侧预留箭头区域）
    state.canvas.width = img.width + state.gutter;
    state.canvas.height = img.height;

    // 绘制图片
    state.ctx.drawImage(img, state.gutter, 0);

    // 获取图像数据
    const offscreen = document.createElement('canvas');
    offscreen.width = img.width;
    offscreen.height = img.height;
    const offscreenCtx = offscreen.getContext('2d');
    offscreenCtx.drawImage(img, 0, 0);
    state.imageData = offscreenCtx.getImageData(0, 0, img.width, img.height);

    // 显示文件路径
    elements.filePath.textContent = `文件: ${state.fileName}`;
    elements.filePath.classList.add('show');

    setDropHintVisible(false);

    // 启用按钮
    elements.recut.disabled = false;

    // 自动切割
    segmentImage();

    showStatus(`已加载图片：${state.fileName}`);
}

// 更新阈值显示
function updateThresholdValue(event) {
    state.threshold = parseInt(event.target.value);
    elements.thresholdValue.textContent = state.threshold;
}

// 图像分割检测
function segmentImage() {
    if (!state.image || !state.imageData) return;

    showStatus('正在检测分割线...');

    const width = state.image.width;
    const height = state.image.height;
    const data = state.imageData.data;
    const threshold = state.threshold;

    // 重新绘制原图
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.ctx.drawImage(state.image, state.gutter, 0);

    // 计算每行的前一行数据
    let lastRow = [];
    for (let x = 0; x < width; x++) {
        const idx = x * 4;
        lastRow.push(data[idx], data[idx + 1], data[idx + 2]);
    }

    state.detectedSplits = [];

    // 遍历每一行
    for (let y = 1; y < height; y++) {
        let mad = 0;
        const currentRow = [];

        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            currentRow.push(r, g, b);

            const lastIdx = x * 3;
            const diffR = Math.abs(r - lastRow[lastIdx]);
            const diffG = Math.abs(g - lastRow[lastIdx + 1]);
            const diffB = Math.abs(b - lastRow[lastIdx + 2]);

            mad += diffR + diffG + diffB;
        }

        const avgMad = mad / (width * 3);

        if (avgMad >= threshold) {
            state.detectedSplits.push(y);
            const index = state.detectedSplits.length - 1;
            drawLine(y, 1.5, DETECTED_COLORS);
            drawArrow(y, 1.5, DETECTED_COLORS[index % DETECTED_COLORS.length]);
        }

        lastRow = currentRow;
    }

    // 更新UI
    state.hoverY = null; // 重新检测后旧的悬停预览可能失效
    updateSplitsPanel();
    updatePartsPanel();
    drawSelectedLines();
    showStatus(`检测完成，共找到 ${state.detectedSplits.length} 条分割线`);
}

// 绘制分割线
function drawLine(y, width, colors) {
    const ctx = state.ctx;
    const startX = state.gutter;
    const endX = state.gutter + (state.image ? state.image.width : 0);

    ctx.save();
    ctx.lineWidth = width;

    let x = startX;
    let colorIndex = 0;

    while (x < endX) {
        const segEndX = Math.min(x + DASH_LENGTH, endX);
        ctx.strokeStyle = colors[colorIndex % colors.length];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(segEndX, y);
        ctx.stroke();

        x += DASH_LENGTH;
        colorIndex += 1;
    }

    ctx.restore();
}

function drawArrow(y, width, color) {
    const ctx = state.ctx;
    const scaleX = getCanvasScaleX();
    const arrowPx = MIN_ARROW_PX / Math.max(scaleX, 0.01);
    const tipX = Math.max(6, state.gutter - 6);
    const baseX = Math.max(2, tipX - arrowPx);
    const halfHeight = Math.max(6, arrowPx * 0.4);

    ctx.save();
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(baseX, y - halfHeight);
    ctx.lineTo(baseX, y + halfHeight);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// 更新分割线面板
function updateSplitsPanel() {
    if (state.detectedSplits.length === 0) {
        elements.splitsPanel.style.display = 'none';
        return;
    }

    elements.splitsPanel.style.display = 'block';
    elements.splitsSummary.textContent = `检测到的分割线 (${state.detectedSplits.length} 条)`;

    // 检查相邻分割线距离
    const CLOSE_THRESHOLD = 8;
    let minAdjDist = Infinity;
    for (let i = 1; i < state.detectedSplits.length; i++) {
        const dist = state.detectedSplits[i] - state.detectedSplits[i - 1];
        minAdjDist = Math.min(minAdjDist, dist);
    }

    if (minAdjDist <= CLOSE_THRESHOLD) {
        elements.splitsWarning.style.display = 'block';
        elements.splitsWarning.innerHTML = `
            警告：检测到相邻分割线间距很小（最小 ${minAdjDist} px），建议增大阈值以减少噪声
            <br><button onclick="increaseThresholdAndRecut()">阈值 +5 并重新切割</button>
        `;
    } else {
        elements.splitsWarning.style.display = 'none';
    }

    // 生成复选框列表
    elements.splitsList.innerHTML = '';
    state.detectedSplits.forEach(y => {
        const div = document.createElement('div');
        div.className = 'split-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `split-${y}`;
        checkbox.checked = state.selectedSplits.has(y);
        checkbox.addEventListener('change', (e) => toggleSplit(y, e.target.checked));

        const label = document.createElement('label');
        label.htmlFor = `split-${y}`;
        label.textContent = `${y} px`;

        div.appendChild(checkbox);
        div.appendChild(label);
        elements.splitsList.appendChild(div);
    });

    updateSelectionUI();
}

// 增加阈值并重新切割
function increaseThresholdAndRecut() {
    state.threshold = Math.min(state.threshold + 5, 255);
    elements.threshold.value = state.threshold;
    elements.thresholdValue.textContent = state.threshold;
    showStatus(`阈值调整为 ${state.threshold}，重新切割中...`);
    segmentImage();
}

// 切换分割线选择
function toggleSplit(y, checked) {
    if (checked) {
        state.selectedSplits.add(y);
    } else {
        state.selectedSplits.delete(y);
    }
    updateSelectionUI();
    syncCheckbox(y);
    redrawCanvas();
    updatePartsPanel(); // 切割结果随分割线选择变化
}

// 让面板中的复选框与选中状态保持一致（点图片/点复选框都会触发）
function syncCheckbox(y) {
    const cb = document.getElementById(`split-${y}`);
    if (cb) {
        cb.checked = state.selectedSplits.has(y);
    }
}

// 更新选择UI
function updateSelectionUI() {
    const count = state.selectedSplits.size;
    elements.selectedCount.textContent = `已选择 ${count} 条分割线`;
    elements.applySplit.disabled = count === 0;
    elements.clearSelection.disabled = count === 0;
}

// 清空选择
function clearSelection() {
    state.selectedSplits.clear();
    updateSplitsPanel();
    updatePartsPanel();
    redrawCanvas();
    showStatus('已清空所有选择');
}

// 重绘 canvas
function redrawCanvas() {
    if (!state.image) return;

    // 重绘原图
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.ctx.drawImage(state.image, state.gutter, 0);

    // 绘制检测线（绿色）
    state.detectedSplits.forEach((y, index) => {
        drawLine(y, 1.5, DETECTED_COLORS);
        drawArrow(y, 1.5, DETECTED_COLORS[index % DETECTED_COLORS.length]);
    });

    // 绘制选中线（红色粗线）
    drawSelectedLines();

    // 悬停预览线（最后绘制，置顶，最醒目）
    if (state.hoverY !== null) {
        drawHoverLine(state.hoverY);
    }
}

// 绘制选中的分割线（醒目：光晕 + 粗实线 + 大箭头）
function drawSelectedLines() {
    const selected = Array.from(state.selectedSplits).sort((a, b) => a - b);
    selected.forEach((y, index) => {
        const color = SELECTED_COLORS[index % SELECTED_COLORS.length];
        drawSelectedLine(y, color);
    });
}

function drawSelectedLine(y, color) {
    const ctx = state.ctx;
    const startX = state.gutter;
    const endX = state.gutter + (state.image ? state.image.width : 0);

    ctx.save();

    // 1) 外发光（宽半透明光晕），让线条在复杂背景下也清晰可辨
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    // 2) 核心亮线（纯色实线）
    ctx.globalAlpha = 1;
    // 加一层白色描边衬底提升对比度
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.restore();

    // 3) 选中箭头（更大更醒目）
    drawSelectedArrow(y, color);
}

function drawSelectedArrow(y, color) {
    const ctx = state.ctx;
    const scaleX = getCanvasScaleX();
    const arrowPx = (MIN_ARROW_PX * 1.4) / Math.max(scaleX, 0.01);
    const tipX = Math.max(6, state.gutter - 6);
    const baseX = Math.max(2, tipX - arrowPx);
    const halfHeight = Math.max(7, arrowPx * 0.45);

    ctx.save();
    // 白色描边增强对比
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(baseX, y - halfHeight);
    ctx.lineTo(baseX, y + halfHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function getCanvasScaleX() {
    if (!state.canvas) return 1;
    const clientWidth = state.canvas.clientWidth || 1;
    return clientWidth / state.canvas.width;
}

function estimateDisplayScaleX(canvasWidth) {
    const viewportWidth = window.innerWidth || canvasWidth;
    return Math.min(1, viewportWidth / canvasWidth);
}

// 将 canvas 逻辑坐标转换为屏幕坐标（考虑 CSS 缩放），用于命中检测
function canvasToScreenY(logicalY) {
    if (!state.canvas) return logicalY;
    const rect = state.canvas.getBoundingClientRect();
    if (rect.height === 0) return logicalY;
    return (logicalY / state.canvas.height) * rect.height + rect.top;
}

// 点击吸附：若点击处靠近分割线，则切换最近一条的选中状态
// 命中判定在“屏幕像素”空间进行，避免 canvas 缩放导致目标太小而点不中
function handleCanvasClick(event) {
    if (!state.image || state.detectedSplits.length === 0) return;
    if (!state.canvas) return;

    const rect = state.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 屏幕坐标中的点击位置
    const clientY = event.clientY;
    const screenX = event.clientX;

    // 只在图片区域（排除左侧箭头 gutter）内吸附
    const imgLeftScreen = (state.gutter / state.canvas.width) * rect.width + rect.left;
    const imgRightScreen = ((state.gutter + state.image.width) / state.canvas.width) * rect.width + rect.left;
    if (screenX < imgLeftScreen || screenX > imgRightScreen) return;

    // 找到距离点击处最近的分割线（按屏幕像素比较）
    let nearest = null;
    let nearestDist = Infinity;
    for (const y of state.detectedSplits) {
        const dist = Math.abs(clientY - canvasToScreenY(y));
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = y;
        }
    }

    if (nearest !== null && nearestDist <= SNAP_RADIUS) {
        toggleSplit(nearest, !state.selectedSplits.has(nearest));
        // 点击后清掉悬停预览，避免与选中效果重叠
        state.hoverY = null;
        const status = state.selectedSplits.has(nearest) ? '选中' : '取消选中';
        showStatus(`已${status} ${nearest} px 分割线`);
    }
}

// 悬停预览：鼠标移动时高亮最近的未选中分割线，提示点击会选中的位置
function handleCanvasMove(event) {
    if (!state.image || state.detectedSplits.length === 0) return;
    if (!state.canvas) return;
    const rect = state.canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const clientY = event.clientY;
    const screenX = event.clientX;
    const imgLeftScreen = (state.gutter / state.canvas.width) * rect.width + rect.left;
    const imgRightScreen = ((state.gutter + state.image.width) / state.canvas.width) * rect.width + rect.left;
    if (screenX < imgLeftScreen || screenX > imgRightScreen) {
        clearCanvasHover();
        return;
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const y of state.detectedSplits) {
        const dist = Math.abs(clientY - canvasToScreenY(y));
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = y;
        }
    }

    // 仅对未选中的线做预览，避免覆盖已选中的醒目效果
    const nextHover = (nearest !== null && nearestDist <= HOVER_RADIUS && !state.selectedSplits.has(nearest))
        ? nearest
        : null;

    if (nextHover !== state.hoverY) {
        state.hoverY = nextHover;
        redrawCanvas();
        // 靠近可点时切换指针样式
        state.canvas.style.cursor = nextHover !== null ? 'pointer' : '';
    }
}

function clearCanvasHover() {
    if (state.hoverY !== null) {
        state.hoverY = null;
        if (state.canvas) state.canvas.style.cursor = '';
        redrawCanvas();
    }
}

// 悬停预览线（虚线 + 半透明，明显区别于已选中的实线）
function drawHoverLine(y) {
    const ctx = state.ctx;
    const startX = state.gutter;
    const endX = state.gutter + (state.image ? state.image.width : 0);

    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.95)';
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
    ctx.restore();

    drawArrow(y, 2.5, 'rgba(102, 126, 234, 0.95)');
}

// 根据当前选中的分割线计算切割区间
function computeSegments() {
    const height = state.image.height;
    const splitPoints = Array.from(state.selectedSplits).sort((a, b) => a - b);

    const segments = [];
    let start = 0;

    for (const split of splitPoints) {
        const end = Math.min(split, height);
        if (end > start) {
            segments.push({ start, end });
        }
        start = end;
    }

    // 最后一段
    if (start < height) {
        segments.push({ start, end: height });
    }

    return segments;
}

// 下载指定序号（segments 下标）的若干块
function downloadParts(indexes) {
    if (!state.image || indexes.length === 0) return;

    showStatus(`正在生成分割图像...（${indexes.length} 个文件）`);

    const width = state.image.width;
    const segments = computeSegments();
    const baseName = getOutputBaseName();

    indexes.forEach((idx, order) => {
        const seg = segments[idx];
        if (!seg) return;

        const segHeight = seg.end - seg.start;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = segHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // 绘制片段
        tempCtx.drawImage(
            state.image,
            0, seg.start, width, segHeight,
            0, 0, width, segHeight
        );

        // 下载 - 使用延迟和 IIFE 确保每个下载在独立的事件循环中触发
        (function(segNum) {
            setTimeout(() => {
                tempCanvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${baseName}_part${segNum + 1}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                }, 'image/png');
            }, order * 50);
        })(idx);
    });
}

// 下载单个部分
function downloadPart(index) {
    downloadParts([index]);
    showStatus(`已开始下载第 ${index + 1} 块`);
}

// 应用分割并保存（下载全部块）
function applySplitAndSave() {
    if (!state.image || state.selectedSplits.size === 0) return;

    const segments = computeSegments();
    if (segments.length === 0) return;

    downloadParts(segments.map((_, i) => i));
    showStatus(`分割成功！共生成 ${segments.length} 个文件`);
}

// 更新「切割结果」面板
function updatePartsPanel() {
    if (!state.image || state.selectedSplits.size === 0) {
        elements.partsPanel.style.display = 'none';
        return;
    }

    const segments = computeSegments();
    if (segments.length < 2) {
        // 只有一块（例如分割线落在首尾），无需挑选
        elements.partsPanel.style.display = 'none';
        return;
    }

    elements.partsPanel.style.display = 'block';
    elements.partsSummary.textContent = `共 ${segments.length} 块`;

    // 块集合已变化，重置已选部分，默认全部勾选
    state.selectedParts = new Set(segments.map((_, i) => i));

    elements.partsGrid.innerHTML = '';
    segments.forEach((seg, idx) => {
        elements.partsGrid.appendChild(buildPartCard(seg, idx));
    });

    updatePartsUI();
}

// 构建单个部分卡片
function buildPartCard(seg, idx) {
    const width = state.image.width;
    const segHeight = seg.end - seg.start;

    const card = document.createElement('div');
    card.className = 'part-card selected';
    card.dataset.index = idx;

    // 缩略图（限制尺寸，避免超大图生成过大的预览）
    const previewScale = Math.min(1, 160 / width, 120 / segHeight);
    const tw = Math.max(1, Math.round(width * previewScale));
    const th = Math.max(1, Math.round(segHeight * previewScale));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = tw;
    thumbCanvas.height = th;
    thumbCanvas.getContext('2d').drawImage(
        state.image,
        0, seg.start, width, segHeight,
        0, 0, tw, th
    );

    const img = document.createElement('img');
    img.className = 'part-thumb';
    img.src = thumbCanvas.toDataURL('image/png');
    img.alt = `第 ${idx + 1} 块`;

    // 信息
    const info = document.createElement('div');
    info.className = 'part-info';
    const title = document.createElement('strong');
    title.textContent = `第 ${idx + 1} 块`;
    const size = document.createElement('span');
    size.textContent = `${width} × ${segHeight} px`;
    info.appendChild(title);
    info.appendChild(size);

    // 操作区
    const actions = document.createElement('div');
    actions.className = 'part-actions';

    const label = document.createElement('label');
    label.className = 'part-check-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'part-check';
    checkbox.checked = true;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode('选择'));
    actions.appendChild(label);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'part-download';
    downloadBtn.textContent = '⬇️';
    downloadBtn.title = `下载第 ${idx + 1} 块`;
    actions.appendChild(downloadBtn);

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);

    // 勾选切换
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            state.selectedParts.add(idx);
        } else {
            state.selectedParts.delete(idx);
        }
        card.classList.toggle('selected', checkbox.checked);
        updatePartsUI();
    });

    // 点击卡片主体（非下载按钮、非勾选框）切换选择
    card.addEventListener('click', (event) => {
        if (event.target.closest('.part-download') || event.target.closest('.part-check-label')) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    });

    // 单独下载这一块
    downloadBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        downloadPart(idx);
    });

    return card;
}

// 更新结果面板的选择状态 UI
function updatePartsUI() {
    const count = state.selectedParts.size;
    elements.partsSelectedCount.textContent = `已选 ${count} 块`;
    elements.downloadSelectedParts.disabled = count === 0;
}

// 下载勾选的部分
function handleDownloadSelectedParts() {
    const indexes = Array.from(state.selectedParts).sort((a, b) => a - b);
    if (indexes.length === 0) return;

    downloadParts(indexes);
    showStatus(`已开始下载选中的 ${indexes.length} 块`);
}

function getOutputBaseName() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('test') === '1') {
        return 'result';
    }
    if (!state.fileName) {
        return 'image';
    }
    return state.fileName.replace(/\.[^/.]+$/, '');
}

// 显示状态消息
function showStatus(message) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.add('show');

    // 5秒后自动隐藏
    setTimeout(() => {
        elements.statusMessage.classList.remove('show');
    }, 5000);
}

function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverState(true);
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverState(true);
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!elements.canvasWrapper.contains(event.relatedTarget)) {
        setDragOverState(false);
    }
}

function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDragOverState(false);

    const file = event.dataTransfer.files[0];
    if (file) {
        loadFile(file);
    }
}

function setDragOverState(isOver) {
    if (isOver) {
        elements.canvasWrapper.classList.add('dragover');
        setDropHintVisible(true);
    } else {
        elements.canvasWrapper.classList.remove('dragover');
        if (state.image) {
            setDropHintVisible(false);
        } else {
            setDropHintVisible(true);
        }
    }
}

function setDropHintVisible(visible) {
    if (visible) {
        elements.dropHint.classList.remove('hidden');
    } else {
        elements.dropHint.classList.add('hidden');
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);
