// ===== 喵妙框前端API调用模块 =====

class FrameupAPI {
    constructor() {
        this.baseURL = '/api';
    }

    // 通用请求方法
    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    // 文件上传方法
    async uploadFile(url, formData) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('文件上传失败:', error);
            throw error;
        }
    }

    // ===== 素材相关API =====

    // 获取边框列表
    async getFrames() {
        return await this.request('/frames');
    }

    // 获取装饰列表
    async getDecorations() {
        return await this.request('/decorations');
    }

    // 上传边框素材
    async uploadFrame(file, settings) {
        const formData = new FormData();
        formData.append('frame', file);
        formData.append('settings', JSON.stringify(settings));
        formData.append('uploadType', 'frame');
        
        return await this.uploadFile('/upload/frame', formData);
    }

    // 上传装饰素材
    async uploadDecoration(file, settings = {}) {
        const formData = new FormData();
        formData.append('decoration', file);
        formData.append('settings', JSON.stringify(settings));
        formData.append('uploadType', 'decoration');
        
        return await this.uploadFile('/upload/decoration', formData);
    }

    // 重新初始化素材
    async resetAssets() {
        return await this.request('/reset/assets', { method: 'POST' });
    }

    // ===== 用户文件相关API =====

    // 获取用户上传的图片列表
    async getUploads() {
        return await this.request('/uploads');
    }

    // 上传图片
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('uploadType', 'image');
        
        return await this.uploadFile('/upload/image', formData);
    }

    // 清空上传文件
    async clearUploads() {
        return await this.request('/clear/uploads', { method: 'DELETE' });
    }

    // ===== 历史作品相关API =====

    // 获取历史作品列表
    async getHistory() {
        return await this.request('/history');
    }

    // 保存历史作品
    async saveHistory(imageData, projectData) {
        return await this.request('/save/history', {
            method: 'POST',
            body: JSON.stringify({ imageData, projectData })
        });
    }

    // 清空历史作品
    async clearHistory() {
        return await this.request('/clear/history', { method: 'DELETE' });
    }

    // ===== 辅助方法 =====

    // 显示加载状态
    showLoading(message = '处理中...') {
        // 可以在这里添加全局加载提示
        console.log('🔄', message);
    }

    // 隐藏加载状态
    hideLoading() {
        console.log('✅ 操作完成');
    }

    // 显示错误信息
    showError(error) {
        console.error('❌ 操作失败:', error);
        alert(`操作失败: ${error.message || error}`);
    }

    // 显示成功信息
    showSuccess(message) {
        console.log('✅', message);
        // 可以添加成功提示UI
    }
}

// 创建全局API实例
const frameupAPI = new FrameupAPI();

// ===== 文件处理辅助函数 =====

// 处理文件关联打开
function handleFileOpen() {
    const urlParams = new URLSearchParams(window.location.search);
    const openFile = urlParams.get('openFile');
    
    if (openFile) {
        // 自动加载关联打开的文件
        loadImageFromPath(openFile);
        
        // 清除URL参数
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// 从路径加载图片
async function loadImageFromPath(filePath) {
    try {
        frameupAPI.showLoading('加载图片中...');
        
        // 创建图片元素并加载
        const img = new Image();
        img.onload = () => {
            // 使用现有的图片加载逻辑
            if (typeof imageManager !== 'undefined' && imageManager.loadImageFromSrc) {
                imageManager.loadImageFromSrc(filePath);
            }
            frameupAPI.hideLoading();
        };
        img.onerror = () => {
            frameupAPI.showError('图片加载失败');
        };
        img.src = filePath;
        
    } catch (error) {
        frameupAPI.showError(error);
    }
}

// 页面加载完成后处理文件关联
document.addEventListener('DOMContentLoaded', handleFileOpen);