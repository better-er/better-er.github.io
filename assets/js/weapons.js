// 预定义分类（仅用于界面组织）
const BASE_ATTRS = [
  "敏捷提升",
  "力量提升",
  "意志提升",
  "智识提升",
  "主能力提升"
];

const ADDITIONAL_ATTRS = [
  "生命提升",
  "攻击提升",
  "物理伤害提升",
  "灼热伤害提升",
  "寒冷伤害提升",
  "自然伤害提升",
  "电磁伤害提升",
  "法术伤害提升",
  "暴击率提升",
  "源石技艺提升",
  "治疗效率提升",
  "终结技效率提升"
];

// 所有武器数据
let weaponsData = [];

// 武器星级颜色映射（从配置文件加载）
let weaponColors = {};

// 当前选中属性集合（平铺）
let selectedAttrs = new Set();

// 便捷：按分类维护选中集合（用于刻写券模式校验）
let selectedBase = new Set();
let selectedAdditional = new Set();
let selectedSkill = new Set();

// 模式开关
let modeKexie = false;

// 助手：将各种格式的星级文本解析为数字（支持中文数字与阿拉伯数字）
function parseStarLevel(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const str = String(s).trim();
  // 先尝试提取阿拉伯数字
  const m = str.match(/(\d+)/);
  if (m) return Number(m[1]);
  // 中文数字映射
  const map = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10};
  for (const ch of Object.keys(map)) {
    if (str.includes(ch)) return map[ch];
  }
  return 0;
}

// 初始化：加载 JSON 并构建界面
async function init() {
  const response = await fetch('assets/json/weapons.json');
  if (!response.ok) {
    throw new Error(`无法加载 weapons.json: ${response.status}`);
  }
  weaponsData = await response.json();

  // 读取武器星级颜色配置（可选，失败时使用默认色）
  try {
    const colorResp = await fetch('assets/json/weapon_colors.json');
    if (colorResp.ok) {
      weaponColors = await colorResp.json();
    } else {
      weaponColors = {};
    }
  } catch (e) {
    weaponColors = {};
  }

  // 更新加载信息
  const loadingInfoEl = document.getElementById('loading-info');
  loadingInfoEl.textContent = `已加载 ${weaponsData.length} 条武器数据`;


  // 提取所有唯一属性值（用于自动分类）
  const allAttributes = new Set();
  weaponsData.forEach(w => {
    allAttributes.add(w.effect_1);
    allAttributes.add(w.effect_2);
    allAttributes.add(w.effect_3);
  });

  // 自动分类：技能属性 = 所有属性 - 基础 - 附加
  const skillAttrs = [...allAttributes].filter(attr =>
    !BASE_ATTRS.includes(attr) && !ADDITIONAL_ATTRS.includes(attr)
  );

  // 渲染三组标签
  renderTags('base-attributes', BASE_ATTRS);
  renderTags('additional-attributes', ADDITIONAL_ATTRS);
  renderTags('skill-attributes', skillAttrs);


  // 绑定点击事件（统一处理）
  document.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', toggleAttribute);
  });


  // 绑定清空按钮
  document.getElementById('btn-clear').addEventListener('click', clearSelection);
  // 绑定“我就要看”按钮
  document.getElementById('btn-see-all').addEventListener('click', filterWeaponsLoose);
  // 绑定“技能相同的武器”按钮
  document.getElementById('btn-same-skills').addEventListener('click', showSameSkillsWeapons);

  // 绑定刻写券模式开关
  document.getElementById('mode-kexie').addEventListener('change', (e) => {
    modeKexie = e.target.checked;
    document.querySelectorAll('.tag.selected').forEach(tag => {
      const attr = tag.getAttribute('data-attr');
      const cat = tag.getAttribute('data-cat');
      // Keep flat set in sync with DOM
      selectedAttrs.add(attr);
      if (cat === 'base') selectedBase.add(attr);
      else if (cat === 'additional') selectedAdditional.add(attr);
      else selectedSkill.add(attr);
    });
    updateStatus();
    // 根据新模式重新执行筛选（保留当前选择）
    if (modeKexie) filterWeaponsKexie();
    else filterWeapons();
  });


  // 初次渲染状态
  updateStatus();
  filterWeapons();
}

// 渲染一组标签
function renderTags(containerId, attributes) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  attributes.forEach(attr => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = attr;
    tag.setAttribute('data-attr', attr);
    // 标注所属分类，便于后续判断
    const cat = containerId === 'base-attributes' ? 'base' : (containerId === 'additional-attributes' ? 'additional' : 'skill');
    tag.setAttribute('data-cat', cat);
    container.appendChild(tag);
  });
}

