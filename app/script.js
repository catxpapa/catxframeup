// catxframeup/app/script.js
document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-button');
    const editorViews = document.querySelectorAll('.editor-view');
    const assetsViews = document.querySelectorAll('.assets-view');
    const uploadPlaceholder = document.querySelector('.placeholder-image');

    // --- 模式切换功能 ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;

            if (mode === 'save') {
                const originalWrapper = document.querySelector('#editor-frame .image-display-wrapper');
                const previewContainer = document.getElementById('save-preview-container');
                if (originalWrapper && previewContainer) {
                    previewContainer.innerHTML = '';
                    const previewClone = originalWrapper.cloneNode(true);
                    previewContainer.appendChild(previewClone);
                }
            }

            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            editorViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === `editor-${mode}`) {
                    view.classList.add('active');
                }
            });

            assetsViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === `assets-${mode}`) {
                    view.classList.add('active');
                }
            });
        });
    });

    // --- 拖放上传功能 ---
    window.addEventListener('dragover', e => e.preventDefault(), false);
    window.addEventListener('drop', e => e.preventDefault(), false);
    if (uploadPlaceholder) { /* ... */ }

    // --- 边框切换功能 ---
    const frameAssetItems = document.querySelectorAll('.frame-asset-item');
    const imageWrapper = document.querySelector('.image-display-wrapper');
    const editingImage = imageWrapper ? imageWrapper.querySelector('.editing-image') : null;
    const borderOverlay = imageWrapper ? imageWrapper.querySelector('.border-overlay') : null;

    const parseCssValue = (valueStr) => {
        const values = String(valueStr).trim().split(/\s+/).map(v => parseFloat(v) || 0);
        if (values.length === 1) return [values[0], values[0], values[0], values[0]];
        if (values.length === 2) return [values[0], values[1], values[0], values[1]];
        if (values.length === 3) return [values[0], values[1], values[2], values[1]];
        return values.slice(0, 4);
    };

    frameAssetItems.forEach(item => {
        item.addEventListener('click', async () => {
            if (!editingImage || !borderOverlay) return;
            const borderId = item.dataset.borderId;
            const settingsPath = `assets/frames/${borderId}/setting.json`;
            try {
                const response = await fetch(settingsPath);
                if (!response.ok) throw new Error(`无法加载边框配置: ${settingsPath}`);
                const settings = await response.json();
                frameAssetItems.forEach(i => i.classList.remove('active-asset'));
                item.classList.add('active-asset');
                const borderSrc = `assets/frames/${borderId}/${settings.source || 'frame.png'}`;
                borderOverlay.style.borderStyle = 'solid';
                borderOverlay.style.borderWidth = settings.width || '0px';
                borderOverlay.style.borderImageSource = `url(${borderSrc})`;
                borderOverlay.style.borderImageSlice = settings.slice || '0';
                borderOverlay.style.borderImageRepeat = settings.repeat || 'stretch';
                const borderWidths = parseCssValue(settings.width || '0px');
                const outsets = parseCssValue(settings.outset || '0px');
                const paddings = borderWidths.map((width, i) => {
                    const paddingValue = width - outsets[i];
                    return paddingValue > 0 ? `${paddingValue}px` : '0px';
                });
                editingImage.style.padding = paddings.join(' ');
            } catch (error) {
                console.error('应用边框失败:', error);
            }
        });
    });

    // --- 导出功能 ---

    /**
     * 在Canvas上绘制九宫格边框（不含中心）
     */
    function drawBorderImage(ctx, borderImg, settings, canvasWidth, canvasHeight) {
        const slice = parseCssValue(settings.slice);
        const width = parseCssValue(settings.width);

        const [sTop, sRight, sBottom, sLeft] = slice;
        const [dTop, dRight, dBottom, dLeft] = width;

        const iw = borderImg.width;
        const ih = borderImg.height;

        const sx = [0, sLeft, iw - sRight, iw];
        const sy = [0, sTop, ih - sBottom, ih];
        const dx = [0, dLeft, canvasWidth - dRight, canvasWidth];
        const dy = [0, dTop, canvasHeight - dBottom, canvasHeight];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (row === 1 && col === 1) {
                    continue; // 跳过中心区域
                }
                if (sx[col] >= sx[col + 1] || sy[row] >= sy[row + 1]) continue;
                
                ctx.drawImage(
                    borderImg,
                    sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row],
                    dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]
                );
            }
        }
    }

    const copyBtn = document.getElementById('copy-to-clipboard-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const activeFrame = document.querySelector('.frame-asset-item.active-asset');
            const mainImageEl = document.querySelector('#editor-frame .editing-image');

            if (!mainImageEl || !activeFrame) {
                alert('请先选择一张图片和一个边框样式。');
                return;
            }

            const borderId = activeFrame.dataset.borderId;
            const settingsPath = `assets/frames/${borderId}/setting.json`;

            try {
                const settingsRes = await fetch(settingsPath);
                const settings = await settingsRes.json();

                const mainImage = new Image();
                const borderImage = new Image();
                mainImage.crossOrigin = "Anonymous";
                borderImage.crossOrigin = "Anonymous";

                await Promise.all([
                    new Promise((resolve, reject) => {
                        mainImage.onload = resolve;
                        mainImage.onerror = reject;
                        mainImage.src = mainImageEl.src;
                    }),
                    new Promise((resolve, reject) => {
                        borderImage.onload = resolve;
                        borderImage.onerror = reject;
                        borderImage.src = `assets/frames/${borderId}/${settings.source || 'frame.png'}`;
                    })
                ]);

                const canvas = document.createElement('canvas');
                canvas.width = mainImage.naturalWidth;
                canvas.height = mainImage.naturalHeight;
                const ctx = canvas.getContext('2d');

                // 1. 计算图片需要内缩的距离
                const borderWidths = parseCssValue(settings.width || '0px');
                const outsets = parseCssValue(settings.outset || '0px');
                const paddings = borderWidths.map((w, i) => {
                    const paddingValue = w - outsets[i];
                    return paddingValue > 0 ? paddingValue : 0;
                });
                const [pTop, pRight, pBottom, pLeft] = paddings;

                // 2. 先绘制被“内缩”的主图片
                ctx.drawImage(
                    mainImage,
                    pLeft, 
                    pTop,
                    canvas.width - pLeft - pRight,
                    canvas.height - pTop - pBottom
                );

                // 3. 再将边框作为“画框”绘制在图片上层
                drawBorderImage(ctx, borderImage, settings, canvas.width, canvas.height);

                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        alert('无法生成图片，请重试。');
                        return;
                    }
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        alert('已成功复制到剪贴板！');
                    } catch (err) {
                        console.error('复制到剪贴板失败:', err);
                        alert(`复制失败: ${err.message}。`);
                    }
                }, 'image/png');

            } catch (error) {
                console.error('合成图片失败:', error);
                alert('合成图片时发生错误，请检查控制台。');
            }
        });
    }
});