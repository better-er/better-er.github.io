// assets/js/back-to-home.js

(function() {
    // 只在非主页页面显示
    const isHome = window.location.pathname === '/index.html' || window.location.pathname === '/';
    if (isHome) return;

    // 创建返回按钮
    const backButton = document.createElement('a');
    backButton.href = '/';
    backButton.textContent = '返回首页';
    backButton.className = 'back-to-home';

    // 添加样式（直接内联，避免外部 CSS 加载延迟）
    const style = `
        position: fixed;
        top: 24px;
        left: 24px;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 16px;
        color: #2c3e50;
        font-size: 15px;
        font-weight: 500;
        text-decoration: none;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: pointer;
        font-family: inherit; /* 统一字体 */
    `;

    backButton.setAttribute('style', style);

    // 悬停效果：轻微上浮，背景变透，阴影增强
    backButton.addEventListener('mouseenter', () => {
        backButton.style.transform = 'translateY(-3px)';
        backButton.style.background = 'rgba(255, 255, 255, 0.9)';
        backButton.style.boxShadow = '0 10px 28px rgba(0, 0, 0, 0.08)';
    });

    backButton.addEventListener('mouseleave', () => {
        backButton.style.transform = 'translateY(0)';
        backButton.style.background = 'rgba(255, 255, 255, 0.8)';
        backButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.05)';
    });

    // 点击反馈：轻微压下
    backButton.addEventListener('mousedown', () => {
        backButton.style.transform = 'translateY(1px)';
        backButton.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.05)';
    });

    backButton.addEventListener('mouseup', () => {
        backButton.style.transform = 'translateY(-3px)';
        backButton.style.boxShadow = '0 10px 28px rgba(0, 0, 0, 0.08)';
    });

    // 添加图标（Unicode 箭头 + 平滑过渡）
    const icon = document.createElement('span');
    icon.innerHTML = '←';
    icon.style.fontSize = '18px';
    icon.style.opacity = '0.8';
    icon.style.transition = 'opacity 0.2s';
    backButton.prepend(icon);

    // 悬停时图标变亮
    backButton.addEventListener('mouseenter', () => {
        icon.style.opacity = '1';
    });
    backButton.addEventListener('mouseleave', () => {
        icon.style.opacity = '0.8';
    });

    // 插入页面顶部
    document.body.insertBefore(backButton, document.body.firstChild);

})();
