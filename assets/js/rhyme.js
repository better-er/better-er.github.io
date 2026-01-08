// 拼音拆分函数 —— 与原始 Python 逻辑完全一致
function splitPinyin(pinyin) {
    pinyin = pinyin.replace(/[0-9]/g, ''); // 移除声调数字
    // 保持原始拼写，不在此处把 uei/iou/uen 换为简写，后续由 normalizeFinal 统一处理
    const vowels = 'aeiouüv';
    let initial = '';
    let final = pinyin;

    for (let i = 0; i < pinyin.length; i++) {
        if (vowels.includes(pinyin[i])) {
            initial = pinyin.slice(0, i);
            final = pinyin.slice(i);
            final = final.replace(/v/g, 'ü'); // 将 v 替换为 ü
            break;
        }
    }

    // yu → ü
    if (initial === 'y' && final.startsWith('u')) {
        initial = '';
        final = 'ü' + final.slice(1);
    }
    // y → i
    if (initial === 'y' && !final.startsWith('i')) {
        initial = '';
        final = 'i' + final;
    }
    // w → u
    if (initial === 'w' && !final.startsWith('u')) {
        initial = '';
        final = 'u' + final;
    }
    // j/q/x/y + u → ü
    if (final.startsWith('u') && ['j', 'q', 'x', 'y'].includes(initial)) {
        final = 'ü' + final.slice(1);
    }
    // z/c/s + i → zi
    if (final.startsWith('i') && ['z', 'c', 's'].includes(initial)) {
        final = 'zi';
    }
    // zh/ch/sh/r + i → zhi
    if (final.startsWith('i') && ['zh', 'ch', 'sh', 'r'].includes(initial)) {
        final = 'zhi';
    }
    // ue → üe
    if (final === 'ue' && !['j', 'q', 'x', 'y'].includes(initial)) {
        final = 'üe';
    }

    return {initial, final};
}

// 将可能的拼写变体映射到规范韵母（在此集中过滤特殊变体）
function normalizeFinal(final) {
    // 处理 iu/ui/un 的变体 -> 对应回 iou/uei/uen（与 ALL_FINALS 保持一致）
    if (final === 'ui') return 'uei';
    if (final === 'iu') return 'iou';
    if (final === 'un') return 'uen';

    // 兼容带"ü"的写法（如果字典使用 'ü' 或 'u:' 视情况调整）
    // 目前保持原样返回
    return final;
}

// 获取真实韵母名称（用于内部匹配）
function getRealFinal(pinyin) {
    const {final: processedFinal} = splitPinyin(pinyin);
    return normalizeFinal(processedFinal);
}

// 检查当前拼音是否匹配某个韵母或其特殊映射组
function check(pinyin, targetFinal) {
    const realFinal = getRealFinal(pinyin);

    // 如果是特殊组
    if (SPECIAL_MAPPINGS[targetFinal]) {
        return SPECIAL_MAPPINGS[targetFinal].includes(realFinal);
    }

    // 正常情况
    return realFinal === targetFinal;
}

// 全局状态
let isMultiSelect = false;
let selectedFinals = new Set();
let pinyinDict = {};        // 韵母 -> [ [字, 频率], ... ]
let charToPinyinDict = {};  // 汉字 -> [拼音列表]，用于识别多音字

// 切换单选/多选
document.getElementById('mode-btn').addEventListener('click', function () {
    isMultiSelect = !isMultiSelect;
    this.textContent = isMultiSelect ? '切换为单选' : '切换为多选';
    this.classList.toggle('active');
    if (!isMultiSelect && selectedFinals.size > 1) {
        selectedFinals.clear();
        updateSelectedDisplay();
    }
});

// 清除选择
document.getElementById('clear-btn').addEventListener('click', function () {
    selectedFinals.clear();
    // 同时清除表格中所有韵母按钮的高亮状态
    document.querySelectorAll('button[data-final]').forEach(btn => btn.classList.remove('active'));
    updateSelectedDisplay();
    queryByFinals();
});

