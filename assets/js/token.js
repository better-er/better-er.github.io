/**
 * token.js - 从 token.html 提取的逻辑
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
u mi ri 甩开了蒙在她脸上的面纱 祥子 转向键盘外`
};

const STORAGE_KEY = 'token_tool_data';

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
            multiInput2: document.getElementById('multi-input2'),
            multiPreview: document.getElementById('multi-preview'),
            mismatchCount: document.querySelector('.mismatch-count')
        };
    },

    setupText() {
        document.title = TEXT.PAGE_TITLE;
        document.getElementById('page-title').textContent = TEXT.PAGE_TITLE;
        document.getElementById('main-title').textContent = TEXT.MAIN_TITLE;
        document.getElementById('multi-desc').textContent = TEXT.MULTI_DESC;
        document.getElementById('label-original').textContent = TEXT.LABEL_ORIGINAL;
        document.getElementById('label-new').textContent = TEXT.LABEL_NEW;
    },

    saveData() {
        const multi = {
            input1: this.els.multiInput1.value,
            input2: this.els.multiInput2.value
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({multi}));
    },

    loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            this.els.multiInput1.value = TEXT.DEFAULT_MULTI_INPUT1;
            this.els.multiInput2.value = TEXT.DEFAULT_MULTI_INPUT2;
            return;
        }
        try {
            const {multi} = JSON.parse(raw);
            if (multi) {
                this.els.multiInput1.value = multi.input1 || '';
                this.els.multiInput2.value = multi.input2 || '';
            }
        } catch (e) {
        }
    },

    tokenize(line, splitCJK = true) {
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

            if (isCJKChar(c)) {
                if (splitCJK) {
                    tokens.push({text: c});
                } else {
                    const last = tokens[tokens.length - 1];
                    if (last && isCJKChar(last.text[last.text.length - 1]) && /^[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]+$/.test(last.text)) {
                        last.text += c;
                    } else {
                        tokens.push({text: c});
                    }
                }
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
        const input1 = this.els.multiInput1.value.split('\n');
        const input2 = this.els.multiInput2.value.split('\n');
        const maxLen = Math.max(input1.length, input2.length);

        let mismatchCount = 0;
        container.innerHTML = '';

        for (let i = 0; i < maxLen; i++) {
            const line1 = (input1[i] || '').trim();
            const line2 = (input2[i] || '').trim();

            const tokens1 = this.tokenize(line1);
            const tokens2 = this.tokenize(line2);

            const row = document.createElement('div');
            row.className = 'pair-row';
            if (tokens1.length !== tokens2.length) {
                row.classList.add('mismatch');
                mismatchCount++;
            }

            const maxTokenLen = Math.max(tokens1.length, tokens2.length);
            for (let j = 0; j < maxTokenLen; j++) {
                const t1 = tokens1[j] || {text: ''};
                const t2 = tokens2[j] || {text: ''};

                const pair = document.createElement('div');
                pair.className = 'pair';

                const top = document.createElement('span');
                top.className = 'top';
                top.textContent = t1.text;

                const bottom = document.createElement('span');
                bottom.className = 'bottom';
                bottom.textContent = t2.text;

                pair.appendChild(top);
                pair.appendChild(bottom);
                row.appendChild(pair);
            }

            container.appendChild(row);
            if (i < maxLen - 1) {
                container.appendChild(document.createElement('br'));
            }
        }

        this.els.mismatchCount.textContent = mismatchCount.toString();
    },

    bindEvents() {
        const update = () => {
            autoResizeTextarea(this.els.multiInput1);
            autoResizeTextarea(this.els.multiInput2);
            this.renderAlignedPairs();
            this.saveData();
        };

        this.els.multiInput1.addEventListener('input', update);
        this.els.multiInput2.addEventListener('input', update);

        update();
    }
};

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

window.addEventListener('DOMContentLoaded', () => App.init());
