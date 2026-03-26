// assets/js/back-to-home.js

(function () {
  // 判断是否是主页
  const isHome = window.location.pathname === '/index.html' || window.location.pathname === '/';

  // 只在非主页页面显示"返回首页"按钮
  if (!isHome) {
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