// 切换选中状态
function toggleAttribute(e) {
  const attr = e.currentTarget.getAttribute('data-attr');
  const cat = e.currentTarget.getAttribute('data-cat');

  // 如果刻写券模式下，需要在选择时进行分类约束（但允许先选，状态提示会告知）
  if (selectedAttrs.has(attr)) {
    // 取消选中
    selectedAttrs.delete(attr);
    e.currentTarget.classList.remove('selected');
    // 从分类集合移除
    if (cat === 'base') selectedBase.delete(attr);
    else if (cat === 'additional') selectedAdditional.delete(attr);
    else selectedSkill.delete(attr);
  } else {
    // 选中时：如果不是刻写券模式，直接添加；若为刻写券模式，也允许添加，但 updateStatus 会提示是否超选
    selectedAttrs.add(attr);
    e.currentTarget.classList.add('selected');
    if (cat === 'base') selectedBase.add(attr);
    else if (cat === 'additional') selectedAdditional.add(attr);
    else selectedSkill.add(attr);
  }
  updateStatus();
  // 根据当前模式调用不同的筛选逻辑
  if (modeKexie) filterWeaponsKexie();
  else filterWeapons();
}

// 更新状态提示 & 控制按钮显示
function updateStatus() {
  const statusEl = document.getElementById('status');
  const seeAllBtn = document.getElementById('btn-see-all');
  const sameSkillsBtn = document.getElementById('btn-same-skills');
  const count = selectedAttrs.size;

  // “技能相同的武器”按钮仅在未选择任何词条时显示
  if (count === 0) {
    sameSkillsBtn.style.display = 'inline-block';
  } else {
    sameSkillsBtn.style.display = 'none';
  }

  if (!modeKexie) {
    if (count === 0) {
      statusEl.textContent = '请选择恰好 3 个属性进行筛选';
      seeAllBtn.style.display = 'none';
    } else if (count === 3) {
      statusEl.textContent = `已选中 ${count} 个属性：${[...selectedAttrs].join('、')}`;
      seeAllBtn.style.display = 'none';
    } else {
      statusEl.textContent = `已选中 ${count} 个属性，请再选 ${3 - count} 个以匹配`;
      seeAllBtn.style.display = 'inline-block';
    }
  } else {
    // 刻写券模式：基础属性需恰好 3 个，额外从（附加+技能）里选 1 个
    const baseCount = selectedBase.size;
    const extraCount = selectedAdditional.size + selectedSkill.size;

    // 状态文本更详细提示分类情况
    if (baseCount === 0 && extraCount === 0) {
      statusEl.textContent = '刻写券模式：请选择基础属性 3 个 +（附加 或 技能）1 个';
      seeAllBtn.style.display = 'none';
    } else {
      statusEl.textContent = `刻写券模式：基础 ${baseCount}/3，附加/技能 ${extraCount}/1`;
      // 当分类满足条件时隐藏“我就要看”按钮（会自动筛选），否则展示宽松按钮以允许查看部分匹配的结果
      if (baseCount === 3 && extraCount === 1) seeAllBtn.style.display = 'none';
      else seeAllBtn.style.display = 'inline-block';
    }
  }
}

// 清空所有选中
function clearSelection() {
  selectedAttrs.clear();
  selectedBase.clear();
  selectedAdditional.clear();
  selectedSkill.clear();
  document.querySelectorAll('.tag').forEach(tag => {
    tag.classList.remove('selected');
  });
  updateStatus();
  if (modeKexie) filterWeaponsKexie();
  else filterWeapons();
}

// 标准筛选：仅当选中 3 个时触发（精确匹配）
function filterWeapons() {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  if (selectedAttrs.size !== 3) {
    return; // 仅当满3项时才做精确匹配
  }

  const target = new Set(selectedAttrs);
  const filtered = weaponsData.filter(w => {
    const weaponSet = new Set([w.effect_1, w.effect_2, w.effect_3]);
    return weaponSet.size === 3 &&
      weaponSet.size === target.size &&
      [...weaponSet].every(e => target.has(e)) &&
      [...target].every(e => weaponSet.has(e));
  });

  renderResults(filtered);
}

// 宽松筛选：当前选中多少个，就匹配多少个（任意数量）
function filterWeaponsLoose() {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  if (selectedAttrs.size === 0) return;

  const target = new Set(selectedAttrs);
  const filtered = weaponsData.filter(w => {
    const weaponSet = new Set([w.effect_1, w.effect_2, w.effect_3]);
    // 匹配规则：选中的每个属性都必须出现在武器的三个属性中
    return [...target].every(attr => weaponSet.has(attr));
  });

  renderResults(filtered);
}

