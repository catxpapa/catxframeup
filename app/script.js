// catxframeup/app/script.js
document.addEventListener('DOMContentLoaded', function() {
    // --- 全局状态 ---
    let currentBorderWidthRatio = 0.1; // 默认边框宽度为图片最小边的10%
    let activeBorderId = null;
    let activeBorderSettings = null;

    // --- DOM 元素获取 ---
    const navButtons = document.querySelectorAll('.nav-button');
    const editorViews = document.querySelectorAll('.editor-view');
    const assetsViews = document.querySelectorAll('.assets-view');
    const uploadPlaceholder = document.querySelector('.placeholder-image');

    const imageWrapper = document.querySelector('#editor-frame .image-display-wrapper');
    const editingImage = imageWrapper ? imageWrapper.querySelector('.editing-image') : null;
    const borderOverlay = imageWrapper ? imageWrapper.querySelector('.border-overlay') : null;
    
    const editorControls = document.querySelector('.editor-controls');
    const borderWidthSlider = document.getElementById('border-width-slider');
    const borderWidthLabel = document.getElementById('border-width-label');

    // --- 模式切换功能 ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;

            // 控制滑块区域的可见性
            if (editorControls) {
                if (mode === 'frame') {
                    editorControls.classList.add('visible');
                } else {
                    editorControls.classList.remove('visible');
                }
            }

            // 当切换到“保存”模式时，生成预览
            if (mode === 'save') {
                const previewContainer = document.getElementById('save-preview-container');
                if (imageWrapper && previewContainer) {
                    previewContainer.innerHTML = ''; // 清空旧预览
                    const previewClone = imageWrapper.cloneNode(true);
                    
                    const originalOverlay = imageWrapper.querySelector('.border-overlay');
                    const cloneOverlay = previewClone.querySelector('.border-overlay');
                    if(originalOverlay && cloneOverlay) {
                        cloneOverlay.style.cssText = originalOverlay.style.cssText;
                    }
                    const originalImg = imageWrapper.querySelector('.editing-image');
                    const cloneImg = previewClone.querySelector('.editing-image');
                     if(originalImg && cloneImg) {
                        cloneImg.style.cssText = originalImg.style.cssText;
                    }
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

    // --- 拖放上传功能 (占位) ---
    window.addEventListener('dragover', e => e.preventDefault(), false);
    window.addEventListener('drop', e => e.preventDefault(), false);
    if (uploadPlaceholder) { 
        // 拖放逻辑可以添加在这里
    }

    // --- 辅助函数 ---
    const parseCssValue = (valueStr) => {
        const values = String(valueStr).trim().split(/\s+/).map(v => parseFloat(v) || 0);
        if (values.length === 1) return [values[0], values[0], values[0], values[0]];
        if (values.length === 2) return [values[0], values[1], values[0], values[1]];
        if (values.length === 3) return [values[0], values[1], values[2], values[1]];
        return values.slice(0, 4);
    };

    /**
     * 应用边框样式到预览区
     */
    async function applyBorderStyles() {
        if (!activeBorderId || !editingImage || !borderOverlay || !editingImage.complete) return;

        try {
            if (!activeBorderSettings) {
                const response = await fetch(`assets/frames/${activeBorderId}/setting.json`);
                if (!response.ok) throw new Error(`无法加载配置`);
                activeBorderSettings = await response.json();
            }
            
            const baseWidths = parseCssValue(activeBorderSettings.width || '40');
            const baseOutsets = parseCssValue(activeBorderSettings.outset || '0');
            const maxBaseWidth = Math.max(...baseWidths, 1); // 使用Math.max确保不为0

            const previewRefDim = Math.min(editingImage.clientWidth, editingImage.clientHeight);
            const baseThicknessPx = previewRefDim * currentBorderWidthRatio;

            const finalWidths = baseWidths.map(bw => baseThicknessPx * (bw / maxBaseWidth));
            const finalOutsets = baseOutsets.map((bo, i) => finalWidths[i] * (baseWidths[i] > 0 ? bo / baseWidths[i] : 0));
            const finalPaddings = finalWidths.map((fw, i) => fw - finalOutsets[i]);

            borderOverlay.style.borderWidth = finalWidths.map(w => `${w}px`).join(' ');
            editingImage.style.padding = finalPaddings.map(p => `${p > 0 ? p : 0}px`).join(' ');
            
            const borderSrc = `assets/frames/${activeBorderId}/${activeBorderSettings.source || 'frame.png'}`;
            borderOverlay.style.borderStyle = 'solid';
            borderOverlay.style.borderImageSource = `url(${borderSrc})`;
            borderOverlay.style.borderImageSlice = activeBorderSettings.slice || '0';
            borderOverlay.style.borderImageRepeat = activeBorderSettings.repeat || 'stretch';

        } catch (error) {
            console.error('应用预览边框失败:', error);
        }
    }

    // --- 事件监听 ---
    document.querySelectorAll('.frame-asset-item').forEach(item => {
        item.addEventListener('click', async () => {
            document.querySelectorAll('.frame-asset-item').forEach(i => i.classList.remove('active-asset'));
            item.classList.add('active-asset');
            activeBorderId = item.dataset.borderId;
            activeBorderSettings = null;
            await applyBorderStyles();
        });
    });

    if (borderWidthSlider) {
        borderWidthSlider.addEventListener('input', () => {
            currentBorderWidthRatio = parseFloat(borderWidthSlider.value) / 100;
            borderWidthLabel.textContent = `${borderWidthSlider.value}%`;
            applyBorderStyles();
        });
    }
    
    if(editingImage) {
        editingImage.onload = () => {
            const firstFrame = document.querySelector('.frame-asset-item');
            if(firstFrame && !activeBorderId) {
                firstFrame.click();
            } else {
                applyBorderStyles();
            }
        };
        if(editingImage.complete) editingImage.onload();
    }
    window.addEventListener('resize', applyBorderStyles);

    // --- 导出功能 ---
    function drawBorderImage(ctx, borderImg, settings, canvasWidth, canvasHeight, targetBorderWidths) {
        const slice = parseCssValue(settings.slice);
        const [dTop, dRight, dBottom, dLeft] = targetBorderWidths;

        const iw = borderImg.width;
        const ih = borderImg.height;

        const [sTop, sRight, sBottom, sLeft] = parseCssValue(settings.slice);

        const sx = [0, sLeft, iw - sRight, iw];
        const sy = [0, sTop, ih - sBottom, ih];
        const dx = [0, dLeft, canvasWidth - dRight, canvasWidth];
        const dy = [0, dTop, canvasHeight - dBottom, canvasHeight];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (row === 1 && col === 1) continue;
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
            if (!editingImage || !activeBorderId || !activeBorderSettings) {
                alert('请先选择一张图片和一个边框样式。');
                return;
            }

            try {
                const mainImage = new Image();
                const borderImage = new Image();
                mainImage.crossOrigin = "Anonymous";
                borderImage.crossOrigin = "Anonymous";

                await Promise.all([
                    new Promise((resolve, reject) => {
                        mainImage.onload = resolve;
                        mainImage.onerror = reject;
                        mainImage.src = editingImage.src;
                    }),
                    new Promise((resolve, reject) => {
                        borderImage.onload = resolve;
                        borderImage.onerror = reject;
                        borderImage.src = `assets/frames/${activeBorderId}/${activeBorderSettings.source || 'frame.png'}`;
                    })
                ]);

                const canvas = document.createElement('canvas');
                canvas.width = mainImage.naturalWidth;
                canvas.height = mainImage.naturalHeight;
                const ctx = canvas.getContext('2d');

                const baseWidths = parseCssValue(activeBorderSettings.width || '40');
                const baseOutsets = parseCssValue(activeBorderSettings.outset || '0');
                const maxBaseWidth = Math.max(...baseWidths, 1);

                const imageRefDim = Math.min(canvas.width, canvas.height);
                const baseThicknessPx = imageRefDim * currentBorderWidthRatio;

                const finalCanvasWidths = baseWidths.map(bw => baseThicknessPx * (bw / maxBaseWidth));
                const finalCanvasOutsets = baseOutsets.map((bo, i) => finalCanvasWidths[i] * (baseWidths[i] > 0 ? bo / baseWidths[i] : 0));
                const finalCanvasPaddings = finalCanvasWidths.map((fw, i) => fw - finalCanvasOutsets[i]);
                
                const [pTop, pRight, pBottom, pLeft] = finalCanvasPaddings.map(p => p > 0 ? p : 0);

                ctx.drawImage(
                    mainImage,
                    pLeft, 
                    pTop,
                    canvas.width - pLeft - pRight,
                    canvas.height - pTop - pBottom
                );

                drawBorderImage(ctx, borderImage, activeBorderSettings, canvas.width, canvas.height, finalCanvasWidths);

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