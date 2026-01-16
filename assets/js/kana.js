/**
 * kana.js - 从 kana.html 提取的逻辑
 */

const TEXT = {
    PAGE_TITLE: '日语歌词排版「一字一音」格式',
    MAIN_TITLE: '日语歌词排版「一字一音」格式',
    DEFAULT_INPUT: `[君]{きみ}が[持]{も}ってきた[漫]{まん}[画]{が}

[くれ]た[知]{し}らない[名]{な}[前]{まえ}のお[花]{はな}

[今日]{きょう}はまだ[来]{こ}ないかな？

[初]{はじ}めての[感]{かん}[情]{じょう}[知]{し}ってしまった

[窓]{まど}に[飾]{かざ}った[絵]{え}[画]{が}をなぞってひとりで[宇]{う}[宙]{ちゅう}を[旅]{たび}して

それだけでいいはずだったのに

[君]{きみ}の[手]{て}を[握]{にぎ}ってしまったら

[孤]{こ}[独]{どく}を[知]{し}らないこの[街]{まち}には

もう[二]{に}[度]{ど}と[帰]{かえ}ってくることはできないのでしょう

[君]{きみ}が[手]{て}を[差]{さ}し[伸]{の}べた　[光]{ひかり}で[影]{かげ}が[生]{う}まれる

[歌]{うた}って[聞]{き}かせて　この[話]{はなし}の[続]{つづ}き

[連]{つ}れて[行]{い}って[見]{み}たことない[星]{ほし}まで

[誰]{だれ}の[手]{て}も[声]{こえ}も[届]{とど}かない

[高]{たか}く[聳]{そび}え[立]{た}った[塔]{とう}の[上]{うえ}へ

[飛]{と}ばす[フウセンカズラ]

[僕]{ぼく}は[君]{きみ}に[笑]{わら}って[欲]{ほ}しいんだ

[満]{み}たされない[穴]{あな}は[惰]{だ}[性]{せい}の[会]{かい}[話]{わ}や[澄]{す}ました[ポーズ]で

これまでは[埋]{う}めてきたけど

[退]{たい}[屈]{くつ}な[日]{ひ}[々]{び}を[蹴散]{けち}らして

[君]{きみ}と[二]{ふた}[人]{り}でこの[街]{まち}[中]{じゅう}を[泳]{およ}げたら

それはどれだけ[素]{す}[職]{てき}なことでしょう？

[出]{だ}したことないほど[大]{おお}きな[声]{こえ}でやっと[君]{きみ}に[伝]{つた}わる

[歪]{いびつ}なくらいがさ　きっとちょうどいいね

[世]{せ}[界]{かい}の[端]{はじ}と[端]{はじ}を[結]{むす}んで

[窓]{まど}に[飾]{かざ}った[絵]{え}[画]{が}をなぞってひとりで[宇]{う}[宙]{ちゅう}を[旅]{たび}して

それだけでも[不]{ふ}[自]{じ}[由]{ゆう}ないけど

[僕]{ぼく}は[選]{えら}んでみたいの

[高]{たか}[鳴]{な}る[心]{こころ}　[謎]{なぞ}だらけの[空]{そら}を

[安]{あん}[全]{ぜん}な[ループ]を[今]{いま}、[書]{か}き[換]{か}えて！

[君]{きみ}の[手]{て}を[握]{にぎ}ってしまったら

[孤]{こ}[独]{どく}を[知]{し}らないこの[街]{まち}には

もう[二]{に}[度]{ど}と[帰]{かえ}ってくることはできないのでしょう

いくらでも[迷]{まよ}いながら[光]{ひかり}も[影]{かげ}も[見]{み}に[行]{い}こう

[歌]{うた}って[聞]{き}かせてこの[話]{はなし}の[続]{つづ}き

[連]{つ}れて[行]{い}って[見]{み}たことない[星]{ほし}まで

[世]{せ}[界]{かい}の[端]{はじ}と[端]{はじ}を[結]{むす}んで`
};

const STORAGE_KEY = 'ruby_tool_data';

