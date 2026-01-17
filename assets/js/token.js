/**
 * token.js - 来自 token.html 的逻辑
 */

const TEXT = {
    PAGE_TITLE: '填词音节对齐辅助',
    MAIN_TITLE: '填词音节对齐辅助',
    LABEL_ORIGINAL: '原词：',
    LABEL_NEW: '新词：',
    MULTI_DESC: '逐行对齐显示（不匹配行将显示❗并统计），配合SV保留延音符粘贴歌词脚本使用，原词不可有延音符，适配中日英',
    MULTI_PREVIEW_TITLE: '填词对齐音节预览',
    DEFAULT_MULTI_INPUT1: `このままじゃいけない
そうね 知っているわ
wake up wake up babe don't fe ar
君みの碧おい瞳とみの中かに あ わたしはいたい`,
    DEFAULT_MULTI_INPUT2: `祥子长的角真-好看
光-芒 抓起-丢出
顶灯照耀每一个人
u mi ri 甩开了蒙在她脸上的面纱 祥子 转向键盘外`,
    // 可配置的按钮与提示文本
    ADD_BUTTON_TEXT: '添加新词版本',
    DELETE_BUTTON_TEXT: '删除',
    DELETE_BUTTON_TITLE: '删除该新词版本',
};

const STORAGE_KEY = 'token_tool_data_v2';

