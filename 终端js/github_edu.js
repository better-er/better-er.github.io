// ============================================================
// GitHub Education 认证页面 — 摄像头捕获劫持脚本
//
// 索引:
//   1. OLD_IMAGE_DATA        — 原始纯黑Base64图片（摄像头捕获后用此替换）
//   2. NEW_IMAGE_DATA        — 手动准备的学籍照片Base64数据
//   3. OLD_DEVICE_LABEL      — 原始设备名（OBS Virtual Camera）
//   4. NEW_DEVICE_LABEL      — 伪装设备名（Integrated Camera）
//
// 功能：
//   1. 将纯黑拍摄的Base64图片数据替换为手动准备的学籍照片
//   2. 将 "deviceLabel":"OBS Virtual Camera" 改为 "deviceLabel":"Integrated Camera"
//   3. 覆盖 img.src、style、文本节点、style标签、input/textarea 等
//   4. 在控制台输出替换成功的数量
// 显示成功次数: 2【纯黑图片】（显示替换1次 + 表单提交替换1次）
// 相机设备名替换: 1次【OBS→Integrated Camera】
// ============================================================

(function() {
    'use strict';

    // ---------- 常量定义 ----------
    // 原始Base64图片数据（需要被替换的内容，此为纯黑拍摄）
    const OLD_IMAGE_DATA = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAE8ATwDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k=';

    // 新的Base64图片数据（替换为目标内容）
    const NEW_IMAGE_DATA = 'your_new_base64_image_data_here'; // 请替换为实际的Base64数据

    // 设备标签替换规则
    const OLD_DEVICE_LABEL = '"deviceLabel":"OBS Virtual Camera"';
    const NEW_DEVICE_LABEL = '"deviceLabel":"Integrated Camera"';

    // ---------- 辅助函数 ----------
    function safeReplace(str) {
        if (typeof str !== 'string') return str;
        return str.replaceAll(OLD_IMAGE_DATA, NEW_IMAGE_DATA);
    }

    function replaceDeviceLabel(str) {
        if (typeof str !== 'string') return str;
        return str.replaceAll(OLD_DEVICE_LABEL, NEW_DEVICE_LABEL);
    }

    function replaceAllInString(str) {
        if (typeof str !== 'string') return str;
        let result = str;
        result = result.replaceAll(OLD_IMAGE_DATA, NEW_IMAGE_DATA);
        result = result.replaceAll(OLD_DEVICE_LABEL, NEW_DEVICE_LABEL);
        return result;
    }

    // ---------- 执行替换 ----------
    let replaceCount = 0;
    let deviceLabelCount = 0;

    // 1. 替换所有 <img> 标签的 src 属性
    document.querySelectorAll('img').forEach(img => {
        let changed = false;
        if (img.src && img.src.includes(OLD_IMAGE_DATA)) {
            img.src = safeReplace(img.src);
            changed = true;
        }
        if (img.src && img.src.includes(OLD_DEVICE_LABEL)) {
            img.src = replaceDeviceLabel(img.src);
            changed = true;
        }
        if (changed) replaceCount++;
    });

    // 2. 替换所有元素的 style 背景图片
    document.querySelectorAll('*').forEach(el => {
        const style = el.style;
        let changed = false;
        if (style.backgroundImage && style.backgroundImage.includes(OLD_IMAGE_DATA)) {
            style.backgroundImage = safeReplace(style.backgroundImage);
            changed = true;
        }
        if (style.backgroundImage && style.backgroundImage.includes(OLD_DEVICE_LABEL)) {
            style.backgroundImage = replaceDeviceLabel(style.backgroundImage);
            changed = true;
        }
        if (changed) replaceCount++;
    });

    // 3. 替换文本节点
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                return (node.textContent && 
                    (node.textContent.includes(OLD_IMAGE_DATA) || 
                     node.textContent.includes(OLD_DEVICE_LABEL)))
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );
    let textNode;
    while (textNode = walker.nextNode()) {
        const newText = replaceAllInString(textNode.textContent);
        if (newText !== textNode.textContent) {
            textNode.textContent = newText;
            replaceCount++;
            if (textNode.textContent.includes(OLD_DEVICE_LABEL)) {
                deviceLabelCount++;
            }
        }
    }

    // 4. 替换 <style> 标签内的 CSS
    document.querySelectorAll('style').forEach(styleTag => {
        let changed = false;
        if (styleTag.innerHTML && styleTag.innerHTML.includes(OLD_IMAGE_DATA)) {
            styleTag.innerHTML = safeReplace(styleTag.innerHTML);
            changed = true;
        }
        if (styleTag.innerHTML && styleTag.innerHTML.includes(OLD_DEVICE_LABEL)) {
            styleTag.innerHTML = replaceDeviceLabel(styleTag.innerHTML);
            changed = true;
        }
        if (changed) replaceCount++;
    });

    // 5. 替换 input / textarea / select 等表单元素
    // 5.1 <input>
    document.querySelectorAll('input').forEach(input => {
        let changed = false;
        if (input.value && (input.value.includes(OLD_IMAGE_DATA) || input.value.includes(OLD_DEVICE_LABEL))) {
            input.value = replaceAllInString(input.value);
            changed = true;
        }
        if (input.placeholder && (input.placeholder.includes(OLD_IMAGE_DATA) || input.placeholder.includes(OLD_DEVICE_LABEL))) {
            input.placeholder = replaceAllInString(input.placeholder);
            changed = true;
        }
        if (changed) {
            replaceCount++;
            if (input.value && input.value.includes('Integrated Camera')) deviceLabelCount++;
            if (input.placeholder && input.placeholder.includes('Integrated Camera')) deviceLabelCount++;
        }
    });

    // 5.2 <textarea>
    document.querySelectorAll('textarea').forEach(textarea => {
        if (textarea.value && (textarea.value.includes(OLD_IMAGE_DATA) || textarea.value.includes(OLD_DEVICE_LABEL))) {
            textarea.value = replaceAllInString(textarea.value);
            replaceCount++;
            if (textarea.value.includes('Integrated Camera')) deviceLabelCount++;
        }
    });

    // 5.3 <select> 中 <option>
    document.querySelectorAll('select option').forEach(option => {
        let changed = false;
        if (option.text && (option.text.includes(OLD_IMAGE_DATA) || option.text.includes(OLD_DEVICE_LABEL))) {
            option.text = replaceAllInString(option.text);
            changed = true;
        }
        if (option.value && (option.value.includes(OLD_IMAGE_DATA) || option.value.includes(OLD_DEVICE_LABEL))) {
            option.value = replaceAllInString(option.value);
            changed = true;
        }
        if (changed) {
            replaceCount++;
            if (option.text && option.text.includes('Integrated Camera')) deviceLabelCount++;
            if (option.value && option.value.includes('Integrated Camera')) deviceLabelCount++;
        }
    });

    // 5.4 其他带 value 属性的元素
    document.querySelectorAll('[value]').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'OPTION') return;
        if (el.value && (el.value.includes(OLD_IMAGE_DATA) || el.value.includes(OLD_DEVICE_LABEL))) {
            el.value = replaceAllInString(el.value);
            replaceCount++;
            if (el.value.includes('Integrated Camera')) deviceLabelCount++;
        }
    });

    // ========== 新增：专门处理包含 deviceLabel 的 JSON 字符串或表单数据 ==========
    // 6. 查找所有包含 "deviceLabel" 的文本内容（通常在 script 标签或隐藏的 JSON 数据中）
    const allElementsWithText = document.querySelectorAll('*');
    allElementsWithText.forEach(el => {
        // 检查 innerText 或 textContent（但避免重复处理已处理过的元素）
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        
        // 检查 data-* 属性
        for (let attr of el.attributes) {
            if (attr.name.startsWith('data-') && attr.value && 
                (attr.value.includes(OLD_DEVICE_LABEL) || attr.value.includes(OLD_IMAGE_DATA))) {
                attr.value = replaceAllInString(attr.value);
                replaceCount++;
                if (attr.value.includes('Integrated Camera')) deviceLabelCount++;
            }
        }
    });

    // 7. 专门处理 script 标签中的 JSON 数据（如果包含 deviceLabel）
    document.querySelectorAll('script:not([src])').forEach(script => {
        if (script.textContent && (script.textContent.includes(OLD_DEVICE_LABEL) || script.textContent.includes(OLD_IMAGE_DATA))) {
            const newContent = replaceAllInString(script.textContent);
            if (newContent !== script.textContent) {
                script.textContent = newContent;
                replaceCount++;
                if (newContent.includes('Integrated Camera')) deviceLabelCount++;
            }
        }
    });

    // 8. 替换所有属性中的 deviceLabel（包括 onclick、onchange 等事件属性）
    document.querySelectorAll('*').forEach(el => {
        let changed = false;
        for (let attr of el.attributes) {
            if (attr.value && (attr.value.includes(OLD_DEVICE_LABEL) || attr.value.includes(OLD_IMAGE_DATA))) {
                attr.value = replaceAllInString(attr.value);
                changed = true;
                if (attr.value.includes('Integrated Camera')) deviceLabelCount++;
            }
        }
        if (changed) replaceCount++;
    });

    // ---------- 输出结果 ----------
    console.log(`[替换完成] 共修改 ${replaceCount} 处内容。`);
    console.log(`  - 其中 deviceLabel 替换: ${deviceLabelCount} 处`);
    console.log(`  - Base64 图片替换: ${replaceCount - deviceLabelCount} 处`);
    
    if (replaceCount === 0) {
        console.warn('未找到任何匹配的内容，请检查常量定义是否正确。');
    }

})();