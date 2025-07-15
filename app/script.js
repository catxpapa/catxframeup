// script.js
document.addEventListener('DOMContentLoaded', () => {
    const selectFromDriveBtn = document.getElementById('select-from-drive');

    // 检查懒猫文件选择器插件是否已加载
    if (typeof lzcFilePickers !== 'undefined') {
        // 实例化文件选择器
        const picker = new lzcFilePickers.FilePicker();

        // 绑定点击事件
        selectFromDriveBtn.addEventListener('click', async () => {
            try {
                // 调用插件打开文件选择对话框
                const files = await picker.show({
                    // 可以根据需求配置选项，例如：
                    // mime_type: ['image/png', 'image/jpeg'],
                    // multi_select: true,
                });

                if (files && files.length > 0) {
                    console.log('Selected files from LazyCat Drive:', files);
                    // TODO: 处理返回的文件信息，例如在Canvas上显示第一张图片
                    // const firstFile = files[0];
                    // displayImageOnCanvas(firstFile.path);
                }
            } catch (error) {
                console.error('Error picking file from LazyCat Drive:', error);
                alert('从网盘选择文件失败！');
            }
        });
    } else {
        console.error('LazyCat File Picker plugin not loaded!');
        selectFromDriveBtn.disabled = true;
        selectFromDriveBtn.textContent = '网盘插件加载失败';
    }

    // TODO: 实现其他功能，如本地上传、Canvas绘制、素材加载等
});