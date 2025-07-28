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
        
        // 调试功能：记录调用栈信息
        this.debugMode = true; // 正式版本时设置为 false
        this.operationCounter = 0;
    }
    
    updateState(updates) {
        this.data = { ...this.data, ...updates };
        this.notifyListeners('updateState', { updates });
    }
    
    updateImage(element, width, height) {
        this.data.image = {
            element,
            originalWidth: width,
            originalHeight: height,
            minDimension: Math.min(width, height)
        };
        this.notifyListeners('updateImage', { width, height, minDimension: Math.min(width, height) });
    }
    
    updateBorder(id, settings, image, widthRatio = null) {
        this.data.border = {
            id,
            settings,
            image,
            widthRatio: widthRatio !== null ? widthRatio : this.data.border.widthRatio,
            isActive: id !== null
        };
        this.notifyListeners('updateBorder', { id, widthRatio: this.data.border.widthRatio, isActive: id !== null });
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
        this.notifyListeners('addDecoration', { 
            decorationId: decorationData.decorationId, 
            newDecorationId: decoration.id,
            totalDecorations: this.data.decorations.length 
        });
        return decoration;
    }
    
    updateDecoration(id, updates) {
        const index = this.data.decorations.findIndex(d => d.id === id);
        if (index !== -1) {
            this.data.decorations[index] = { ...this.data.decorations[index], ...updates };
            this.notifyListeners('updateDecoration', { id, updates, index });
        }
    }
    
    removeDecoration(id) {
        const beforeCount = this.data.decorations.length;
        this.data.decorations = this.data.decorations.filter(d => d.id !== id);
        const afterCount = this.data.decorations.length;
        
        if (this.data.selectedDecorationId === id) {
            this.data.selectedDecorationId = null;
        }
        this.notifyListeners('removeDecoration', { id, beforeCount, afterCount, wasSelected: this.data.selectedDecorationId === id });
    }
    
    selectDecoration(id) {
        const previousId = this.data.selectedDecorationId;
        this.data.selectedDecorationId = id;
        this.notifyListeners('selectDecoration', { previousId, newId: id });
    }
    
    setMode(mode) {
        const previousMode = this.data.currentMode;
        this.data.currentMode = mode;
        this.notifyListeners('setMode', { previousMode, newMode: mode });
    }
    
    addListener(callback) {
        this.listeners.push(callback);
        if (this.debugMode) {
            console.log(`🔧 [EditorState] 添加监听器，当前监听器数量: ${this.listeners.length}`);
        }
    }
    
    // 增强的 notifyListeners 方法，包含调试功能
    notifyListeners(methodName = 'unknown', parameters = {}) {
        this.operationCounter++;
        
        // 调试输出 - 正式版本时注释掉这整个 if 块
        if (this.debugMode) {
            console.group(`🚀 [EditorState] 操作 #${this.operationCounter}: ${methodName}`);
            console.log('📋 调用方法:', methodName);
            console.log('📊 传入参数:', parameters);
            console.log('🎯 当前状态快照:', {
                imageLoaded: !!this.data.image.element,
                imageSize: this.data.image.element ? `${this.data.image.originalWidth}x${this.data.image.originalHeight}` : 'N/A',
                borderActive: this.data.border.isActive,
                borderId: this.data.border.id,
                borderWidth: `${(this.data.border.widthRatio * 100).toFixed(1)}%`,
                decorationsCount: this.data.decorations.length,
                selectedDecoration: this.data.selectedDecorationId,
                currentMode: this.data.currentMode,
                listenersCount: this.listeners.length
            });
            
            // 显示调用栈（可选，用于深度调试）
            if (methodName !== 'unknown') {
                console.log('📍 调用栈:', new Error().stack.split('\n').slice(2, 5).map(line => line.trim()));
            }
            
            console.log(`⏰ 时间戳: ${new Date().toLocaleTimeString()}`);
        }
        
        // 执行所有监听器回调
        this.listeners.forEach((callback, index) => {
            try {
                callback(this.data);
                if (this.debugMode) {
                    console.log(`✅ 监听器 #${index + 1} 执行成功`);
                }
            } catch (error) {
                console.error(`❌ 监听器 #${index + 1} 执行失败:`, error);
            }
        });
        
        if (this.debugMode) {
            console.groupEnd();
        }
    }
    
    getState() {
        return this.data;
    }
    
    // 调试辅助方法
    enableDebug() {
        this.debugMode = true;
        console.log('🔍 EditorState 调试模式已启用');
    }
    
    disableDebug() {
        this.debugMode = false;
        console.log('🔇 EditorState 调试模式已禁用');
    }
    
    getDebugInfo() {
        return {
            operationCounter: this.operationCounter,
            listenersCount: this.listeners.length,
            debugMode: this.debugMode,
            currentState: this.data
        };
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
        // 获取主编辑区容器
        this.mainEditor = document.querySelector('.main-editor');
        
        // 创建Canvas容器
        this.createCanvasContainer();
        
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.interaction = {
            isDragging: false,
            startPos: { x: 0, y: 0 },
            startDecoration: null
        };
        
        this.borderSettings = {};
        this.decorationSettings = {};
        
        this.init();
    }
    
    createCanvasContainer() {
        // 创建Canvas编辑器容器
        this.container = document.createElement('div');
        this.container.className = 'canvas-editor-container';
        this.container.style.display = 'none'; // 初始隐藏
        
        // 创建主Canvas
        this.mainCanvas = document.createElement('canvas');
        this.mainCanvas.className = 'main-canvas';
        
        // 创建覆盖层Canvas
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.className = 'overlay-canvas';
        
        // 将Canvas添加到容器
        this.container.appendChild(this.mainCanvas);
        this.container.appendChild(this.overlayCanvas);
        
        // 将容器添加到主编辑区
        this.mainEditor.appendChild(this.container);
    }
    
    init() {
        this.setupEventListeners();
        editorState.addListener(this.onStateChange.bind(this));
    }
    
    setupEventListeners() {
        // 使用passive事件监听器避免警告
        this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: true });
        this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: true });
        
        // 触摸事件
        this.overlayCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.overlayCanvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        
        // 窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this), { passive: true });
    }
    
    // 显示Canvas编辑器
    showEditor() {
        // 隐藏上传占位符
        const placeholder = document.getElementById('upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // 显示Canvas容器
        this.container.style.display = 'flex';
        
        // 调整Canvas尺寸
        this.resizeCanvas();
    }
    
    // 隐藏Canvas编辑器
    hideEditor() {
        this.container.style.display = 'none';
        
        // 显示上传占位符
        const placeholder = document.getElementById('upload-placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
    }
    
    // 计算Canvas尺寸和图片布局
    calculateCanvasLayout() {
        const state = editorState.getState();
        const { image, border } = state;
        
        if (!image.element) return null;
        
        let canvasWidth = image.originalWidth;
        let canvasHeight = image.originalHeight;
        
        // 如果图片超过2048x2048，按比例缩小
        const maxSize = 2048;
        if (canvasWidth > maxSize || canvasHeight > maxSize) {
            const scale = Math.min(maxSize / canvasWidth, maxSize / canvasHeight);
            canvasWidth = Math.floor(canvasWidth * scale);
            canvasHeight = Math.floor(canvasHeight * scale);
        }
        
        // 计算边框参数 - 修复outfit计算逻辑，参考原始代码[citation](2)
        let imageRect = {
            x: 0,
            y: 0,
            width: canvasWidth,
            height: canvasHeight
        };
        
        if (border.isActive && border.settings) {
            const minDim = Math.min(canvasWidth, canvasHeight);
            const borderWidth = minDim * border.widthRatio;
            
            // 解析边框配置 - 使用与原始代码相同的逻辑[citation](2)
            const baseWidths = Utils.parseCssValue(border.settings.width || '40');
            const baseOutsets = Utils.parseCssValue(border.settings.outset || '0');
            const maxBaseWidth = Math.max(...baseWidths, 1);
            
            // 计算最终边框宽度
            const finalCanvasWidths = baseWidths.map(bw => borderWidth * (bw / maxBaseWidth));
            
            // 修复outset计算逻辑 - 按照原始代码[citation](2)的计算方式
            const finalCanvasOutsets = baseOutsets.map((bo, i) => 
                finalCanvasWidths[i] * (baseWidths[i] > 0 ? bo / baseWidths[i] : 0)
            );
            
            // 计算padding（边框内侧到图片的距离）- 这里是关键修复
            const finalCanvasPaddings = finalCanvasWidths.map((fw, i) => fw - finalCanvasOutsets[i]);
            
            // 应用CSS顺序：上右下左，确保非负值
            const paddingValues = finalCanvasPaddings.map(p => Math.max(p, 0));
            const [pTop, pRight, pBottom, pLeft] = [
                paddingValues[0] || 0,
                paddingValues[1] || paddingValues[0] || 0,
                paddingValues[2] || paddingValues[0] || 0,
                paddingValues[3] || paddingValues[1] || paddingValues[0] || 0
            ];
            
            // 图片绘制区域（边框内侧 + outset）
            imageRect = {
                x: pLeft,
                y: pTop,
                width: canvasWidth - pLeft - pRight,
                height: canvasHeight - pTop - pBottom
            };
        }
        
        // 计算显示缩放比例（适应屏幕）
        const containerRect = this.container.getBoundingClientRect();
        const maxDisplayWidth = containerRect.width * 0.9;
        const maxDisplayHeight = containerRect.height * 0.9;
        
        const displayScale = Math.min(
            maxDisplayWidth / canvasWidth,
            maxDisplayHeight / canvasHeight,
            1 // 不放大，只缩小
        );
        
        return {
            canvasWidth,
            canvasHeight,
            imageRect,
            displayScale
        };
    }
    
    resizeCanvas() {
        const layout = this.calculateCanvasLayout();
        if (!layout) return;
        
        const { canvasWidth, canvasHeight, displayScale } = layout;
        
        // 设置Canvas实际尺寸
        this.mainCanvas.width = canvasWidth;
        this.mainCanvas.height = canvasHeight;
        this.overlayCanvas.width = canvasWidth;
        this.overlayCanvas.height = canvasHeight;
        
        // 设置Canvas显示尺寸
        const displayWidth = canvasWidth * displayScale;
        const displayHeight = canvasHeight * displayScale;
        
        this.mainCanvas.style.width = `${displayWidth}px`;
        this.mainCanvas.style.height = `${displayHeight}px`;
        this.overlayCanvas.style.width = `${displayWidth}px`;
        this.overlayCanvas.style.height = `${displayHeight}px`;
        
        this.render();
    }
    
    // 主渲染函数
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
    
    // 修复：只在这里绘制图片，不在renderBorder中重复绘制
    renderImage() {
        const layout = this.calculateCanvasLayout();
        const state = editorState.getState();
        
        if (!layout || !state.image.element) return;
        
        const { imageRect } = layout;
        
        // 绘制图片到指定位置（边框内侧 + outset区域）
        this.mainCtx.drawImage(
            state.image.element,
            imageRect.x,
            imageRect.y,
            imageRect.width,
            imageRect.height
        );
    }
    
    // 修复：只绘制边框，不绘制图片
    renderBorder() {
        const state = editorState.getState();
        const { border } = state;
        
        if (!border.isActive || !border.image || !border.settings) return;
        
        const layout = this.calculateCanvasLayout();
        if (!layout) return;
        
        this.drawBorderImage(
            this.mainCtx,
            border.image,
            border.settings,
            layout.canvasWidth,
            layout.canvasHeight,
            border.widthRatio
        );
    }
    
    drawBorderImage(ctx, borderImage, settings, canvasWidth, canvasHeight, widthRatio) {
        const minDim = Math.min(canvasWidth, canvasHeight);
        const borderWidth = minDim * widthRatio;
        
        // 解析边框配置
        const baseWidths = Utils.parseCssValue(settings.width || '40');
        const maxBaseWidth = Math.max(...baseWidths, 1);
        const finalWidths = baseWidths.map(bw => borderWidth * (bw / maxBaseWidth));
        
        // 九宫格切片尺寸
        const [topWidth, rightWidth, bottomWidth, leftWidth] = finalWidths;
        
        // 绘制九宫格边框
        this.drawNinePatchBorder(ctx, borderImage, canvasWidth, canvasHeight, {
            top: topWidth,
            right: rightWidth,
            bottom: bottomWidth,
            left: leftWidth
        }, settings);
    }
    
    // 修复：统一使用宽度值而不是坐标值来定义切片
    drawNinePatchBorder(ctx, borderImage, canvasWidth, canvasHeight, borderWidths, settings) {
        const { top, right, bottom, left } = borderWidths;
        const imgW = borderImage.width;
        const imgH = borderImage.height;
        
        // 修复：从settings.json中获取切片宽度值，而不是坐标值
        let sliceTopWidth, sliceRightWidth, sliceBottomWidth, sliceLeftWidth;
        
        if (settings.slice) {
            // 解析slice配置：上 右 下 左的宽度值（不再是坐标）
            const sliceWidths = Utils.parseCssValue(settings.slice);
            [sliceTopWidth, sliceRightWidth, sliceBottomWidth, sliceLeftWidth] = sliceWidths;
            
            // 调试输出
            if (editorState.debugMode) {
                console.log('🔧 [Border] 切片宽度配置:', {
                    原始配置: settings.slice,
                    解析结果: sliceWidths,
                    边框图片尺寸: `${imgW}x${imgH}`,
                    最终切片宽度: { sliceTopWidth, sliceRightWidth, sliceBottomWidth, sliceLeftWidth }
                });
            }
        } else {
            // 如果没有slice配置，使用默认值（保持向后兼容）
            sliceTopWidth = imgH * 0.25;
            sliceRightWidth = imgW * 0.25;
            sliceBottomWidth = imgH * 0.25;
            sliceLeftWidth = imgW * 0.25;
            
            console.warn('⚠️ [Border] 未找到slice配置，使用默认切片宽度');
        }
        
        // 计算切片位置（从宽度值转换为坐标值）
        const sliceTop = sliceTopWidth;
        const sliceRight = imgW - sliceRightWidth;
        const sliceBottom = imgH - sliceBottomWidth;
        const sliceLeft = sliceLeftWidth;
        
        // 调试输出切片计算结果
        if (editorState.debugMode) {
            console.log('🎯 [Border] 切片坐标计算:', {
                切片位置: { sliceTop, sliceRight, sliceBottom, sliceLeft },
                画布尺寸: `${canvasWidth}x${canvasHeight}`,
                边框宽度: { top, right, bottom, left }
            });
        }
        
        // 绘制四个角
        // 左上角
        ctx.drawImage(borderImage, 0, 0, sliceLeft, sliceTop, 0, 0, left, top);
        // 右上角
        ctx.drawImage(borderImage, sliceRight, 0, imgW - sliceRight, sliceTop, canvasWidth - right, 0, right, top);
        // 左下角
        ctx.drawImage(borderImage, 0, sliceBottom, sliceLeft, imgH - sliceBottom, 0, canvasHeight - bottom, left, bottom);
        // 右下角
        ctx.drawImage(borderImage, sliceRight, sliceBottom, imgW - sliceRight, imgH - sliceBottom, canvasWidth - right, canvasHeight - bottom, right, bottom);
        
        // 绘制四条边
        // 上边
        ctx.drawImage(borderImage, sliceLeft, 0, sliceRight - sliceLeft, sliceTop, left, 0, canvasWidth - left - right, top);
        // 下边
        ctx.drawImage(borderImage, sliceLeft, sliceBottom, sliceRight - sliceLeft, imgH - sliceBottom, left, canvasHeight - bottom, canvasWidth - left - right, bottom);
        // 左边
        ctx.drawImage(borderImage, 0, sliceTop, sliceLeft, sliceBottom - sliceTop, 0, top, left, canvasHeight - top - bottom);
        // 右边
        ctx.drawImage(borderImage, sliceRight, sliceTop, imgW - sliceRight, sliceBottom - sliceTop, canvasWidth - right, top, right, canvasHeight - top - bottom);
    }
    
    renderDecorations() {
        const { decorations } = editorState.getState();
        decorations.forEach(decoration => {
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
        // 清空覆盖层
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        const { selectedDecorationId, decorations, currentMode } = editorState.getState();
        
        // 只在装饰模式下显示选中效果
        if (selectedDecorationId && currentMode === 'decoration') {
            const selectedDecoration = decorations.find(d => d.id === selectedDecorationId);
            if (selectedDecoration) {
                this.drawDecorationSelection(selectedDecoration);
            }
        }
    }
    
    drawDecorationSelection(decoration) {
        const { x, y, scale, rotation } = decoration;
        const size = decoration.originalSize * scale;
        const centerX = x * this.mainCanvas.width;
        const centerY = y * this.mainCanvas.height;
        
        this.overlayCtx.save();
        this.overlayCtx.translate(centerX, centerY);
        this.overlayCtx.rotate((rotation * Math.PI) / 180);
        
        // 绘制选中边框（虚线）
        this.overlayCtx.strokeStyle = '#00aabb';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.strokeRect(-size/2, -size/2, size, size);
        
        this.overlayCtx.restore();
    }
    
    // 状态变化监听
    onStateChange(state) {
        if (state.image.element) {
            this.showEditor();
        } else {
            this.hideEditor();
        }
        this.render();
    }
    
    // 事件处理
    handleMouseDown(e) {
        e.preventDefault();
        const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
        const hitDecoration = this.hitTestDecorations(pos);
        
        if (hitDecoration) {
            editorState.selectDecoration(hitDecoration.id);
            this.startDrag(pos, hitDecoration);
        } else {
            editorState.selectDecoration(null);
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (this.interaction.isDragging) {
            const pos = Utils.getCanvasPosition(e, this.overlayCanvas);
            this.updateDrag(pos);
        }
    }
    
    handleMouseUp(e) {
        this.stopDrag();
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        this.handleMouseDown(e);
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        this.handleMouseMove(e);
    }
    
    handleTouchEnd(e) {
        this.handleMouseUp(e);
    }
    
    handleResize() {
        this.resizeCanvas();
    }
    
    startDrag(pos, decoration) {
        this.interaction.isDragging = true;
        this.interaction.startPos = pos;
        this.interaction.startDecoration = { ...decoration };
    }
    
    updateDrag(pos) {
        if (!this.interaction.isDragging || !this.interaction.startDecoration) return;
        
        const deltaX = pos.x - this.interaction.startPos.x;
        const deltaY = pos.y - this.interaction.startPos.y;
        
        const newX = this.interaction.startDecoration.x + (deltaX / this.mainCanvas.width);
        const newY = this.interaction.startDecoration.y + (deltaY / this.mainCanvas.height);
        
        editorState.updateDecoration(this.interaction.startDecoration.id, {
            x: Math.max(0, Math.min(1, newX)),
            y: Math.max(0, Math.min(1, newY))
        });
        
        this.render();
    }
    
    stopDrag() {
        this.interaction.isDragging = false;
        this.interaction.startPos = { x: 0, y: 0 };
        this.interaction.startDecoration = null;
    }
    
    hitTestDecorations(pos) {
        const { decorations } = editorState.getState();
        
        // 从后往前检测（后添加的在上层）
        for (let i = decorations.length - 1; i >= 0; i--) {
            const decoration = decorations[i];
            const size = decoration.originalSize * decoration.scale;
            const centerX = decoration.x * this.mainCanvas.width;
            const centerY = decoration.y * this.mainCanvas.height;
            
            // 简单的矩形碰撞检测
            if (pos.x >= centerX - size/2 && pos.x <= centerX + size/2 &&
                pos.y >= centerY - size/2 && pos.y <= centerY + size/2) {
                return decoration;
            }
        }
        
        return null;
    }
}

// ===== 图片管理器 =====
class ImageManager {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 文件上传按钮
        const uploadButton = document.querySelector('.upload-button:not(.online-upload)');
        if (uploadButton) {
            uploadButton.addEventListener('click', () => this.openFileDialog());
        }
        
        // 图片素材点击事件
        const imageAssets = document.querySelectorAll('.image-asset-item');
        imageAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const imageSrc = asset.dataset.imageSrc;
                if (imageSrc) {
                    this.loadImageFromSrc(imageSrc);
                }
            });
        });
        
        // 拖拽上传
        const placeholder = document.getElementById('upload-placeholder');
        if (placeholder) {
            placeholder.addEventListener('dragover', this.handleDragOver.bind(this));
            placeholder.addEventListener('drop', this.handleDrop.bind(this));
            placeholder.addEventListener('dragleave', (e) => {
                e.currentTarget.classList.remove('drag-over');
            });
        }
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
    
    async loadImageFromSrc(src) {
        try {
            const img = await Utils.loadImage(src);
            editorState.updateImage(img, img.naturalWidth, img.naturalHeight);
        } catch (error) {
            console.error('加载图片失败:', error);
            alert('加载图片失败，请重试');
        }
    }
    
    async loadImageFile(file) {
        try {
            const src = URL.createObjectURL(file);
            await this.loadImageFromSrc(src);
        } catch (error) {
            console.error('加载图片文件失败:', error);
            alert('加载图片文件失败，请重试');
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.loadImageFile(files[0]);
        }
    }
}