// 新：刻写券模式筛选逻辑
// 规则：基础属性指定恰好 3 个（selectedBase），附加或技能属性合计指定恰好 1 个（selectedAdditional 或 selectedSkill）
// 筛选出满足：武器的属性一是基础属性三中的任意一个，属性二或属性三是所选的额外属性（附加或技能）
function filterWeaponsKexie() {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  // 只有当满足 精确 3 基础 + 1 额外 时才做严格筛选
  if (selectedBase.size !== 3 || (selectedAdditional.size + selectedSkill.size) !== 1) {
    return;
  }

  // 目标集合
  const baseSet = new Set(selectedBase);
  // 合并附加+技能集合（只有1个）
  const extras = [...selectedAdditional, ...selectedSkill];
  const extraAttr = extras[0];

  const filtered = weaponsData.filter(w => {
    // 属性一必须是三个基础属性之一
    const attr1 = w.effect_1;
    const attr2 = w.effect_2;
    const attr3 = w.effect_3;
    const cond1 = baseSet.has(attr1);
    // 属性二或属性三其中之一必须等于选中的额外属性
    const cond2 = (attr2 === extraAttr) || (attr3 === extraAttr);
    return cond1 && cond2;
  });

  renderResults(filtered);
}

// 新：展示技能相同的武器
function showSameSkillsWeapons() {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';

  const skillGroups = new Map();

  weaponsData.forEach(w => {
    // 属性排序以保证组合一致性
    const effects = [w.effect_1, w.effect_2, w.effect_3].sort().join(',');
    if (!skillGroups.has(effects)) {
      skillGroups.set(effects, []);
    }
    skillGroups.get(effects).push(w);
  });

  const duplicateGroups = [...skillGroups.values()].filter(group => group.length > 1);

  if (duplicateGroups.length === 0) {
    resultsEl.innerHTML = `<div class="no-results">未发现技能组合完全相同的武器</div>`;
    return;
  }

  duplicateGroups.forEach(group => {
    const groupHeader = document.createElement('div');
    groupHeader.style.cssText = 'margin-top: 20px; padding: 10px; background: #e9ecef; border-left: 4px solid #3498db; font-weight: bold; color: #2c3e50;';
    const effects = [group[0].effect_1, group[0].effect_2, group[0].effect_3].join(' + ');
    groupHeader.textContent = `技能组合：${effects}`;
    resultsEl.appendChild(groupHeader);

    // 复用 renderResults 的核心逻辑，但不清空容器
    renderWeaponsToContainer(group, resultsEl);
  });
}

// 辅助函数：渲染武器列表到指定容器
function renderWeaponsToContainer(weapons, container) {
  weapons.sort((a, b) => parseStarLevel(b.star_level) - parseStarLevel(a.star_level));

  weapons.forEach(w => {
    const card = document.createElement('div');
    card.className = 'weapon-card';
    const color = weaponColors[String(w.star_level)] || '#ddd';
    card.style.border = `2px solid ${color}`;
    card.style.borderRadius = '6px';
    card.style.padding = '8px';
    card.style.marginTop = '10px';

    const nameEl = document.createElement('div');
    nameEl.className = 'weapon-name';
    nameEl.textContent = w.name;

    const typeEl = document.createElement('div');
    typeEl.className = 'weapon-type';
    typeEl.textContent = `【${w.star_level} ${w.type}】`;

    const effectsEl = document.createElement('div');
    effectsEl.className = 'weapon-detail';
    effectsEl.textContent = `属性一：${w.effect_1} | 属性二：${w.effect_2} | 属性三：${w.effect_3}`;

    card.appendChild(nameEl);
    card.appendChild(typeEl);
    card.appendChild(effectsEl);
    container.appendChild(card);
  });
}

// 公共渲染函数：避免重复代码
function renderResults(filtered) {
  const resultsEl = document.getElementById('results');
  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div class="no-results">未找到符合所选属性的武器</div>`;
    return;
  }

  resultsEl.innerHTML = '';

  // 按星级从高到低排序，确保高星级显示在上面
  filtered.sort((a, b) => parseStarLevel(b.star_level) - parseStarLevel(a.star_level));

  filtered.forEach(w => {
    const card = document.createElement('div');
    card.className = 'weapon-card';

    // 根据星级设置边框颜色（配置文件中查找，失败使用灰色）
    const color = weaponColors[String(w.star_level)] || '#ddd';
    card.style.border = `2px solid ${color}`;
    card.style.borderRadius = '6px';
    card.style.padding = '8px';

    const nameEl = document.createElement('div');
    nameEl.className = 'weapon-name';
    nameEl.textContent = w.name;

    const typeEl = document.createElement('div');
    typeEl.className = 'weapon-type';
    typeEl.textContent = `【${w.star_level} ${w.type}】`;

    const effectsEl = document.createElement('div');
    effectsEl.className = 'weapon-detail';
    effectsEl.textContent = `属性一：${w.effect_1} | 属性二：${w.effect_2} | 属性三：${w.effect_3}`;

    card.appendChild(nameEl);
    card.appendChild(typeEl);
    card.appendChild(effectsEl);

    resultsEl.appendChild(card);
  });
}

// 启动
init().catch(err => {
  document.getElementById('results').innerHTML = `
                <div class="no-results">加载失败：${err.message}</div>
            `;
});