// assets/js/back-to-home.js

(function () {
  // ==================== 统一注入站点图标（favicon）====================
  // 只要引入本脚本就能自动加上图标，无需在页面里逐个手写 <link>
  if (!document.querySelector('link[rel="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/png';
    favicon.href = '/assets/favicon.webp';
    document.head.appendChild(favicon);
  }

  // 判断是否是主页
  const isHome = window.location.pathname === '/index.html' || window.location.pathname === '/';

  // 判断是否是 404 页面
  const is404 = document.title.includes('404');

  // 只在非主页页面显示"返回首页"按钮（404 页面也不属于主页，自然也会显示）
  if (!isHome) {
    // 创建返回按钮
    const backButton = document.createElement('a');
    backButton.href = 'index.html';
    backButton.textContent = '返回首页';
    backButton.className = 'back-to-home';

    // 默认半透明、紧凑贴边，悬停时变清晰——降低对内容的视觉遮挡
    const style = `
        position: fixed;
        top: 16px;
        left: 16px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 14px;
        color: #2c3e50;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: pointer;
        font-family: inherit; /* 统一字体 */
        opacity: 0.35; /* 默认半透明，不抢视觉 */
        -webkit-tap-highlight-color: transparent;
    `;

    backButton.setAttribute('style', style);

    // 悬停/聚焦时变清晰，轻微上浮
    const setActive = () => {
      backButton.style.opacity = '1';
      backButton.style.transform = 'translateY(-2px)';
      backButton.style.background = 'rgba(255, 255, 255, 0.95)';
      backButton.style.boxShadow = '0 10px 26px rgba(0, 0, 0, 0.1)';
      icon.style.opacity = '1';
    };
    const setIdle = () => {
      backButton.style.opacity = '0.35';
      backButton.style.transform = 'translateY(0)';
      backButton.style.background = 'rgba(255, 255, 255, 0.75)';
      backButton.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.06)';
      icon.style.opacity = '0.8';
    };

    backButton.addEventListener('mouseenter', setActive);
    backButton.addEventListener('mouseleave', setIdle);
    backButton.addEventListener('touchstart', setActive, { passive: true });
    backButton.addEventListener('touchend', setIdle);
    backButton.addEventListener('focus', setActive);
    backButton.addEventListener('blur', setIdle);

    // 点击反馈：轻微压下
    backButton.addEventListener('mousedown', () => {
      backButton.style.transform = 'translateY(1px)';
      backButton.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.05)';
    });

    backButton.addEventListener('mouseup', () => {
      backButton.style.transform = 'translateY(-2px)';
      backButton.style.boxShadow = '0 10px 26px rgba(0, 0, 0, 0.1)';
    });

    // 添加图标（Unicode 箭头 + 平滑过渡）
    const icon = document.createElement('span');
    icon.innerHTML = '←';
    icon.style.fontSize = '16px';
    icon.style.opacity = '0.8';
    icon.style.transition = 'opacity 0.2s';
    backButton.prepend(icon);

    // 插入页面顶部
    document.body.insertBefore(backButton, document.body.firstChild);
  }

  // ==================== 底部联系方式栏（主页和子页面都显示）====================

  const contactBar = document.createElement('div');
  contactBar.className = 'contact-bar';

  contactBar.innerHTML = `
        <a href="https://space.bilibili.com/497200545" target="_blank" style="
            display: block;
            padding: 16px 24px;
            width: 70%;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 0 0 16px 16px;
            color: #2c3e50;
            font-size: 14px;
            font-weight: 500;
            text-align: center;
            text-decoration: none;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05);
            font-family: inherit;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.5);
            letter-spacing: 0.3px;
        ">
            联系我：Bilibili@不死の祥云
        </a>
    `;

  // 设置联系栏样式，使其不受父容器 flex 布局影响
  contactBar.style.width = '100%';
  contactBar.style.position = 'relative';
  contactBar.style.flexShrink = '0';
  contactBar.style.marginTop = 'auto'; // 自动推到底部

  // 让联系栏在正常文档流中，底部留出空间，不遮挡内容
  contactBar.style.marginTop = '24px'; // 视觉留白，与顶部按钮对称

  // 悬停增强效果
  const contactLink = contactBar.querySelector('a');
  contactLink.addEventListener('mouseenter', () => {
    contactLink.style.transform = 'translateY(-2px)';
    contactLink.style.background = 'rgba(255, 255, 255, 0.93)';
    contactLink.style.boxShadow = '0 -8px 24px rgba(0, 0, 0, 0.05)';
  });

  contactLink.addEventListener('mouseleave', () => {
    contactLink.style.transform = 'translateY(0)';
    contactLink.style.background = 'rgba(255, 255, 255, 0.85)';
    contactLink.style.boxShadow = '0 -6px 20px rgba(0, 0, 0, 0.03)';
  });

  // 直接添加到 body
  document.body.appendChild(contactBar);
  const bodyStyle = window.getComputedStyle(document.body);
  if (bodyStyle.display === 'flex') {
    if (bodyStyle.flexDirection !== 'column') {
      document.body.style.flexDirection = 'column';
    }
    if (bodyStyle.minHeight === 'auto') {
      document.body.style.minHeight = '100vh';
    }
  }
  console.log('联系栏已直接添加到 body');

  // 页面加载完成后，动态修正高度（应对字体渲染延迟）
  const adjustPadding = () => {
    const height = contactBar.offsetHeight || 60;
    document.body.style.paddingBottom = height + 24 + 'px';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', adjustPadding);
  } else {
    adjustPadding();
  }

  // 监听窗口大小变化，重新计算 padding
  window.addEventListener('resize', adjustPadding);

  // 使用 MutationObserver 监听联系栏内容变化（如字体加载导致高度变化）
  if (window.MutationObserver) {
    const observer = new MutationObserver(adjustPadding);
    observer.observe(contactBar, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });
  }

})();