// ===== 边框管理器 =====
class BorderManager {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 边框素材点击事件
        const borderAssets = document.querySelectorAll('.frame-asset-item');
        borderAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const borderId = asset.dataset.borderId;
                if (borderId) {
                    this.loadBorder(borderId);
                }
            });
        });
        
        // 边框宽度滑块
        const borderWidthSlider = document.getElementById('border-width-slider');
        const borderWidthLabel = document.getElementById('border-width-label');
        
        if (borderWidthSlider && borderWidthLabel) {
            borderWidthSlider.addEventListener('input', (e) => {
                const ratio = parseFloat(e.target.value) / 100;
                editorState.updateBorder(
                    editorState.getState().border.id,
                    editorState.getState().border.settings,
                    editorState.getState().border.image,
                    ratio
                );
                borderWidthLabel.textContent = `${e.target.value}%`;
            });
        }
    }
    
    async loadBorder(borderId) {
        try {
            // 加载边框配置
            const settings = await Utils.loadJson(`assets/frames/${borderId}/settings.json`);
            if (!settings) {
                throw new Error('无法加载边框配置');
            }
            
            // 加载边框图片
            const borderImage = await Utils.loadImage(`assets/frames/${borderId}/frame.png`);
            
            editorState.updateBorder(borderId, settings, borderImage);
            
            // 更新UI状态
            this.updateBorderAssetSelection(borderId);
            
        } catch (error) {
            console.error('加载边框失败:', error);
            alert('加载边框失败，请重试');
        }
    }
    
    updateBorderAssetSelection(borderId) {
        // 移除所有选中状态
        document.querySelectorAll('.frame-asset-item').forEach(item => {
            item.classList.remove('active-asset');
        });
        
        // 添加当前选中状态
        const selectedAsset = document.querySelector(`[data-border-id="${borderId}"]`);
        if (selectedAsset) {
            selectedAsset.classList.add('active-asset');
        }
    }
}