const App = {
    els: {},

    init() {
        this.cacheEls();
        this.setupText();
        this.loadData();
        this.bindEvents();
        this.renderAlignedPairs();
    },

    cacheEls() {
        this.els = {
            multiMode: document.getElementById('multi-mode'),
            multiInput1: document.getElementById('multi-input1'),
            // 目标为父容器，使变体 .multi-box 与原词成为同级元素（便于等宽分布）
            variantsContainer: document.querySelector('.multi-container'),
            addVariantBtn: document.getElementById('add-variant'),
            multiPreview: document.getElementById('multi-preview'),
            mismatchCount: document.querySelector('.mismatch-count')
        };

        // 用于滚动同步的状态，防止递归触发并记录最近的滚动源
        this._scrollState = {
            isSyncing: false,
            lastSource: null
        };

        // 存放当前变体的引用与元数据：{id, textarea, wrapper, removeBtn}
        this.variants = [];
        this._nextVariantId = 1;

        // 给添加按钮添加样式类，方便统一风格（若存在）
        if (this.els.addVariantBtn) {
            this.els.addVariantBtn.classList.add('add-btn');
            // 使用 TEXT 常量设置按钮文本，方便统一管理语言/文本
            this.els.addVariantBtn.textContent = TEXT.ADD_BUTTON_TEXT;
        }
    },

    setupText() {
        document.title = TEXT.PAGE_TITLE;
        document.getElementById('page-title').textContent = TEXT.PAGE_TITLE;
        document.getElementById('main-title').textContent = TEXT.MAIN_TITLE;
        document.getElementById('multi-desc').textContent = TEXT.MULTI_DESC;
        // 保持对 label-original 的更新（label-new 已从 HTML 移除）
        document.getElementById('label-original').textContent = TEXT.LABEL_ORIGINAL;
    },

    saveData() {
        const data = {
            original: this.els.multiInput1.value,
            // 同时保存 hidden 状态以便重载后保留隐藏/已存在数据
            variants: this.variants.map(v => ({id: v.id, text: v.textarea.value, hidden: !!v.hidden}))
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            // 尝试向后兼容：检查旧的 storage key（old_token.js 使用的 key）并迁移
            const OLD_STORAGE_KEY = 'token_tool_data';
            const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
            if (oldRaw) {
                try {
                    const parsedOld = JSON.parse(oldRaw);
                    // 旧版本可能是 { multi: { input1, input2 } } 或直接 { input1, input2 }
                    let input1 = '';
                    let input2 = '';
                    if (parsedOld && typeof parsedOld === 'object') {
                        if (parsedOld.multi) {
                            input1 = parsedOld.multi.input1 || '';
                            input2 = parsedOld.multi.input2 || '';
                        } else {
                            input1 = parsedOld.input1 || '';
                            input2 = parsedOld.input2 || '';
                        }
                    }

                    // 应用迁移到当前数据模型：把 input1 作为原词，把 input2 作为第一个变体
                    this.els.multiInput1.value = input1 || TEXT.DEFAULT_MULTI_INPUT1;
                    // 创建变体（若 input2 为空则使用默认）
                    this.addVariant((input2 && input2.length > 0) ? input2 : TEXT.DEFAULT_MULTI_INPUT2);

                    // 保存为新版本格式
                    this.saveData();
                    return;
                } catch (e) {
                    // 解析失败，继续回退到默认初始化
                }
            }

            // 初次初始化或未找到旧数据，创建一个默认的变体
            this.els.multiInput1.value = TEXT.DEFAULT_MULTI_INPUT1;
            this.addVariant(TEXT.DEFAULT_MULTI_INPUT2);
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            const original = (parsed && parsed.original) || '';
            const variants = (parsed && parsed.variants) || [];
            this.els.multiInput1.value = original || TEXT.DEFAULT_MULTI_INPUT1;

            if (variants.length === 0) {
                this.addVariant(TEXT.DEFAULT_MULTI_INPUT2);
            } else {
                // 使用 addVariant 创建 DOM，然后根据 saved.hidden 标记隐藏已标记的变体
                for (const v of variants) {
                    const created = this.addVariant(v.text || '');
                    if (v.hidden) {
                        created.hidden = true;
                        created.wrapper.style.display = 'none';
                    }
                }
                // 更新可见变体的标题编号
                this.updateVariantHeaders();
            }
        } catch (e) {
            // 失败回退
            this.els.multiInput1.value = TEXT.DEFAULT_MULTI_INPUT1;
            this.addVariant(TEXT.DEFAULT_MULTI_INPUT2);
        }
    },

    // 创建一个变体文本框块并追加到容器中
    addVariant(initialText = '') {
        // 如果存在被隐藏的变体，优先复用（恢复显示并保留原有数据），以满足“删除不清除数据，重新添加可恢复”的需求
        const hiddenVariant = this.variants.find(v => v.hidden);
        if (hiddenVariant) {
            // 取消隐藏并展示该变体，保留其 textarea 内容（如希望用新的初始文本，可传入 non-empty initialText）
            hiddenVariant.hidden = false;
            hiddenVariant.wrapper.style.display = '';
            if (initialText && hiddenVariant.textarea.value.trim() === '') {
                hiddenVariant.textarea.value = initialText;
            }
            // 重新调整高度与渲染；不重复绑定事件（绑定在初次创建时已完成）
            autoResizeTextarea(hiddenVariant.textarea);
            // 确保滚动同步仍然有效（事件已在首次创建时绑定），但如果没有绑定则添加一次
            if (!hiddenVariant._scrollBound) {
                hiddenVariant.textarea.addEventListener('scroll', () => this._syncFrom(hiddenVariant.textarea));
                hiddenVariant._scrollBound = true;
            }

            // 更新可见变体标题并保存
            this.updateVariantHeaders();
            this.saveData();
            this.renderAlignedPairs();
            return hiddenVariant;
        }

        const id = this._nextVariantId++;

        // 创建一个 .multi-box，使新变体在视觉上与原词框成为兄弟元素（以共享容器的 flex 布局）
        const box = document.createElement('div');
        box.className = 'multi-box';
        box.style.flex = '1';

        const h3 = document.createElement('h3');
        h3.textContent = TEXT.LABEL_NEW + (this.variants.filter(v => !v.hidden).length > 0 ? ` ${this.variants.filter(v => !v.hidden).length + 1}` : '');

        const label = document.createElement('label');
        label.className = 'visually-hidden';

        const textarea = document.createElement('textarea');
        textarea.className = 'variant-textarea';
        if (this.variants.length === 0) {
            textarea.id = 'multi-input2';
            label.htmlFor = 'multi-input2';
        } else {
            const aid = `multi-variant-${id}`;
            textarea.id = aid;
            label.htmlFor = aid;
        }
        textarea.value = initialText;

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.marginTop = '6px';
        controls.style.alignItems = 'center';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = TEXT.DELETE_BUTTON_TEXT;
        removeBtn.title = TEXT.DELETE_BUTTON_TITLE;
        // 为删除按钮添加统一样式类，便于 CSS 统一管理
        removeBtn.className = 'delete-btn';

        controls.appendChild(removeBtn);

        box.appendChild(h3);
        box.appendChild(label);
        box.appendChild(textarea);
        box.appendChild(controls);

        // 将该多词框作为原词盒子的兄弟节点追加，所有 .multi-box 会平分容器宽度
        this.els.variantsContainer.appendChild(box);

        const variant = {id, textarea, wrapper: box, removeBtn, hidden: false};
        this.variants.push(variant);

        // 绑定事件：输入触发重新渲染与保存，滚动用于同步
        const update = () => {
            autoResizeTextarea(textarea);
            this.renderAlignedPairs();
            this.saveData();
        };
        textarea.addEventListener('input', update);
        textarea.addEventListener('scroll', () => this._syncFrom(textarea));
        // 标记已绑定滚动事件，便于后续复用时避免重复绑定
        variant._scrollBound = true;

        // 删除操作改为软删除：通过统一函数处理（含确认弹窗），隐藏但不清除数据
        removeBtn.addEventListener('click', () => this._removeVariantById(id));

        // 确保 textarea 根据内容自适应高度
        requestAnimationFrame(() => autoResizeTextarea(textarea));

        // 更新标题编号
        this.updateVariantHeaders();

        return variant;
    },

    _removeVariantById(id) {
        // 保持旧接口兼容：将原来的彻底删除替换为软删除（隐藏并标记），并提示确认
        const idx = this.variants.findIndex(v => v.id === id);
        if (idx === -1) return;
        const v = this.variants[idx];
        v.hidden = true;
        v.wrapper.style.display = 'none';
        this.saveData();
        this.updateVariantHeaders();
        this.renderAlignedPairs();
    },

    // 更新可见变体的标题编号（第一个可见变体显示为“新词”，后续显示“新词 2/3...”）
    updateVariantHeaders() {
        const visible = this.variants.filter(v => !v.hidden);
        for (let i = 0; i < visible.length; i++) {
            const h3 = visible[i].wrapper.querySelector('h3');
            if (!h3) continue;
            h3.textContent = TEXT.LABEL_NEW + (i > 0 ? ` ${i + 1}` : '');
        }
    },

    tokenize(line) {
        const tokens = [];
        let currentWord = '';
        let isInEnglish = false;

        const smallKana = /[ぁぃぅぇぉゃゅょゎっァィゥェォヵヶャュョヮッ]/;
        const isCJKChar = (c) => /[\u4E00-\u9FFF]/.test(c) || /[\u3040-\u309F]/.test(c) || /[\u30A0-\u30FF]/.test(c);

        for (let i = 0; i < line.length; i++) {
            const c = line[i];

            if (/[a-zA-Z']/.test(c)) {
                currentWord += c;
                isInEnglish = true;
                continue;
            }

            if (/\s/.test(c)) {
                if (isInEnglish && currentWord) {
                    tokens.push({text: currentWord});
                    currentWord = '';
                    isInEnglish = false;
                }
                continue;
            }

            if (isInEnglish && currentWord) {
                tokens.push({text: currentWord});
                currentWord = '';
                isInEnglish = false;
            }

            if (smallKana.test(c) && tokens.length > 0) {
                tokens[tokens.length - 1].text += c;
                continue;
            }

            // 对 CJK（汉字 / 假名 / 片假名）恒按单字符拆分为独立 token
            if (isCJKChar(c)) {
                tokens.push({text: c});
                continue;
            }

            tokens.push({text: c});
        }

        if (isInEnglish && currentWord) {
            tokens.push({text: currentWord});
        }

        return tokens;
    },

    renderAlignedPairs() {
        const container = this.els.multiPreview;
        const input1Lines = this.els.multiInput1.value.split('\n');
        const variantLines = this.variants.map(v => v.textarea.value.split('\n'));
        const maxLen = Math.max(input1Lines.length, ...variantLines.map(l => l.length));

        let mismatchCount = 0;
        container.innerHTML = '';

        for (let i = 0; i < maxLen; i++) {
            const line1 = (input1Lines[i] || '').trim();
            const tokens1 = this.tokenize(line1);

            // collect tokens for each variant for this line
            const variantTokens = this.variants.map((v, idx) => {
                const l = (variantLines[idx][i] || '').trim();
                return this.tokenize(l);
            });

            // mismatch if any variant token length != original token length
            const anyMismatch = variantTokens.some(toks => toks.length !== tokens1.length);
            if (anyMismatch) mismatchCount++;

            const row = document.createElement('div');
            row.className = 'pair-row';
            if (anyMismatch) row.classList.add('mismatch');

            // First column: original tokens
            const maxTokenLen = Math.max(tokens1.length, ...variantTokens.map(t => t.length));
            for (let j = 0; j < maxTokenLen; j++) {
                const pairCol = document.createElement('div');
                pairCol.className = 'pair';

                const top = document.createElement('span');
                top.className = 'top';
                top.textContent = tokens1[j] ? tokens1[j].text : '';
                pairCol.appendChild(top);

                // For each variant append its corresponding token as a bottom-like span (stacked)
                for (let vi = 0; vi < this.variants.length; vi++) {
                    const bottom = document.createElement('span');
                    bottom.className = 'bottom';
                    bottom.style.display = 'block';
                    bottom.textContent = (variantTokens[vi] && variantTokens[vi][j]) ? variantTokens[vi][j].text : '';
                    pairCol.appendChild(bottom);
                }

                row.appendChild(pairCol);
            }

            container.appendChild(row);
            if (i < maxLen - 1) container.appendChild(document.createElement('br'));
        }

        this.els.mismatchCount.textContent = mismatchCount.toString();

        // 重新渲染后尽量保持滚动位置同步（若之前有滚动来源，则使用其比例）
        this._syncAfterRender();
    },

    bindEvents() {
        const update = () => {
            autoResizeTextarea(this.els.multiInput1);
            for (const v of this.variants) autoResizeTextarea(v.textarea);
            this.renderAlignedPairs();
            this.saveData();
        };

        this.els.multiInput1.addEventListener('input', update);
        this.els.multiInput1.addEventListener('scroll', () => this._syncFrom(this.els.multiInput1));

        this.els.addVariantBtn.addEventListener('click', () => {
            this.addVariant('');
            this.saveData();
            this.renderAlignedPairs();
        });

        // 计算元素的垂直滚动比例（0..1）
        const _computeScrollRatio = (el) => {
            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight;
            const clientHeight = el.clientHeight;
            const scrollable = Math.max(0, scrollHeight - clientHeight);
            return scrollable > 0 ? scrollTop / scrollable : 0;
        };

        // 将比例应用到所有目标元素（排除来源元素本身）
        const _applyRatioToTargets = (ratio, src) => {
            const targets = [this.els.multiInput1, ...this.variants.map(v => v.textarea), this.els.multiPreview];
            for (const t of targets) {
                if (t === src) continue;
                const tgtScrollHeight = t.scrollHeight;
                const tgtClientHeight = t.clientHeight;
                const tgtScrollable = Math.max(0, tgtScrollHeight - tgtClientHeight);
                t.scrollTop = Math.round(ratio * tgtScrollable);
            }
        };

        // 从指定元素触发一次滚动同步（含防止递归触发与记录最后源的保护）
        this._syncFrom = (sourceEl) => {
            if (this._scrollState.isSyncing) return;
            this._scrollState.isSyncing = true;
            this._scrollState.lastSource = sourceEl;

            const ratio = _computeScrollRatio(sourceEl);
            _applyRatioToTargets(ratio, sourceEl);

            // 在下一帧释放锁，允许后续用户滚动继续触发
            requestAnimationFrame(() => { this._scrollState.isSyncing = false; });
        };

        // 为已有的变体绑定滚动监听（以防在 bindEvents 之前已加载变体）
        for (const v of this.variants) {
            v.textarea.addEventListener('scroll', () => this._syncFrom(v.textarea));
        }

        this.els.multiPreview.addEventListener('scroll', () => this._syncFrom(this.els.multiPreview));

        update();
    },

    // 在渲染完成后尽量保持视图位置稳定：如果有最近的滚动源，则以该源的比例同步其它区域
    _syncAfterRender() {
        const last = this._scrollState.lastSource;
        if (!last) return;
        this._scrollState.isSyncing = true;
        const ratio = (function(el) {
            const scrollHeight = el.scrollHeight;
            const clientHeight = el.clientHeight;
            const scrollable = Math.max(0, scrollHeight - clientHeight);
            return scrollable > 0 ? el.scrollTop / scrollable : 0;
        })(last);

        // 复用上面实现，把比例应用到目标元素
        const targets = [this.els.multiInput1, ...this.variants.map(v => v.textarea), this.els.multiPreview];
        for (const t of targets) {
            if (t === last) continue;
            const tgtScrollHeight = t.scrollHeight;
            const tgtClientHeight = t.clientHeight;
            const tgtScrollable = Math.max(0, tgtScrollHeight - tgtClientHeight);
            t.scrollTop = Math.round(ratio * tgtScrollable);
        }

        requestAnimationFrame(() => { this._scrollState.isSyncing = false; });
    }
};

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

window.addEventListener('DOMContentLoaded', () => App.init());
