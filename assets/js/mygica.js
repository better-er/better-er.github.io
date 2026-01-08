const imageMap = {
    MyGO: [
        'MyGICA-fast/MyGO/mygo_changes_01.jpg',
        'MyGICA-fast/MyGO/mygo_changes_02.jpg',
        'MyGICA-fast/MyGO/mygo_changes_03.jpg',
        'MyGICA-fast/MyGO/mygo_changes_04.jpg',
        'MyGICA-fast/MyGO/mygo_changes_05.jpg',
        'MyGICA-fast/MyGO/mygo_changes_06.jpg',
        'MyGICA-fast/MyGO/mygo_changes_07.jpg',
        'MyGICA-fast/MyGO/mygo_changes_08.jpg',
        'MyGICA-fast/MyGO/mygo_changes_09.jpg',
        'MyGICA-fast/MyGO/mygo_changes_10.jpg',
        'MyGICA-fast/MyGO/mygo_changes_11.jpg',
        'MyGICA-fast/MyGO/mygo_changes_12.jpg',
        'MyGICA-fast/MyGO/mygo_changes_13.jpg',
    ],
    Mujica: [
        'MyGICA-fast/Mujica/mujica_changes_01.jpg',
        'MyGICA-fast/Mujica/mujica_changes_02.jpg',
        'MyGICA-fast/Mujica/mujica_changes_03.jpg',
        'MyGICA-fast/Mujica/mujica_changes_04.jpg',
        'MyGICA-fast/Mujica/mujica_changes_05.jpg',
        'MyGICA-fast/Mujica/mujica_changes_06.jpg',
        'MyGICA-fast/Mujica/mujica_changes_07.jpg',
        'MyGICA-fast/Mujica/mujica_changes_08.jpg',
        'MyGICA-fast/Mujica/mujica_changes_09.jpg',
        'MyGICA-fast/Mujica/mujica_changes_10.jpg',
        'MyGICA-fast/Mujica/mujica_changes_11.jpg',
        'MyGICA-fast/Mujica/mujica_changes_12.jpg',
        'MyGICA-fast/Mujica/mujica_changes_13.jpg',
    ],
    LycoReco: [
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_01.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_02.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_03.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_04.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_05.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_06.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_07.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_08.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_09.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_10.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_11.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_12.jpg',
        'MyGICA-fast/LycoReco/Lycoris Recoil_changes_13.jpg',
    ]
};

const folderSelect = document.getElementById('folderSelect');
const modeSelect = document.getElementById('modeSelect');
const gallery = document.getElementById('gallery');
const imgModal = document.getElementById('imgModal');
const modalImg = document.getElementById('modalImg');
const modalClose = document.getElementById('modalClose');

function renderGallery() {
    const folder = folderSelect.value;
    const mode = modeSelect.value;
    const images = imageMap[folder] || [];

    gallery.innerHTML = '';
    gallery.classList.toggle('single-col', mode === 'all');

    if (mode === 'all') {
        gallery.style.width = '100vw';
        gallery.style.marginLeft = 'calc(-1 * ((100vw - 100%) / 2))';
        gallery.style.marginRight = '0';

        images.forEach((src, idx) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const num = document.createElement('div');
            num.className = 'img-number';
            num.textContent = (idx + 1).toString();
            item.appendChild(num);

            const img = document.createElement('img');
            img.src = src;
            img.alt = src.split('/').pop();
            item.appendChild(img);
            gallery.appendChild(item);
        });
    } else {
        gallery.style.width = '';
        gallery.style.marginLeft = '';
        gallery.style.marginRight = '';

        images.forEach(src => {
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const img = document.createElement('img');
            img.alt = src.split('/').pop();
            img.setAttribute('data-src', src);
            img.src = '';
            img.style.filter = 'blur(8px)';
            img.style.background = '#f5f5f5';
            img.style.transition = 'all 0.4s ease';

            const tip = document.createElement('div');
            tip.className = 'thumb-tip';
            tip.textContent = '点击加载图片';
            item.style.position = 'relative';
            item.appendChild(img);
            item.appendChild(tip);

            let loaded = false;
            item.onclick = () => {
                if (!loaded) {
                    img.src = src;
                    img.onload = () => {
                        img.style.filter = 'none';
                        img.style.background = 'transparent';
                        tip.style.opacity = '0';
                        setTimeout(() => tip.remove(), 300);
                        loaded = true;
                    };
                } else {
                    modalImg.src = src;
                    imgModal.classList.add('active');
                }
            };

            gallery.appendChild(item);
        });
    }
}

folderSelect.onchange = renderGallery;
modeSelect.onchange = renderGallery;

modalClose.onclick = () => {
    imgModal.classList.remove('active');
    modalImg.src = '';
};

imgModal.onclick = (e) => {
    if (e.target === imgModal) {
        imgModal.classList.remove('active');
        modalImg.src = '';
    }
};

renderGallery();
