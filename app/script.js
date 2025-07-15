// script.js
document.addEventListener('DOMContentLoaded', () => {
    const selectFromDriveBtn = document.getElementById('select-from-drive');
    const saveToDriverBtn = document.getElementById('save-to-drive');
    const filePicker = document.getElementById('file-picker');
    const fileSaver = document.getElementById('file-saver');
    
    // 网盘文件路径配置
    const diskPath = '/api/files/home'; // 懒猫网盘API路径
    let isPickerInit = false;
    let isSaverInit = false;

    // 数据传输辅助函数
    function dataTransfer(raw) {
        if (!raw) return null;
        const output = raw.detail[0];
        return output;
    }

    // 初始化文件选择器
    function initFilePicker() {
        if (!isPickerInit && filePicker._instance) {
            const ctx = filePicker._instance.exposed;
            ctx.init(diskPath);
            isPickerInit = true;
            console.log('文件选择器初始化完成');
        }
    }

    // 初始化文件保存器
    function initFileSaver() {
        if (!isSaverInit && fileSaver._instance) {
            const ctx = fileSaver._instance.exposed;
            ctx.init(diskPath);
            isSaverInit = true;
            console.log('文件保存器初始化完成');
        }
    }

    // 从网盘选择文件
    selectFromDriveBtn.addEventListener('click', () => {
        try {
            initFilePicker();
            const ctx = filePicker._instance.exposed;
            ctx.open();
        } catch (error) {
            console.error('打开文件选择器失败:', error);
            alert('文件选择器加载失败，请刷新页面重试');
        }
    });

    // 保存到网盘
    saveToDriverBtn.addEventListener('click', () => {
        try {
            initFileSaver();
            const ctx = fileSaver._instance.exposed;
            
            // 获取Canvas内容并转换为Blob
            const canvas = document.getElementById('main-canvas');
            canvas.toBlob((blob) => {
                if (blob) {
                    // 读取blob内容
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const content = e.target.result;
                        // 发送保存数据：内容、后缀名、默认文件名
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                        ctx.sendSaveAsData(content, 'png', `喵妙框作品_${timestamp}`);
                        ctx.open();
                    };
                    reader.readAsDataURL(blob);
                } else {
                    alert('无法获取图片内容');
                }
            }, 'image/png');
        } catch (error) {
            console.error('打开文件保存器失败:', error);
            alert('文件保存器加载失败，请刷新页面重试');
        }
    });

    // 监听文件选择完成事件
    filePicker.addEventListener('submit', (event) => {
        const selectedFile = dataTransfer(event);
        if (selectedFile) {
            console.log('选择的文件:', selectedFile);
            // TODO: 处理选中的文件，加载到Canvas中
            loadImageToCanvas(selectedFile.path);
        }
    });

    // 监听文件保存完成事件
    fileSaver.addEventListener('done', (event) => {
        const result = dataTransfer(event);
        if (result && result.status) {
            result.status.then((success) => {
                if (success) {
                    alert('文件保存成功！');
                } else {
                    alert('文件保存失败，请重试');
                }
            });
        }
    });

    // 监听选择器关闭事件
    filePicker.addEventListener('visible', () => {
        // 可以在这里添加关闭确认逻辑
    });

    fileSaver.addEventListener('visible', () => {
        // 可以在这里添加关闭确认逻辑
    });

    // 加载图片到Canvas的函数
    function loadImageToCanvas(imagePath) {
        const canvas = document.getElementById('main-canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // 设置Canvas尺寸
            canvas.width = img.width;
            canvas.height = img.height;
            
            // 绘制图片
            ctx.drawImage(img, 0, 0);
            
            // 显示Canvas，隐藏选择界面
            document.getElementById('image-selection-view').style.display = 'none';
            canvas.style.display = 'block';
            saveToDriverBtn.style.display = 'inline-block';
            
            console.log('图片加载完成:', imagePath);
        };
        
        img.onerror = function() {
            console.error('图片加载失败:', imagePath);
            alert('图片加载失败，请重新选择');
        };
        
        // 设置图片源（这里需要根据懒猫网盘的实际API调整）
        img.src = imagePath;
    }

    // TODO: 实现本地上传功能
    document.getElementById('upload-local').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.getElementById('main-canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        
                        document.getElementById('image-selection-view').style.display = 'none';
                        canvas.style.display = 'block';
                        saveToDriverBtn.style.display = 'inline-block';
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    });
});