// 更新选中显示
function updateSelectedDisplay() {
    const displayDiv = document.getElementById('selected-finals');
    if (selectedFinals.size === 0) {
        displayDiv.textContent = '已选韵母：暂无';
    } else {
        const labels = Array.from(selectedFinals).map(f => {
            if (f === 'zi') return `${f} (ㄗ ㄘ ㄙ)`;
            if (f === 'zhi') return `${f} (ㄓ ㄔ ㄕ ㄖ)`;
            return f;
        });
        displayDiv.textContent = '已选韵母：' + labels.join('  ');
    }
}

// 查询并显示结果
function queryByFinals() {
    if (selectedFinals.size === 0) {
        document.getElementById('result').innerHTML = '<p class="loading">请选择一个或多个韵母...</p>';
        return;
    }

    const resultChars = [];

    for (const [pinyin, charList] of Object.entries(pinyinDict)) {
        for (const targetFinal of selectedFinals) {
            if (check(pinyin, targetFinal)) {
                resultChars.push(...charList);
                break;
            }
        }
    }

    // 按频率降序
    resultChars.sort((a, b) => b[1] - a[1]);

    const resultDiv = document.getElementById('result');

    if (resultChars.length === 0) {
        resultDiv.innerHTML = `<p>没有找到韵母为 [${Array.from(selectedFinals).join('、')}] 的汉字。</p>`;
        return;
    }

    // 每行最多20字
    const lines = [];
    for (let i = 0; i < resultChars.length; i += 20) {
        const line = resultChars.slice(i, i + 20).map(item => item[0]).join(' ');
        lines.push(line);
    }

    resultDiv.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
}

// ✅ 第一重冗余校验：检查每个可选韵母是否能选出汉字
function checkFinalHasCharacters() {
    const allButtons = document.querySelectorAll('button[data-final]');
    const clickableButtons = Array.from(allButtons).filter(button => !button.disabled);

    const results = {
        validFinals: [],      // 有字的韵母
        emptyFinals: [],      // 无字的韵母
        totalChecked: 0
    };

    // 检查每个可点击的韵母
    for (const button of clickableButtons) {
        const final = button.getAttribute('data-final');
        results.totalChecked++;

        let hasCharacters = false;
        let characterCount = 0;

        for (const [pinyin, charList] of Object.entries(pinyinDict)) {
            if (check(pinyin, final)) {
                characterCount += charList.length;
                hasCharacters = true;
            }
        }

        if (hasCharacters) {
            results.validFinals.push({
                final: final,
                count: characterCount
            });
        } else {
            results.emptyFinals.push(final);
        }
    }

    return results;
}

// ✅ 第二重冗余校验：检查可选韵母之间的互斥情况
function checkFinalsMutualExclusive() {
    const allButtons = document.querySelectorAll('button[data-final]');
    const clickableFinals = new Set();

    allButtons.forEach(button => {
        const final = button.getAttribute('data-final');
        // 去除对 INVALID_FINALS 的额外过滤：只以按钮是否被禁用为准
        if (!button.disabled) {
            clickableFinals.add(final);
        }
    });

    const validFinals = Array.from(clickableFinals);
    const conflictResults = [];

    // 如果只剩下一个有效韵母，没有互斥问题
    if (validFinals.length <= 1) {
        return {
            totalFinals: validFinals.length,
            conflicts: [],
            conflictPairs: 0
        };
    }

    // 检查所有可能的韵母对
    for (let i = 0; i < validFinals.length; i++) {
        for (let j = i + 1; j < validFinals.length; j++) {
            const f1 = validFinals[i];
            const f2 = validFinals[j];

            const chars1 = new Set();
            const chars2 = new Set();

            // 收集每个韵母对应的汉字（排除多音字）
            for (const [pinyin, charList] of Object.entries(pinyinDict)) {
                if (check(pinyin, f1)) {
                    for (const [char] of charList) {
                        if (charToPinyinDict[char] && charToPinyinDict[char].length > 1) {
                            continue; // 跳过多音字
                        }
                        chars1.add(char);
                    }
                }
                if (check(pinyin, f2)) {
                    for (const [char] of charList) {
                        if (charToPinyinDict[char] && charToPinyinDict[char].length > 1) {
                            continue;
                        }
                        chars2.add(char);
                    }
                }
            }

            const intersection = [...chars1].filter(char => chars2.has(char));
            if (intersection.length > 0) {
                conflictResults.push({
                    f1,
                    f2,
                    chars: intersection,
                    count: intersection.length
                });
            }
        }
    }

    return {
        totalFinals: validFinals.length,
        conflicts: conflictResults,
        conflictPairs: conflictResults.length
    };
}

