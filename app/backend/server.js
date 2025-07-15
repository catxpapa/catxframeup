// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 应用运行时的数据存储根目录
// 注意：此路径是懒猫微服容器内的标准路径，开发时可能不存在
const APP_HOME = `/lzcapp/run/mnt/home/catxframeup`;
const PRESET_ASSETS_PATH = '/lzcapp/pkg/content/assets'; // 打包在lpk内的预设素材

// API: 获取素材列表
app.get('/api/materials/:type', (req, res) => {
    const type = req.params.type; // 'frames' or 'decorations'
    if (!['frames', 'decorations'].includes(type)) {
        return res.status(400).json({ error: 'Invalid material type' });
    }

    const presetDir = path.join(PRESET_ASSETS_PATH, type);
    const userDir = path.join(APP_HOME, 'user_uploads', type);

    let presetFiles = [];
    if (fs.existsSync(presetDir)) {
        presetFiles = fs.readdirSync(presetDir).map(file => ({ name: file, type: 'preset' }));
    }

    let userFiles = [];
    if (fs.existsSync(userDir)) {
        userFiles = fs.readdirSync(userDir).map(file => ({ name: file, type: 'user' }));
    }
    
    // 预设素材排在用户素材后面 [citation](3)
    res.json([...userFiles, ...presetFiles]);
});

// TODO: 实现文件上传接口
// app.post('/api/upload/:type', ...)

app.listen(PORT, () => {
    console.log(`Backend server for catxframeup listening on port ${PORT}`);
});