const App = {
    els: {},
    AUTO_CONVERT_DEBOUNCE_MS: 600,
    _autoConvertTimer: null,
    _isConverting: false,
    _originalConvertHTML: null,
    // 活动模式：null | 'onechar' | 'kana'
    _activeMode: null,
    // CSS 类名（非必须，保留以便样式使用）
    ACTIVE_CLASS: 'active',
    SMALL_KANA: new Set('ゃゅょっゎァィゥェォャュョッヮ'),

    init() {
        this.cacheEls();
        this._originalConvertHTML = this.els.btnConvert.innerHTML;
        this.setupText();
        this.loadData();
        this.bindEvents();
    },

    cacheEls() {
        this.els = {
            mainTitle: document.getElementById('main-title'),
            inputRuby: document.getElementById('input-ruby'),
            outputResult: document.getElementById('output-result'),
            btnConvert: document.getElementById('btn-convert'),
            btnClear: document.getElementById('btn-clear'),
            btnCopy: document.getElementById('btn-copy'),
            btnKanaOnly: document.getElementById('btn-kana-only'),
            desc: document.getElementById('desc'),
            guidePanel: document.getElementById('guide-panel')
        };
    },

    setupText() {
        document.title = TEXT.PAGE_TITLE;
        document.getElementById('page-title').textContent = TEXT.PAGE_TITLE;
        this.els.mainTitle.textContent = TEXT.MAIN_TITLE;
        if (!this.els.inputRuby.value) this.els.inputRuby.value = TEXT.DEFAULT_INPUT;
    },

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            input: this.els.inputRuby.value
        }));
    },

    loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            if (data.input) this.els.inputRuby.value = data.input;
        } catch (e) { }
    },

    // 切换/选择转换模式。如果再次传入相同模式则取消选择。
    setMode(mode) {
        if (this._activeMode === mode) {
            // 取消选择
            this._activeMode = null;
            this._updateModeUI();
            return;
        }
        this._activeMode = mode;
        this._updateModeUI();
        // 选中后立即执行对应的转换
        if (mode === 'onechar') this.convert();
        else if (mode === 'kana') this.toKanaOnly();
    },

    // 更新按钮显示以反映当前活动模式（互斥）
    _updateModeUI() {
        const b1 = this.els.btnConvert;
        const b2 = this.els.btnKanaOnly;
        if (b1) {
            if (this._activeMode === 'onechar') {
                b1.classList.add(this.ACTIVE_CLASS);
                // 使用内联高亮样式，避免修改 CSS 文件
                b1.style.backgroundColor = '#4caf50';
                b1.style.color = '#fff';
            } else {
                b1.classList.remove(this.ACTIVE_CLASS);
                b1.style.backgroundColor = '';
                b1.style.color = '';
            }
        }
        if (b2) {
            if (this._activeMode === 'kana') {
                b2.classList.add(this.ACTIVE_CLASS);
                b2.style.backgroundColor = '#2196f3';
                b2.style.color = '#fff';
            } else {
                b2.classList.remove(this.ACTIVE_CLASS);
                b2.style.backgroundColor = '';
                b2.style.color = '';
            }
        }
    },

    splitIntoSyllables(kana) {
        if (!kana) return [];
        const syllables = [];
        for (let i = 0; i < kana.length; i++) {
            const c = kana[i];
            if (this.SMALL_KANA.has(c) && syllables.length > 0) {
                syllables[syllables.length - 1] += c;
            } else {
                syllables.push(c);
            }
        }
        return syllables;
    },

    rubyToOneCharPerSyllable(text) {
        if (!text) return '';
        const pattern = /\[([^\]]+)]\{([^}]+)}/g;
        let result = text.replace(pattern, (match, kanji, kana) => {
            const syllables = this.splitIntoSyllables(kana);
            const m = syllables.length;
            const n = kanji.length;
            const resultChars = [];
            for (let i = 0; i < m; i++) {
                if (i < n) resultChars.push(kanji[i]);
                else resultChars.push(syllables[i]);
            }
            return resultChars.join('');
        });
        result = result.replace(/[\[\]{}]/g, '');
        result = result
            .split(/\r?\n/)
            .filter(line => line.trim() !== '')
            .join('\n');
        return result;
    },

    clear() {
        this.els.inputRuby.value = '';
        this.els.outputResult.innerHTML = '<button class="copy-btn" id="btn-copy">复制</button>';
        this._updateCopyButtonRef();
        this.saveData();
    },

    convert() {
        if (this._isConverting) return;
        this._isConverting = true;
        this._setConvertLoading(true);

        const input = this.els.inputRuby.value;
        const result = this.rubyToOneCharPerSyllable(input);

        this.els.outputResult.innerHTML = `<button class="copy-btn" id="btn-copy">复制</button>${result}`;
        this._updateCopyButtonRef();

        this._setConvertLoading(false);
        this._setConvertSuccessTemporarily();
        this.saveData();
        this._isConverting = false;
    },

    // 将输入的 [漢]{かな} 注音格式转换为全假名文本。
    toKanaOnly() {
        if (this._isConverting) return;
        this._isConverting = true;
        // 通过禁用“转为全假名”按钮来提供简单的加载反馈
        if (this.els.btnKanaOnly) {
            this.els.btnKanaOnly.disabled = true;
            const origText = this.els.btnKanaOnly.textContent;
            this.els.btnKanaOnly.textContent = '转为全假名中...';
            setTimeout(() => {
                // 执行转换
                const input = this.els.inputRuby.value || '';
                // 模式匹配 [汉]{かな} 并替换为假名部分
                const pattern = /\[([^\]]+)]\{([^}]+)}/g;
                let result = input.replace(pattern, (m, kanji, kana) => kana);
                result = result.replace(/[\[\]{}]/g, '');
                result = result
                    .split(/\r?\n/)
                    .filter(line => line.trim() !== '')
                    .join('\n');

                this.els.outputResult.innerHTML = `<button class="copy-btn" id="btn-copy">复制</button>${result}`;
                this._updateCopyButtonRef();

                // 恢复按钮状态
                this.els.btnKanaOnly.textContent = origText;
                this.els.btnKanaOnly.disabled = false;
                this.saveData();
                this._isConverting = false;
            }, 150);
        } else {
            this._isConverting = false;
        }
    },

    copyResult() {
        const resultText = this.els.outputResult.textContent.replace('复制', '').trim();
        navigator.clipboard.writeText(resultText).then(() => {
            const btn = this.els.btnCopy;
            if (!btn) return;
            const originalText = btn.textContent;
            btn.textContent = '已复制';
            setTimeout(() => { btn.textContent = originalText; }, 1500);
        }).catch(() => {
            alert('复制失败，请手动选择文本复制');
        });
    },

    _setConvertLoading(show) {
        if (!this.els.btnConvert) return;
        if (show) {
            this.els.btnConvert.innerHTML = `<span class="btn-spinner"><span class="spinner"></span><span>转换为一字一音中</span></span>`;
            this.els.btnConvert.disabled = true;
        } else {
            this.els.btnConvert.innerHTML = this._originalConvertHTML || '转换为一字一音';
            this.els.btnConvert.disabled = false;
        }
    },

    _setConvertSuccessTemporarily() {
        if (!this.els.btnConvert) return;
        const orig = this._originalConvertHTML || '转换为一字一音';
        this.els.btnConvert.textContent = '已转换为一字一音';
        setTimeout(() => {
            this.els.btnConvert.innerHTML = orig;
        }, 1000);
    },

    _updateCopyButtonRef() {
        const newBtn = document.getElementById('btn-copy');
        if (newBtn) {
            this.els.btnCopy = newBtn;
            const newNode = newBtn.cloneNode(true);
            newBtn.parentNode.replaceChild(newNode, newBtn);
            this.els.btnCopy = document.getElementById('btn-copy');
            this.els.btnCopy.addEventListener('click', () => this.copyResult());
        }
    },

    bindEvents() {
        // 点击切换模式（互斥），选中时会自动执行对应转换
        if (this.els.btnConvert) this.els.btnConvert.addEventListener('click', () => this.setMode('onechar'));
        if (this.els.btnKanaOnly) this.els.btnKanaOnly.addEventListener('click', () => this.setMode('kana'));
        this.els.btnClear.addEventListener('click', () => this.clear());

        this.els.inputRuby.addEventListener('input', () => {
            this.saveData();
            if (this._autoConvertTimer) clearTimeout(this._autoConvertTimer);
            this._autoConvertTimer = setTimeout(() => {
                // 根据活动模式自动执行；默认执行一字一音转换
                if (this._activeMode === 'kana') this.toKanaOnly();
                else this.convert();
                this._autoConvertTimer = null;
            }, this.AUTO_CONVERT_DEBOUNCE_MS);
        });

        // 初始渲染
        this.convert();
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