// ✅ 第三重冗余校验：查找未被任一可选韵母匹配的汉字（与前两者保持风格一致）
function checkCharsUnmatched() {
    const allButtons = document.querySelectorAll('button[data-final]');
    const clickableFinals = Array.from(allButtons)
        .filter(b => !b.disabled)
        .map(b => b.getAttribute('data-final'));

    // 构建字符 -> 拼音 列表的合并映射：优先使用 charToPinyinDict，否则从 pinyinDict 回溯
    const charToPinyins = {};
    for (const [char, pList] of Object.entries(charToPinyinDict || {})) {
        charToPinyins[char] = Array.isArray(pList) ? pList.slice() : [pList];
    }
    for (const [pinyin, charList] of Object.entries(pinyinDict || {})) {
        for (const item of charList) {
            const ch = item[0];
            if (!charToPinyins[ch]) charToPinyins[ch] = [];
            if (!charToPinyins[ch].includes(pinyin)) {
                charToPinyins[ch].push(pinyin);
            }
        }
    }

    const unmatchedChars = [];
    for (const [char, pList] of Object.entries(charToPinyins)) {
        let matched = false;
        for (const p of pList) {
            for (const f of clickableFinals) {
                if (check(p, f)) {
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }
        if (!matched) unmatchedChars.push(char);
    }

    return {
        totalChars: Object.keys(charToPinyins).length,
        unmatchedChars: unmatchedChars,
        unmatchedCount: unmatchedChars.length
    };
}

// ✅ 执行完整的冗余校验并显示报告
function runRedundancyCheck() {
    const redundancyDiv = document.getElementById('redundancy-check');

    // 第一重校验：检查每个韵母是否有字
    const charCheckResults = checkFinalHasCharacters();

    // 第二重校验：检查互斥情况
    const mutualCheckResults = checkFinalsMutualExclusive();

    // 第三重校验：未被任一可选韵母匹配的汉字
    const unmatchedResults = checkCharsUnmatched();
    const unmatchedChars = unmatchedResults.unmatchedChars;

    // 生成完整的冗余校验报告
    let reportHtml = '<div class="check-title">📊 冗余校验报告</div>';

    // 第一部分：韵母有效性检查
    reportHtml += '<div class="check-category">';
    reportHtml += '<div><strong>第一重校验：韵母有效性检查</strong></div>';
    reportHtml += `<div>检测了 ${charCheckResults.totalChecked} 个韵母按钮：</div>`;

    if (charCheckResults.emptyFinals.length === 0) {
        reportHtml += `<div class="check-pass">✅ 所有 ${charCheckResults.validFinals.length} 个韵母均能选出汉字</div>`;

        // 显示每个韵母的字数统计（前10个）
        if (charCheckResults.validFinals.length > 0) {
            reportHtml += '<div style="margin-top: 5px; font-size: 12px; color: #555;">';
            reportHtml += '字数统计：' + charCheckResults.validFinals
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map(item => `${item.final}(${item.count}字)`)
                .join('、');
            if (charCheckResults.validFinals.length > 10) {
                reportHtml += ` 等 ${charCheckResults.validFinals.length} 个韵母`;
            }
            reportHtml += '</div>';
        }
    } else {
        reportHtml += `<div class="check-fail">❌ 发现 ${charCheckResults.emptyFinals.length} 个空韵母：${charCheckResults.emptyFinals.join('、')}</div>`;
    }
    reportHtml += '</div>';

    // 第二部分：互斥检查
    reportHtml += '<div class="check-category">';
    reportHtml += '<div><strong>第二重校验：互斥性检查</strong></div>';
    reportHtml += `<div>检测了 ${mutualCheckResults.totalFinals} 个有效韵母：</div>`;

    if (mutualCheckResults.totalFinals <= 1) {
        reportHtml += `<div class="check-pass">✅ 韵母太少（≤1），无需进行互斥检查</div>`;
    } else if (mutualCheckResults.conflictPairs === 0) {
        reportHtml += `<div class="check-pass">✅ 所有 ${mutualCheckResults.totalFinals} 个韵母完全互斥（无非多音字重复）</div>`;
    } else {
        reportHtml += `<div class="check-fail">❌ 发现 ${mutualCheckResults.conflictPairs} 组互斥冲突（共 ${mutualCheckResults.conflicts.reduce((sum, c) => sum + c.count, 0)} 个非多音字重复）：</div>`;

        // 显示主要的冲突对（最多显示5个）
        const sortedConflicts = mutualCheckResults.conflicts.sort((a, b) => b.count - a.count);
        const displayCount = Math.min(sortedConflicts.length, 5);

        for (let i = 0; i < displayCount; i++) {
            const conflict = sortedConflicts[i];
            reportHtml += `<div style="margin-left: 15px; font-size: 12px; margin-top: 3px;">`;
            reportHtml += `• 【${conflict.f1}】与【${conflict.f2}】有 ${conflict.chars.length} 字重复：${conflict.chars.slice(0, 5).join('、')}`;
            if (conflict.chars.length > 5) {
                reportHtml += ` 等 ${conflict.chars.length} 字`;
            }
            reportHtml += `</div>`;
        }

        if (sortedConflicts.length > 5) {
            reportHtml += `<div style="margin-left: 15px; font-size: 12px; color: #777;">... 以及 ${sortedConflicts.length - 5} 更多组冲突</div>`;
        }
    }
    reportHtml += '</div>';

    // 第三部分：未被任一可选韵母匹配的汉字
    reportHtml += '<div class="check-category">';
    reportHtml += '<div><strong>第三重校验：未被任一可选韵母匹配的汉字</strong></div>';
    reportHtml += `<div>检测到 ${unmatchedChars.length} 个未被匹配的汉字：</div>`;
    if (unmatchedChars.length === 0) {
        reportHtml += `<div class="check-pass">✅ 所有汉字至少能被一个韵母匹配</div>`;
    } else {
        // 显示前 30 个样例以供人工检查
        const sample = unmatchedChars.slice(0, 30).join('、');
        reportHtml += `<div class="check-fail">❌ 示例（前 ${Math.min(unmatchedChars.length, 30)} 个）： ${sample}</div>`;
    }
    reportHtml += '</div>';

    // 第四部分：总体评估
    reportHtml += '<div class="check-category" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">';

    const hasEmptyFinals = charCheckResults.emptyFinals.length > 0;
    const hasConflicts = mutualCheckResults.conflictPairs > 0;
    const hasUnmatched = unmatchedChars.length > 0;

    if (!hasEmptyFinals && !hasConflicts && !hasUnmatched) {
        reportHtml += '<div class="check-pass"><strong>✅ 冗余校验通过：系统完全正常</strong></div>';
        reportHtml += `<div style="font-size: 12px; color: #555;">所有 ${charCheckResults.validFinals.length} 个韵母均有对应汉字，且完全互斥，且每个汉字至少被一个韵母覆盖</div>`;
    } else {
        reportHtml += '<div class="check-fail"><strong>⚠️ 冗余校验发现问题：</strong></div>';
        const issues = [];
        if (hasEmptyFinals) {
            issues.push(`${charCheckResults.emptyFinals.length} 个空韵母`);
        }
        if (hasConflicts) {
            issues.push(`${mutualCheckResults.conflictPairs} 组互斥冲突`);
        }
        if (hasUnmatched) {
            issues.push(`${unmatchedChars.length} 个未被匹配的汉字`);
        }
        reportHtml += `<div style="font-size: 12px; color: #e74c3c;">发现 ${issues.join(' 和 ')}</div>`;
    }
    reportHtml += '</div>';

    redundancyDiv.innerHTML = reportHtml;
}

// 加载拼音字典（韵母 -> [字, 频率]）
async function loadPinyinData() {
    const resultDiv = document.getElementById('result');
    try {
        const [pinyinResp, charResp] = await Promise.all([
            fetch('assets/json/pinyin_simp.dict.json'),
            fetch('assets/json/char_to_pinyin.dict.json')
        ]);

        if (!pinyinResp.ok) {
            resultDiv.innerHTML = `<p class="error">错误：无法加载 pinyin_simp.dict.json (HTTP ${pinyinResp.status})</p>`;
            console.error(`pinyin_simp.dict.json: HTTP ${pinyinResp.status}`);
            return;
        }
        if (!charResp.ok) {
            resultDiv.innerHTML = `<p class="error">错误：无法加载 char_to_pinyin.dict.json (HTTP ${charResp.status})</p>`;
            console.error(`char_to_pinyin.dict.json: HTTP ${charResp.status}`);
            return;
        }

        pinyinDict = await pinyinResp.json();
        charToPinyinDict = await charResp.json();

        resultDiv.innerHTML = '<p class="loading">数据加载完成，请选择韵母...</p>';

        // ✅ 执行两重冗余校验并显示完整报告
        runRedundancyCheck();

    } catch (error) {
        resultDiv.innerHTML = `<p class="error">错误：请确保 pinyin_simp.dict.json 和 char_to_pinyin.dict.json 文件与本 HTML 文件在同一目录中。</p>`;
        console.error("加载拼音数据失败:", error);
    }
}

// 切换选中状态
function toggleFinal(final) {
    const button = document.querySelector(`button[data-final="${final}"]`);
    if (!button) return;

    if (isMultiSelect) {
        if (selectedFinals.has(final)) {
            selectedFinals.delete(final);
            button.classList.remove('active');
        } else {
            selectedFinals.add(final);
            button.classList.add('active');
        }
    } else {
        // 单选模式：先清除所有已激活按钮
        document.querySelectorAll('button[data-final]').forEach(btn => {
            btn.classList.remove('active');
        });
        selectedFinals.clear();
        selectedFinals.add(final);
        button.classList.add('active');
    }

    updateSelectedDisplay();
    queryByFinals();
}


// 初始化
window.addEventListener('DOMContentLoaded', () => {
    loadPinyinData().then(() => {
        document.getElementById('mode-btn').textContent = '切换为多选';
        document.getElementById('mode-btn').classList.remove('active');
    });
});

// 标准韵母表：严格对应 HTML 表格中的韵母（包含 in、ün 等）
const ALL_FINALS = [
    'i', 'u', 'ü',

    'a', 'ia', 'ua',
    'o', 'uo',
    'e', 'ie', 'üe',

    'ai', 'uai',
    'ei', 'uei',
    'ao', 'iao',
    'ou', 'iou',

    'an', 'ian', 'uan', 'üan',
    'en', 'in', 'uen', 'ün',
    'ang', 'iang', 'uang',
    'eng', 'ing', 'ueng',
    'ong', 'iong',

    'er', 'zi', 'zhi'
];

// 特殊韵母映射（用于实际匹配）
const SPECIAL_MAPPINGS = {
    'zi': ['zi', 'ci', 'si'],
    'zhi': ['zhi', 'chi', 'shi', 'ri']
};

window.ALL_FINALS = ALL_FINALS;
window.SPECIAL_MAPPINGS = SPECIAL_MAPPINGS;