// ===== 装饰管理器 =====
class DecorationManager {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 装饰素材点击事件
        const decorationAssets = document.querySelectorAll('.decoration-asset-item');
        decorationAssets.forEach(asset => {
            asset.addEventListener('click', () => {
                const decorationId = asset.dataset.decorationId;
                if (decorationId) {
                    this.addDecoration(decorationId);
                }
            });
        });
        
        // 装饰控制滑块
        const scaleSlider = document.getElementById('decoration-scale-slider');
        const scaleLabel = document.getElementById('decoration-scale-label');
        const rotationSlider = document.getElementById('decoration-rotation-slider');
        const rotationLabel = document.getElementById('decoration-rotation-label');
        const deleteBtn = document.getElementById('delete-decoration-btn');
        
        if (scaleSlider && scaleLabel) {
            scaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                const selectedId = editorState.getState().selectedDecorationId;
                if (selectedId) {
                    editorState.updateDecoration(selectedId, { scale });
                    scaleLabel.textContent = `${Math.round(scale * 100)}%`;
                }
            });
        }
        
        if (rotationSlider && rotationLabel) {
            rotationSlider.addEventListener('input', (e) => {
                const rotation = parseFloat(e.target.value);
                const selectedId = editorState.getState().selectedDecorationId;
                if (selectedId) {
                    editorState.updateDecoration(selectedId, { rotation });
                    rotationLabel.textContent = `${rotation}°`;
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const selectedId = editorState.getState().selectedDecorationId;
                if (selectedId) {
                    editorState.removeDecoration(selectedId);
                }
            });
        }
        
        // 监听状态变化以更新控件
        editorState.addListener(this.onStateChange.bind(this));
    }
    
    async addDecoration(decorationId) {
        try {
            // 加载装饰图片
            const decorationImage = await Utils.loadImage(`assets/decos/${decorationId}/deco.png`);
            
            // 计算默认尺寸（图片最小边的1/10）
            const state = editorState.getState();
            const minDim = state.image.minDimension || 500;
            const defaultScale = 0.1;
            const originalSize = minDim * defaultScale;
            
            editorState.addDecoration({
                decorationId,
                image: decorationImage,
                originalSize,
                defaultScale
            });
            
        } catch (error) {
            console.error('加载装饰失败:', error);
            alert('加载装饰失败，请重试');
        }
    }
    
    onStateChange(state) {
        const { selectedDecorationId, decorations } = state;
        const selectedDecoration = decorations.find(d => d.id === selectedDecorationId);
        
        // 更新控件值
        const scaleSlider = document.getElementById('decoration-scale-slider');
        const scaleLabel = document.getElementById('decoration-scale-label');
        const rotationSlider = document.getElementById('decoration-rotation-slider');
        const rotationLabel = document.getElementById('decoration-rotation-label');
        
        if (selectedDecoration) {
            if (scaleSlider) {
                scaleSlider.value = selectedDecoration.scale;
                scaleLabel.textContent = `${Math.round(selectedDecoration.scale * 100)}%`;
            }
            if (rotationSlider) {
                rotationSlider.value = selectedDecoration.rotation;
                rotationLabel.textContent = `${selectedDecoration.rotation}°`;
            }
        }
    }
}

