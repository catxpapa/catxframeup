// ===== 全局状态管理 =====
class EditorState {
    constructor() {
        this.data = {
            image: {
                element: null,
                originalWidth: 0,
                originalHeight: 0,
                minDimension: 0
            },
            border: {
                id: null,
                settings: null,
                image: null,
                widthRatio: 0.1,
                isActive: false
            },
            decorations: [],
            selectedDecorationId: null,
            currentMode: 'image'
        };
        
        this.listeners = [];
    }
    
    updateState(updates) {
        this.data = { ...this.data, ...updates };
        this.notifyListeners();
    }
    
    updateImage(element, width, height) {
        this.data.image = {
            element,
            originalWidth: width,
            originalHeight: height,
            minDimension: Math.min(width, height)
        };
        this.notifyListeners();
    }
    
    updateBorder(id, settings, image, widthRatio = null) {
        this.data.border = {
            id,
            settings,
            image,
            widthRatio: widthRatio !== null ? widthRatio : this.data.border.widthRatio,
            isActive: id !== null
        };
        this.notifyListeners();
    }
    
    addDecoration(decorationData) {
        const decoration = {
            id: Date.now() + Math.random(),
            decorationId: decorationData.decorationId,
            image: decorationData.image,
            x: 0.5,
            y: 0.5,
            scale: decorationData.defaultScale || 0.1,
            rotation: 0,
            originalSize: decorationData.originalSize
        };
        
        this.data.decorations.push(decoration);
        this.data.selectedDecorationId = decoration.id;
        this.notifyListeners();
        return decoration;
    }
    
    updateDecoration(id, updates) {
        const index = this.data.decorations.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.decorations[index] = { ...this.data.decorations[index], ...updates };
            this.notifyListeners();
        }
    }
    
    removeDecoration(id) {
        this.data.decorations = this.data.decorations.filter(d => d.id !== id);
        if (this.data.selectedDecorationId === id) {
            this.data.selectedDecorationId = null;
        }
        this.notifyListeners();
    }
    
    selectDecoration(id) {
        this.data.selectedDecorationId = id;
        this.notifyListeners();
    }
    
    setMode(mode) {
        this.data.currentMode = mode;
        this.notifyListeners();
    }
    
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.data));
    }
    
    getState() {
        return this.data;
    }
}

// ===== 工具函数 =====
class Utils {
    static parseCssValue(value) {
        if (typeof value === 'string') {
            return value.split(' ').map(v => parseFloat(v.trim()));
        }
        return Array.isArray(value) ? value : [value];
    }
    
    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
    
    static async loadJson(url) {
        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('加载配置失败:', error);
            return null;
        }
    }
    
    static calculatePixelValue(ratio, minDimension) {
        return ratio * minDimension;
    }
    
    static getCanvasPosition(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    static distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
    
    static angle(center, point) {
        return Math.atan2(point.y - center.y, point.x - center.x);
    }
}

// ===== Canvas编辑器核心类 =====
class CanvasEditor {
    constructor() {
        this.container = document.getElementById('canvas-editor-container');
        this.mainCanvas = document.getElementById('main-canvas');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.controls = document.getElementById('canvas-controls');
        
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.interaction = {
            isDragging: false,
            isResizing: false,
            isRotating: false,
            startPos: { x: 0, y: 0 },
            startDecoration: null,
            resizeHandle: null
        };
        
        this.borderSettings = {};
        this.decorationSettings = {};
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        editorState.addListener(this.onStateChange.bind(this));
    }
    
