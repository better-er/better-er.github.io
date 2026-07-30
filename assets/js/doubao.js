(function () {
  "use strict";

  // ---- DOM 引用 ----
  const dropZone1 = document.getElementById("dropZone1");
  const dropZone2 = document.getElementById("dropZone2");
  const removeBtn1 = document.getElementById("removeBtn1");
  const removeBtn2 = document.getElementById("removeBtn2");
  const processBtn = document.getElementById("processBtn");
  const clearBtn = document.getElementById("clearBtn");
  const errorMsg = document.getElementById("errorMsg");
  const resultSection = document.getElementById("resultSection");
  const resultCanvas1 = document.getElementById("resultCanvas1");
  const resultCanvas2 = document.getElementById("resultCanvas2");
  const downloadBtns = document.querySelectorAll(".download-btn");

  /** 存储原始图片的 Image 对象 */
  let img1 = null;
  let img2 = null;
  /** 存储原始文件名（不包含扩展名） */
  let fileName1 = "";
  let fileName2 = "";

  /** 从文件名中提取中文字符，无中文则返回空串 */
  function 提取中文(name) {
    const match = name.match(/[\u4e00-\u9fff]+/g);
    return match ? match.join("") : "";
  }

  /** 获取用于下载文件名的前缀：两个文件名的中文部分合并，若无中文则用原文件名 */
  function 获取下载前缀() {
    const a = 提取中文(fileName1);
    const b = 提取中文(fileName2);
    if (a || b) return a + b;
    return fileName1 || "图片";
  }

  // ---- 工具函数 ----
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add("visible");
  }

  function hideError() {
    errorMsg.classList.remove("visible");
  }

  function updateButtons() {
    processBtn.disabled = !(img1 && img2);
  }

  /** 将 File 读为 Image 对象，返回 { img, name } */
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve({ img, name: file.name.replace(/\.[^.]+$/, "") });
        img.onerror = () => reject(new Error("图片解码失败"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
  }

  /** 在拖放区显示缩略图 */
  function setDropZoneImage(zone, imgObj, removeBtn) {
    zone.classList.add("has-image");
    const oldImg = zone.querySelector("img.preview");
    if (oldImg) oldImg.remove();
    const imgEl = document.createElement("img");
    imgEl.className = "preview";
    imgEl.src = imgObj.src;
    zone.appendChild(imgEl);
    const icon = zone.querySelector(".icon");
    const label = zone.querySelector(".label");
    if (icon) icon.style.display = "none";
    if (label) label.style.display = "none";
    removeBtn.style.display = "flex";
  }

  /** 清空拖放区 */
  function clearDropZone(zone, removeBtn) {
    zone.classList.remove("has-image");
    const imgEl = zone.querySelector("img.preview");
    if (imgEl) imgEl.remove();
    const icon = zone.querySelector(".icon");
    const label = zone.querySelector(".label");
    if (icon) icon.style.display = "";
    if (label) label.style.display = "";
    removeBtn.style.display = "none";
  }

  // ---- 拖放 + 点击处理 ----
  function setupDropZone(zone, removeBtn, slot) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/bmp,image/tiff";
    fileInput.style.display = "none";
    zone.appendChild(fileInput);

    zone.addEventListener("click", (e) => {
      if (e.target.closest(".remove-btn")) return;
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const { img, name } = await loadImageFromFile(file);
        if (slot === 1) { img1 = img; fileName1 = name; }
        else { img2 = img; fileName2 = name; }
        setDropZoneImage(zone, img, removeBtn);
        hideError();
        updateButtons();
        resultSection.classList.remove("visible");
      } catch (err) {
        showError(`图片 ${slot} 加载失败：${err.message}`);
      }
      fileInput.value = "";
    });

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const files = e.dataTransfer.files;
      if (!files.length) return;

      // 如果拖入 2 张图，自动分配到两个区域
      if (files.length >= 2) {
        const otherSlot = slot === 1 ? 2 : 1;
        const otherZone = otherSlot === 1 ? dropZone1 : dropZone2;
        const otherRemoveBtn = otherSlot === 1 ? removeBtn1 : removeBtn2;
        try {
          const { img: imgA, name: nameA } = await loadImageFromFile(files[0]);
          const { img: imgB, name: nameB } = await loadImageFromFile(files[1]);
          if (slot === 1) { img1 = imgA; img2 = imgB; fileName1 = nameA; fileName2 = nameB; }
          else { img1 = imgB; img2 = imgA; fileName1 = nameB; fileName2 = nameA; }
          setDropZoneImage(zone, slot === 1 ? img1 : img2, removeBtn);
          setDropZoneImage(otherZone, slot === 1 ? img2 : img1, otherRemoveBtn);
          hideError();
          updateButtons();
          resultSection.classList.remove("visible");
        } catch (err) {
          showError(`图片加载失败：${err.message}`);
        }
        return;
      }

      const file = files[0];
      try {
        const { img, name } = await loadImageFromFile(file);
        if (slot === 1) { img1 = img; fileName1 = name; }
        else { img2 = img; fileName2 = name; }
        setDropZoneImage(zone, img, removeBtn);
        hideError();
        updateButtons();
        resultSection.classList.remove("visible");
      } catch (err) {
        showError(`图片 ${slot} 加载失败：${err.message}`);
      }
    });

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (slot === 1) { img1 = null; fileName1 = ""; }
      else { img2 = null; fileName2 = ""; }
      clearDropZone(zone, removeBtn);
      updateButtons();
      resultSection.classList.remove("visible");
      hideError();
    });
  }

  setupDropZone(dropZone1, removeBtn1, 1);
  setupDropZone(dropZone2, removeBtn2, 2);

  // ---- 清空全部 ----
  clearBtn.addEventListener("click", () => {
    img1 = null;
    img2 = null;
    fileName1 = "";
    fileName2 = "";
    clearDropZone(dropZone1, removeBtn1);
    clearDropZone(dropZone2, removeBtn2);
    updateButtons();
    resultSection.classList.remove("visible");
    hideError();
  });

  // ---- 处理 ----
  processBtn.addEventListener("click", () => {
    hideError();
    if (!img1 || !img2) {
      showError("请先拖入两张图片");
      return;
    }

    const w1 = img1.naturalWidth, h1 = img1.naturalHeight;
    const w2 = img2.naturalWidth, h2 = img2.naturalHeight;

    if (w1 !== w2 || h1 !== h2) {
      showError(`两张图片尺寸不匹配：${w1}×${h1} ≠ ${w2}×${h2}`);
      return;
    }

    const w = w1, h = h1;
    const mid = Math.floor(w / 2);

    const offscreen = document.createElement("canvas");
    const ctx = offscreen.getContext("2d");

    // 结果 1: 图1左 + 图2右
    offscreen.width = w;
    offscreen.height = h;
    ctx.drawImage(img1, 0, 0, mid, h, 0, 0, mid, h);
    ctx.drawImage(img2, mid, 0, w - mid, h, mid, 0, w - mid, h);
    resultCanvas1.width = w;
    resultCanvas1.height = h;
    resultCanvas1.getContext("2d").drawImage(offscreen, 0, 0);

    // 结果 2: 图2左 + 图1右
    offscreen.width = w;
    offscreen.height = h;
    ctx.drawImage(img2, 0, 0, mid, h, 0, 0, mid, h);
    ctx.drawImage(img1, mid, 0, w - mid, h, mid, 0, w - mid, h);
    resultCanvas2.width = w;
    resultCanvas2.height = h;
    resultCanvas2.getContext("2d").drawImage(offscreen, 0, 0);

    resultSection.classList.add("visible");
  });

  // ---- 下载 ----
  downloadBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      const canvas = idx === 1 ? resultCanvas1 : resultCanvas2;
      const prefix = 获取下载前缀();
      const link = document.createElement("a");
      link.download = `${prefix}_交换后${idx}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });
})();
