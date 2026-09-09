# typing 页面验证

一个脚本跑完所有检查，在仓库根目录执行：

```powershell
node tests/run_tests.mjs
```

全部通过时退出码为 0，有失败项时为 1。

## 覆盖范围

**分词正确性**

- 四组样本的 token id 与官方 `tokenizers` 库逐位对照一致
- spans 与 encode 顺序一致，且完整连续覆盖原文
- 词表 128000 个键无重复

**内置素材**

- 中文、英文、代码各 10 条
- 无重复，每条都能正常分词，spans 连续覆盖

**页面逻辑**

- 打完原文后停表，token/s 显示全程平均速度而非清零
- token/s 保留两位小数
- 换素材时旧输入先清空，新原文不会被逐字标红
- 自定义原文模式的完整流程：展开面板、应用、重来、写入本地存储
- 自由输入模式隐藏素材行与自定义面板，切回不报错

页面逻辑部分用一个极简 DOM 桩把 `assets/js/typing.js` 拉起来跑，不依赖浏览器。

## 对照值来源

`run_tests.mjs` 里的 `EXPECTED_IDS` 由官方 `tokenizers` 库对同一份 `assets/json/deepseek_v4_tokenizer.json` 生成，写死在脚本里，所以跑测试不需要装 Python。