    setupEventListeners() {
        // Canvas交互事件
        this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
        this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: true });
        
        // 触摸事件
        this.overlayCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        
        // 窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this), { passive: true });
        
        // 控制手柄事件
        this.setupControlHandles();
    }
    
    setupControlHandles() {
        const handles = this.controls.querySelectorAll('.control-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', this.handleControlMouseDown.bind(this), { passive: false });
        });
    }
    
    onStateChange(state) {
        if (state.image.element) {
            this.resizeCanvas();
            this.render();
            this.updateControlsVisibility();
        }
    }
    
    resizeCanvas() {
        const state = editorState.getState();
        const { image } = state;
        
        if (!image.element) return;
        
        const containerRect = this.container.getBoundingClientRect();
        const maxWidth = containerRect.width * 0.9;
        const maxHeight = containerRect.height * 0.9;
        
        // 计算显示尺寸
        const scale = Math.min(
            maxWidth / image.originalWidth,
            maxHeight / image.originalHeight
        );
        
        const displayWidth = image.originalWidth * scale;
        const displayHeight = image.originalHeight * scale;
        
        // 设置Canvas实际尺寸（用于绘制）
        this.mainCanvas.width = image.originalWidth;
        this.mainCanvas.height = image.originalHeight;
        this.overlayCanvas.width = image.originalWidth;
        this.overlayCanvas.height = image.originalHeight;
        
        // 设置Canvas显示尺寸
        this.mainCanvas.style.width = `${displayWidth}px`;
        this.mainCanvas.style.height = `${displayHeight}px`;
        this.overlayCanvas.style.width = `${displayWidth}px`;
        this.overlayCanvas.style.height = `${displayHeight}px`;
        
        // 更新控制器位置
        this.updateControlsPosition();
    }
    
    updateControlsPosition() {
        const state = editorState.getState();
        if (!state.selectedDecorationId) return;
        
        const decoration = state.decorations.find(d => d.id === state.selectedDecorationId);
        if (!decoration) return;
        
        const rect = this.overlayCanvas.getBoundingClientRect();
        const size = decoration.originalSize * decoration.scale;
        const centerX = decoration.x * rect.width;
        const centerY = decoration.y * rect.height;
        
        this.controls.style.left = `${centerX - size/2}px`;
        this.controls.style.top = `${centerY - size/2}px`;
        this.controls.style.width = `${size}px`;
        this.controls.style.height = `${size}px`;
        this.controls.style.transform = `rotate(${decoration.rotation}deg)`;
    }
    
    updateControlsVisibility() {
        const state = editorState.getState();
        const isDecorationMode = state.currentMode === 'decoration';
        const hasSelectedDecoration = state.selectedDecorationId !== null;
        
        if (isDecorationMode && hasSelectedDecoration) {
            this.controls.classList.add('visible');
            this.updateControlsPosition();
        } else {
            this.controls.classList.remove('visible');
        }
    }
    
    render() {
        this.clearCanvas();
        this.renderImage();
        this.renderBorder();
        this.renderDecorations();
        this.renderOverlay();
    }
    
    clearCanvas() {
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
    
    renderImage() {
        const state = editorState.getState();
        const { image, border } = state;
        
        if (!image.element) return;
        
        // 计算图片绘制区域（考虑边框外扩）
        let padding = { top: 0, right: 0, bottom: 0, left: 0 };
        
        if (border.isActive && border.settings) {
            const minDim = Math.min(this.mainCanvas.width, this.mainCanvas.height);
            const borderWidth = minDim * border.widthRatio;
            
            const baseWidths = Utils.parseCssValue(border.settings.width || '40');
            const baseOutsets = Utils.parseCssValue(border.settings.outset || '0');
            const maxBaseWidth = Math.max(...baseWidths, 1);
            
            const finalWidths = baseWidths.map(bw => borderWidth * (bw / maxBaseWidth));
            const finalOutsets = baseOutsets.map((bo, i) => finalWidths[i] * (baseWidths[i] > 0 ? bo / baseWidths[i] : 0));
            const finalPaddings = finalWidths.map((fw, i) => fw - finalOutsets[i]);
            
            padding = {
                top: Math.max(finalPaddings[0] || 0, 0),
                right: Math.max(finalPaddings[1] || finalPaddings[0] || 0, 0),
                bottom: Math.max(finalPaddings[2] || finalPaddings[0] || 0, 0),
                left: Math.max(finalPaddings[3] || finalPaddings[1] || finalPaddings[0] || 0, 0)
            };
        }
        
        // 绘制图片
        this.mainCtx.drawImage(
            image.element,
            padding.left,
            padding.top,
            this.mainCanvas.width - padding.left - padding.right,
            this.mainCanvas.height - padding.top - padding.bottom
        );
    }
    
    renderBorder() {
        const state = editorState.getState();
        const { border } = state;
        
        if (!border.isActive || !border.image || !border.settings) return;
        
        this.drawBorderImage(
            this.mainCtx,
            border.image,
            border.settings,
            this.mainCanvas.width,
            this.mainCanvas.height,
            border.widthRatio
        );
    }
    
    drawBorderImage(ctx, borderImage, settings, canvasWidth, canvasHeight, widthRatio) {
        const baseWidths = Utils.parseCssValue(settings.width || '40');
        const maxBaseWidth = Math.max(...baseWidths, 1);
        const minDim = Math.min(canvasWidth, canvasHeight);
        const borderWidth = minDim * widthRatio;
        
        const finalWidths = baseWidths.map(bw => borderWidth * (bw / maxBaseWidth));
        const [wTop, wRight, wBottom, wLeft] = [
            finalWidths[0] || 0,
            finalWidths[1] || finalWidths[0] || 0,
            finalWidths[2] || finalWidths[0] || 0,
            finalWidths[3] || finalWidths[1] || finalWidths[0] || 0
        ];
        
        const slices = Utils.parseCssValue(settings.slice || '40');
        const [sTop, sRight, sBottom, sLeft] = [
            slices[0] || 0,
            slices[1] || slices[0] || 0,
            slices[2] || slices[0] || 0,
            slices[3] || slices[1] || slices[0] || 0
        ];
        
        // 绘制九宫格边框
        this.drawNinePatchBorder(ctx, borderImage, {
            slices: { top: sTop, right: sRight, bottom: sBottom, left: sLeft },
            widths: { top: wTop, right: wRight, bottom: wBottom, left: wLeft },
            canvasWidth,
            canvasHeight
        });
    }
    
    drawNinePatchBorder(ctx, borderImage, config) {
        const { slices, widths, canvasWidth, canvasHeight } = config;
        const { top: sTop, right: sRight, bottom: sBottom, left: sLeft } = slices;
        const { top: wTop, right: wRight, bottom: wBottom, left: wLeft } = widths;
        
        const imgWidth = borderImage.width;
        const imgHeight = borderImage.height;
        
        // 九个区域的绘制
        const regions = [
            // 四个角
            { sx: 0, sy: 0, sw: sLeft, sh: sTop, dx: 0, dy: 0, dw: wLeft, dh: wTop },
            { sx: imgWidth - sRight, sy: 0, sw: sRight, sh: sTop, dx: canvasWidth - wRight, dy: 0, dw: wRight, dh: wTop },
            { sx: 0, sy: imgHeight - sBottom, sw: sLeft, sh: sBottom, dx: 0, dy: canvasHeight - wBottom, dw: wLeft, dh: wBottom },
            { sx: imgWidth - sRight, sy: imgHeight - sBottom, sw: sRight, sh: sBottom, dx: canvasWidth - wRight, dy: canvasHeight - wBottom, dw: wRight, dh: wBottom },
            
            // 四条边
            { sx: sLeft, sy: 0, sw: imgWidth - sLeft - sRight, sh: sTop, dx: wLeft, dy: 0, dw: canvasWidth - wLeft - wRight, dh: wTop },
            { sx: sLeft, sy: imgHeight - sBottom, sw: imgWidth - sLeft - sRight, sh: sBottom, dx: wLeft, dy: canvasHeight - wBottom, dw: canvasWidth - wLeft - wRight, dh: wBottom },
            { sx: 0, sy: sTop, sw: sLeft, sh: imgHeight - sTop - sBottom, dx: 0, dy: wTop, dw: wLeft, dh: canvasHeight - wTop - wBottom },
            { sx: imgWidth - sRight, sy: sTop, sw: sRight, sh: imgHeight - sTop - sBottom, dx: canvasWidth - wRight, dy: wTop, dw: wRight, dh: canvasHeight - wTop - wBottom }
        ];
        
        regions.forEach(region => {
            if (region.sw > 0 && region.sh > 0 && region.dw > 0 && region.dh > 0) {
                ctx.drawImage(
                    borderImage,
                    region.sx, region.sy, region.sw, region.sh,
                    region.dx, region.dy, region.dw, region.dh
                );
            }
        });
    }
    
    renderDecorations() {
        const state = editorState.getState();
        state.decorations.forEach(decoration => {
            this.renderDecoration(decoration);
        });
    }
    
    renderDecoration(decoration) {
        if (!decoration.image) return;
        
        const { x, y, scale, rotation } = decoration;
        const size = decoration.originalSize * scale;
        
        this.mainCtx.save();
        
        // 移动到装饰中心
        this.mainCtx.translate(x * this.mainCanvas.width, y * this.mainCanvas.height);
        
        // 应用旋转
        this.mainCtx.rotate((rotation * Math.PI) / 180);
        
        // 绘制装饰
        this.mainCtx.drawImage(
            decoration.image,
            -size / 2,
            -size / 2,
            size,
            size
        );
        
        this.mainCtx.restore();
    }
    
    renderOverlay() {
        const state = editorState.getState();
        if (state.currentMode !== 'decoration' || !state.selectedDecorationId) return;
        
        const decoration = state.decorations.find(d => d.id === state.selectedDecorationId);
        if (!decoration) return;
        
        this.drawDecorationOutline(decoration);
    }
    
    drawDecorationOutline(decoration) {
        const { x, y, scale, rotation } = decoration;
        const size = decoration.originalSize * scale;
        const centerX = x * this.overlayCanvas.width;
        const centerY = y * this.overlayCanvas.height;
        
        this.overlayCtx.save();
        this.overlayCtx.translate(centerX, centerY);
        this.overlayCtx.rotate((rotation * Math.PI) / 180);
        
        // 绘制选中框
        this.overlayCtx.strokeStyle = '#00aabb';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.strokeRect(-size/2, -size/2, size, size);
        
        this.overlayCtx.restore();
    }
    
    // 交互事件处理
    handleMouseDown(e) {
        e.preventDefault();
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        this.startInteraction(pos);
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        this.startInteraction(pos);
    }
    
    startInteraction(pos) {
        const state = editorState.getState();
        
        if (state.currentMode === 'decoration') {
            const hitDecoration = this.hitTestDecorations(pos);
            
            if (hitDecoration) {
                editorState.selectDecoration(hitDecoration.id);
                this.interaction.isDragging = true;
                this.interaction.startPos = pos;
                this.interaction.startDecoration = { ...hitDecoration };
            } else {
                editorState.selectDecoration(null);
            }
        }
    }
    
    handleMouseMove(e) {
        if (!this.interaction.isDragging) return;
        
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        this.updateDrag(pos);
    }
    
    handleTouchMove(e) {
        if (!this.interaction.isDragging) return;
        
        e.preventDefault();
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        this.updateDrag(pos);
    }
    
    updateDrag(pos) {
        const state = editorState.getState();
        if (!state.selectedDecorationId) return;
        
        const deltaX = pos.x - this.interaction.startPos.x;
        const deltaY = pos.y - this.interaction.startPos.y;
        
        const newX = this.interaction.startDecoration.x + deltaX / this.overlayCanvas.width;
        const newY = this.interaction.startDecoration.y + deltaY / this.overlayCanvas.height;
        
        editorState.updateDecoration(state.selectedDecorationId, {
            x: Math.max(0, Math.min(1, newX)),
            y: Math.max(0, Math.min(1, newY))
        });
    }
    
    handleMouseUp(e) {
        this.endInteraction();
    }
    
    handleTouchEnd(e) {
        this.endInteraction();
    }
    
    endInteraction() {
        this.interaction.isDragging = false;
        this.interaction.isResizing = false;
        this.interaction.isRotating = false;
        this.interaction.startDecoration = null;
    }
    
    handleControlMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const handle = e.target;
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        
        if (handle.classList.contains('rotate-handle')) {
            this.interaction.isRotating = true;
        } else {
            this.interaction.isResizing = true;
            this.interaction.resizeHandle = handle.className;
        }
        
        this.interaction.startPos = pos;
        
        const state = editorState.getState();
        const decoration = state.decorations.find(d => d.id === state.selectedDecorationId);
        this.interaction.startDecoration = { ...decoration };
    }
    
    hitTestDecorations(pos) {
        const state = editorState.getState();
        
        // 从后往前检测（后添加的在上层）
        for (let i = state.decorations.length - 1; i >= 0; i--) {
            const decoration = state.decorations[i];
            if (this.isPointInDecoration(pos, decoration)) {
                return decoration;
            }
        }
        
        return null;
    }
    
    isPointInDecoration(pos, decoration) {
        const { x, y, scale, rotation } = decoration;
        const size = decoration.originalSize * scale;
        const centerX = x * this.overlayCanvas.width;
        const centerY = y * this.overlayCanvas.height;
        
        // 考虑旋转的碰撞检测
        const cos = Math.cos(-rotation * Math.PI / 180);
        const sin = Math.sin(-rotation * Math.PI / 180);
        
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;
        
        return Math.abs(rotatedX) <= size/2 && Math.abs(rotatedY) <= size/2;
    }
    
    handleResize() {
        this.resizeCanvas();
        this.render();
    }
    
    // 加载图片
    async loadImage(src) {
        try {
            const img = await Utils.loadImage(src);
            editorState.updateImage(img, img.naturalWidth, img.naturalHeight);
            
            // 显示Canvas编辑器
            document.getElementById('upload-placeholder').style.display = 'none';
            this.container.style.display = 'block';
            
            return img;
        } catch (error) {
            console.error('加载图片失败:', error);
            throw error;
        }
    }
    
    // 设置边框
    async setBorder(borderId, widthRatio = null) {
        try {
            const settings = await this.loadBorderSettings(borderId);
            const borderImage = await Utils.loadImage(`assets/frames/${borderId}/frame.png`);
            
            editorState.updateBorder(borderId, settings, borderImage, widthRatio);
        } catch (error) {
            console.error('设置边框失败:', error);
        }
    }
    
    async loadBorderSettings(borderId) {
        if (this.borderSettings[borderId]) {
            return this.borderSettings[borderId];
        }
        
        const settings = await Utils.loadJson(`assets/frames/${borderId}/setting.json`);
        this.borderSettings[borderId] = settings;
        return settings;
    }
    
    // 添加装饰
    async addDecoration(decorationId) {
        try {
            const settings = await this.loadDecorationSettings(decorationId);
            const decorationImage = await Utils.loadImage(`assets/decos/${decorationId}/deco.png`);
            
            const state = editorState.getState();
            const minDim = Math.min(this.mainCanvas.width, this.mainCanvas.height);
            const originalSize = minDim * (settings.defaultScale || 0.1);
            
            const decoration = editorState.addDecoration({
                decorationId,
                image: decorationImage,
                defaultScale: settings.defaultScale || 0.1,
                originalSize
            });
            
            return decoration;
        } catch (error) {
            console.error('添加装饰失败:', error);
        }
    }
    
    async loadDecorationSettings(decorationId) {
        if (this.decorationSettings[decorationId]) {
            return this.decorationSettings[decorationId];
        }
        
        const settings = await Utils.loadJson(`assets/decos/${decorationId}/setting.json`);
        this.decorationSettings[decorationId] = settings || { defaultScale: 0.1 };
        return this.decorationSettings[decorationId];
    }
    
    // 导出Canvas
    exportCanvas() {
        return this.mainCanvas.toDataURL('image/png');
    }
    
    async copyToClipboard() {
        return new Promise((resolve, reject) => {
            this.mainCanvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 'image/png');
        });
    }
}