// ===== 模式管理器 =====
class ModeManager {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 导航按钮点击事件
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                this.switchMode(mode);
            });
        });
        
        // 监听状态变化
        editorState.addListener(this.onStateChange.bind(this));
    }
    
    switchMode(mode) {
        editorState.setMode(mode);
        this.updateNavigation(mode);
        this.updateAssets(mode);
        this.updateControls(mode);
    }
    
    updateNavigation(mode) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-button').forEach(button => {
            button.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-mode="${mode}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    updateAssets(mode) {
        // 更新底部素材栏
        document.querySelectorAll('.assets-view').forEach(view => {
            view.classList.remove('active');
        });
        
        const activeAssets = document.getElementById(`assets-${mode}`);
        if (activeAssets) {
            activeAssets.classList.add('active');
        }
    }
    
    updateControls(mode) {
        // 更新控件显示
        const borderControls = document.getElementById('border-controls');
        const decorationControls = document.getElementById('decoration-controls');
        const saveOptions = document.getElementById('save-options');
        
        // 隐藏所有控件
        [borderControls, decorationControls, saveOptions].forEach(control => {
            if (control) control.classList.remove('visible');
        });
        
        // 显示对应模式的控件
        switch (mode) {
            case 'frame':
                if (borderControls) borderControls.classList.add('visible');
                break;
            case 'decoration':
                if (decorationControls) decorationControls.classList.add('visible');
                break;
            case 'save':
                if (saveOptions) saveOptions.classList.add('visible');
                break;
        }
    }
    
    onStateChange(state) {
        // 根据状态变化调整界面
        if (state.currentMode) {
            this.updateControls(state.currentMode);
        }
    }
}

// ===== 全局实例初始化 =====
let editorState, canvasEditor, imageManager, borderManager, decorationManager, modeManager;

document.addEventListener('DOMContentLoaded', function() {
    // 初始化全局状态
    editorState = new EditorState();
    
    // 初始化各个管理器
    canvasEditor = new CanvasEditor();
    imageManager = new ImageManager();
    borderManager = new BorderManager();
    decorationManager = new DecorationManager();
    modeManager = new ModeManager();
    
    console.log('🎉 喵妙框Canvas统一架构初始化完成');
    
    // 调试功能：全局访问
    window.editorDebug = {
        state: editorState,
        canvas: canvasEditor,
        enableDebug: () => editorState.enableDebug(),
        disableDebug: () => editorState.disableDebug(),
        getDebugInfo: () => editorState.getDebugInfo()
    };
});