// ===== 应用管理器 =====
class AppManager {
    constructor() {
        this.canvasEditor = new CanvasEditor();
        this.setupEventListeners();
        this.setupStateListeners();
    }
    
    setupEventListeners() {
        // 导航按钮
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // 上传按钮
        const uploadButton = document.querySelector('.upload-button:not(.online-upload)');
        if (uploadButton) {
            uploadButton.addEventListener('click', () => this.openFileDialog());
        }
        
        // 拖拽上传
        const placeholder = document.getElementById('upload-placeholder');
        if (placeholder) {
            placeholder.addEventListener('dragover', this.handleDragOver.bind(this));
            placeholder.addEventListener('drop', this.handleDrop.bind(this));
            placeholder.addEventListener('dragleave', this.handleDragLeave.bind(this));
        }
        
        // 素材点击事件
        this.setupAssetEvents();
        
        // 控制器事件
        this.setupControlEvents();
    }
    
    setupAssetEvents() {
        // 图片素材
        const imageAssets = document.querySelectorAll('.image-asset-item');
        imageAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const imageSrc = asset.dataset.imageSrc;
                this.canvasEditor.loadImage(imageSrc);
            });
        });
        
        // 边框素材
        const frameAssets = document.querySelectorAll('.frame-asset-item');
        frameAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const borderId = asset.dataset.borderId;
                this.canvasEditor.setBorder(borderId);
                
                // 更新选中状态
                frameAssets.forEach(a => a.classList.remove('active-asset'));
                asset.classList.add('active-asset');
            });
        });
        
        // 装饰素材
        const decorationAssets = document.querySelectorAll('.decoration-asset-item');
        decorationAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const decorationId = asset.dataset.decorationId;
                this.canvasEditor.addDecoration(decorationId);
            });
        });
    }
    
    setupControlEvents() {
        // 边框宽度滑动条
        const borderWidthSlider = document.getElementById('border-width-slider');
        const borderWidthLabel = document.getElementById('border-width-label');
        
        if (borderWidthSlider) {
            borderWidthSlider.addEventListener('input', () => {
                const ratio = parseFloat(borderWidthSlider.value) / 100;
                const state = editorState.getState();
                
                if (state.border.isActive) {
                    editorState.updateBorder(
                        state.border.id,
                        state.border.settings,
                        state.border.image,
                        ratio
                    );
                }
                
                if (borderWidthLabel) {
                    borderWidthLabel.textContent = `${borderWidthSlider.value}%`;
                }
            });
        }
        
        // 装饰缩放滑动条
        const decorationScaleSlider = document.getElementById('decoration-scale-slider');
        const decorationScaleLabel = document.getElementById('decoration-scale-label');
        
        if (decorationScaleSlider) {
            decorationScaleSlider.addEventListener('input', () => {
                const scale = parseFloat(decorationScaleSlider.value);
                const state = editorState.getState();
                
                if (state.selectedDecorationId) {
                    editorState.updateDecoration(state.selectedDecorationId, { scale });
                }
                
                if (decorationScaleLabel) {
                    decorationScaleLabel.textContent = `${Math.round(scale * 100)}%`;
                }
            });
        }
        
        // 装饰旋转滑动条
        const decorationRotationSlider = document.getElementById('decoration-rotation-slider');
        const decorationRotationLabel = document.getElementById('decoration-rotation-label');
        
        if (decorationRotationSlider) {
            decorationRotationSlider.addEventListener('input', () => {
                const rotation = parseFloat(decorationRotationSlider.value);
                const state = editorState.getState();
                
                if (state.selectedDecorationId) {
                    editorState.updateDecoration(state.selectedDecorationId, { rotation });
                }
                
                if (decorationRotationLabel) {
                    decorationRotationLabel.textContent = `${rotation}°`;
                }
            });
        }
        
        // 删除装饰按钮
        const deleteBtn = document.getElementById('delete-decoration-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const state = editorState.getState();
                if (state.selectedDecorationId) {
                    editorState.removeDecoration(state.selectedDecorationId);
                }
            });
        }
        
        // 复制到剪贴板按钮
        const copyBtn = document.getElementById('copy-to-clipboard-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await this.canvasEditor.copyToClipboard();
                    alert('已成功复制到剪贴板！');
                } catch (error) {
                    console.error('复制失败:', error);
                    alert('复制失败，请重试。');
                }
            });
        }
    }
    
    setupStateListeners() {
        editorState.addListener(this.onStateChange.bind(this));
    }
    
    onStateChange(state) {
        this.updateControlsVisibility(state);
        this.updateSliderValues(state);
    }
    
    updateControlsVisibility(state) {
        const borderControls = document.getElementById('border-controls');
        const decorationControls = document.getElementById('decoration-controls');
        const saveOptions = document.getElementById('save-options');
        
        // 隐藏所有控件
        [borderControls, decorationControls, saveOptions].forEach(control => {
            if (control) control.classList.remove('visible');
        });
        
        // 根据模式显示对应控件
        switch (state.currentMode) {
            case 'frame':
                if (borderControls && state.border.isActive) {
                    borderControls.classList.add('visible');
                }
                break;
            case 'decoration':
                if (decorationControls && state.selectedDecorationId) {
                    decorationControls.classList.add('visible');
                }
                break;
            case 'save':
                if (saveOptions) {
                    saveOptions.classList.add('visible');
                }
                break;
        }
    }
    
    updateSliderValues(state) {
        // 更新边框宽度滑动条
        const borderWidthSlider = document.getElementById('border-width-slider');
        const borderWidthLabel = document.getElementById('border-width-label');
        
        if (borderWidthSlider && state.border.isActive) {
            const value = Math.round(state.border.widthRatio * 100);
            borderWidthSlider.value = value;
            if (borderWidthLabel) {
                borderWidthLabel.textContent = `${value}%`;
            }
        }
        
        // 更新装饰控制滑动条
        if (state.selectedDecorationId) {
            const decoration = state.decorations.find(d => d.id === state.selectedDecorationId);
            if (decoration) {
                const scaleSlider = document.getElementById('decoration-scale-slider');
                const scaleLabel = document.getElementById('decoration-scale-label');
                const rotationSlider = document.getElementById('decoration-rotation-slider');
                const rotationLabel = document.getElementById('decoration-rotation-label');
                
                if (scaleSlider) {
                    scaleSlider.value = decoration.scale;
                    if (scaleLabel) {
                        scaleLabel.textContent = `${Math.round(decoration.scale * 100)}%`;
                    }
                }
                
                if (rotationSlider) {
                    rotationSlider.value = decoration.rotation;
                    if (rotationLabel) {
                        rotationLabel.textContent = `${decoration.rotation}°`;
                    }
                }
            }
        }
    }
    
    switchMode(mode) {
        // 更新导航按钮状态
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // 更新素材栏显示
        const assetsViews = document.querySelectorAll('.assets-view');
        assetsViews.forEach(view => {
            view.classList.toggle('active', view.id === `assets-${mode}`);
        });
        
        // 更新状态
        editorState.setMode(mode);
    }
    
    openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadImageFile(file);
            }
        };
        input.click();
    }
    
    async loadImageFile(file) {
        try {
            const src = URL.createObjectURL(file);
            await this.canvasEditor.loadImage(src);
        } catch (error) {
            console.error('加载图片失败:', error);
            alert('加载图片失败，请重试。');
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }
    
    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.loadImageFile(files[0]);
        }
    }
}

// ===== 初始化应用 =====
document.addEventListener('DOMContentLoaded', function() {
    // 创建全局状态实例
    window.editorState = new EditorState();
    
    // 创建应用管理器
    window.appManager = new AppManager();
    
    console.log('喵妙框应用已初始化');
});