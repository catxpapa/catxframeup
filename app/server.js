const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 文件存储路径配置
const PATHS = {
    assets: '/lzcapp/var/assets',
    uploads: '/lzcapp/var/uploads', 
    history: '/lzcapp/var/history',
    frames: '/lzcapp/var/assets/frames',
    decos: '/lzcapp/var/assets/decos',
    originalAssets: '/lzcapp/pkg/content/assets'
};

// 确保目录存在
async function ensureDirectories() {
    try {
        for (const dirPath of Object.values(PATHS)) {
            await fs.mkdir(dirPath, { recursive: true });
        }
        console.log('✅ 所有必要目录已创建');
    } catch (error) {
        console.error('❌ 创建目录失败:', error);
    }
}

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadType = req.body.uploadType || 'image';
        let destPath = PATHS.uploads;
        
        if (uploadType === 'frame') {
            destPath = PATHS.frames;
        } else if (uploadType === 'decoration') {
            destPath = PATHS.decos;
        }
        
        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只支持图片文件格式'));
        }
    }
});

// ===== API路由定义 =====

// 1. 获取边框列表
app.get('/api/frames', async (req, res) => {
    try {
        const frames = [];
        const frameDir = PATHS.frames;
        
        const items = await fs.readdir(frameDir);
        
        for (const item of items) {
            const itemPath = path.join(frameDir, item);
            const stat = await fs.stat(itemPath);
            
            if (stat.isDirectory()) {
                // 检查是否有frame.png和settings.json
                const framePath = path.join(itemPath, 'frame.png');
                const settingsPath = path.join(itemPath, 'settings.json');
                
                try {
                    await fs.access(framePath);
                    const settings = await fs.readFile(settingsPath, 'utf8');
                    
                    frames.push({
                        id: item,
                        name: item,
                        imagePath: `/assets/frames/${item}/frame.png`,
                        settings: JSON.parse(settings)
                    });
                } catch (err) {
                    console.warn(`边框 ${item} 配置不完整:`, err.message);
                }
            }
        }
        
        res.json({ success: true, data: frames });
    } catch (error) {
        console.error('获取边框列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. 获取装饰列表
app.get('/api/decorations', async (req, res) => {
    try {
        const decorations = [];
        const decoDir = PATHS.decos;
        
        const items = await fs.readdir(decoDir);
        
        for (const item of items) {
            const itemPath = path.join(decoDir, item);
            const stat = await fs.stat(itemPath);
            
            if (stat.isDirectory()) {
                // 检查是否有deco.png和settings.json
                const decoPath = path.join(itemPath, 'deco.png');
                const settingsPath = path.join(itemPath, 'settings.json');
                
                try {
                    await fs.access(decoPath);
                    let settings = { defaultScale: 0.1 }; // 默认设置
                    
                    try {
                        const settingsData = await fs.readFile(settingsPath, 'utf8');
                        settings = { ...settings, ...JSON.parse(settingsData) };
                    } catch (settingsErr) {
                        console.warn(`装饰 ${item} 使用默认设置`);
                    }
                    
                    decorations.push({
                        id: item,
                        name: item,
                        imagePath: `/assets/decos/${item}/deco.png`,
                        settings
                    });
                } catch (err) {
                    console.warn(`装饰 ${item} 配置不完整:`, err.message);
                }
            }
        }
        
        res.json({ success: true, data: decorations });
    } catch (error) {
        console.error('获取装饰列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. 获取用户上传的图片列表
app.get('/api/uploads', async (req, res) => {
    try {
        const uploads = [];
        const uploadDir = PATHS.uploads;
        
        const files = await fs.readdir(uploadDir);
        
        for (const file of files) {
            const filePath = path.join(uploadDir, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                uploads.push({
                    id: path.parse(file).name,
                    filename: file,
                    path: `/uploads/${file}`,
                    uploadTime: stat.mtime,
                    size: stat.size
                });
            }
        }
        
        // 按上传时间倒序排列
        uploads.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
        
        res.json({ success: true, data: uploads });
    } catch (error) {
        console.error('获取上传图片列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. 获取历史作品列表
app.get('/api/history', async (req, res) => {
    try {
        const history = [];
        const historyDir = PATHS.history;
        
        const files = await fs.readdir(historyDir);
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const jsonPath = path.join(historyDir, file);
                const imageName = file.replace('.json', '.png');
                const imagePath = path.join(historyDir, imageName);
                
                try {
                    const jsonData = await fs.readFile(jsonPath, 'utf8');
                    const stat = await fs.stat(jsonPath);
                    
                    // 检查是否有对应的图片文件
                    let hasImage = false;
                    try {
                        await fs.access(imagePath);
                        hasImage = true;
                    } catch (err) {
                        // 图片文件不存在
                    }
                    
                    history.push({
                        id: path.parse(file).name,
                        jsonPath: `/history/${file}`,
                        imagePath: hasImage ? `/history/${imageName}` : null,
                        data: JSON.parse(jsonData),
                        saveTime: stat.mtime
                    });
                } catch (err) {
                    console.warn(`历史作品 ${file} 读取失败:`, err.message);
                }
            }
        }
        
        // 按保存时间倒序排列
        history.sort((a, b) => new Date(b.saveTime) - new Date(a.saveTime));
        
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('获取历史作品列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. 上传图片文件
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '没有上传文件' });
        }
        
        res.json({
            success: true,
            data: {
                id: path.parse(req.file.filename).name,
                filename: req.file.filename,
                path: `/uploads/${req.file.filename}`,
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('图片上传失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. 上传边框素材
app.post('/api/upload/frame', upload.single('frame'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '没有上传边框文件' });
        }
        
        const { settings } = req.body;
        if (!settings) {
            return res.status(400).json({ success: false, error: '缺少边框设置' });
        }
        
        // 验证settings格式
        let settingsObj;
        try {
            settingsObj = JSON.parse(settings);
        } catch (err) {
            return res.status(400).json({ success: false, error: '边框设置JSON格式错误' });
        }
        
        const frameId = path.parse(req.file.filename).name;
        const frameDir = path.join(PATHS.frames, frameId);
        
        // 创建边框目录
        await fs.mkdir(frameDir, { recursive: true });
        
        // 移动文件到正确位置并重命名
        const oldPath = req.file.path;
        const newPath = path.join(frameDir, 'frame.png');
        await fs.rename(oldPath, newPath);
        
        // 保存设置文件
        const settingsPath = path.join(frameDir, 'settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(settingsObj, null, 2));
        
        res.json({
            success: true,
            data: {
                id: frameId,
                name: frameId,
                imagePath: `/assets/frames/${frameId}/frame.png`,
                settings: settingsObj
            }
        });
    } catch (error) {
        console.error('边框上传失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. 上传装饰素材
app.post('/api/upload/decoration', upload.single('decoration'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '没有上传装饰文件' });
        }
        
        const { settings } = req.body;
        let settingsObj = { defaultScale: 0.1 }; // 默认设置
        
        if (settings) {
            try {
                settingsObj = { ...settingsObj, ...JSON.parse(settings) };
            } catch (err) {
                console.warn('装饰设置JSON格式错误，使用默认设置');
            }
        }
        
        const decoId = path.parse(req.file.filename).name;
        const decoDir = path.join(PATHS.decos, decoId);
        
        // 创建装饰目录
        await fs.mkdir(decoDir, { recursive: true });
        
        // 移动文件到正确位置并重命名
        const oldPath = req.file.path;
        const newPath = path.join(decoDir, 'deco.png');
        await fs.rename(oldPath, newPath);
        
        // 保存设置文件
        const settingsPath = path.join(decoDir, 'settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(settingsObj, null, 2));
        
        res.json({
            success: true,
            data: {
                id: decoId,
                name: decoId,
                imagePath: `/assets/decos/${decoId}/deco.png`,
                settings: settingsObj
            }
        });
    } catch (error) {
        console.error('装饰上传失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. 保存历史作品
app.post('/api/save/history', async (req, res) => {
    try {
        const { imageData, projectData } = req.body;
        
        if (!imageData || !projectData) {
            return res.status(400).json({ success: false, error: '缺少必要数据' });
        }
        
        const historyId = uuidv4();
        
        // 保存图片文件
        const imageBuffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const imagePath = path.join(PATHS.history, `${historyId}.png`);
        await fs.writeFile(imagePath, imageBuffer);
        
        // 保存项目JSON
        const jsonPath = path.join(PATHS.history, `${historyId}.json`);
        const saveData = {
            ...projectData,
            saveTime: new Date().toISOString(),
            id: historyId
        };
        await fs.writeFile(jsonPath, JSON.stringify(saveData, null, 2));
        
        res.json({
            success: true,
            data: {
                id: historyId,
                imagePath: `/history/${historyId}.png`,
                jsonPath: `/history/${historyId}.json`
            }
        });
    } catch (error) {
        console.error('保存历史作品失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. 清空上传文件
app.delete('/api/clear/uploads', async (req, res) => {
    try {
        const files = await fs.readdir(PATHS.uploads);
        
        for (const file of files) {
            const filePath = path.join(PATHS.uploads, file);
            await fs.unlink(filePath);
        }
        
        res.json({ success: true, message: `已清空 ${files.length} 个上传文件` });
    } catch (error) {
        console.error('清空上传文件失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. 清空历史作品
app.delete('/api/clear/history', async (req, res) => {
    try {
        const files = await fs.readdir(PATHS.history);
        
        for (const file of files) {
            const filePath = path.join(PATHS.history, file);
            await fs.unlink(filePath);
        }
        
        res.json({ success: true, message: `已清空 ${files.length} 个历史文件` });
    } catch (error) {
        console.error('清空历史作品失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. 重新初始化素材
app.post('/api/reset/assets', async (req, res) => {
    try {
        // 清空现有素材
        await fs.rm(PATHS.assets, { recursive: true, force: true });
        await fs.mkdir(PATHS.assets, { recursive: true });
        
        // 重新复制原始素材
        await copyDirectory(path.join(PATHS.originalAssets, 'frames'), PATHS.frames);
        await copyDirectory(path.join(PATHS.originalAssets, 'decos'), PATHS.decos);
        
        res.json({ success: true, message: '素材已重新初始化' });
    } catch (error) {
        console.error('重新初始化素材失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. 文件关联处理
app.get('/open', async (req, res) => {
    try {
        const { file } = req.query;
        
        if (!file) {
            return res.status(400).send('缺少文件参数');
        }
        
        // 重定向到主页面，并传递文件路径
        res.redirect(`/?openFile=${encodeURIComponent(file)}`);
    } catch (error) {
        console.error('文件关联处理失败:', error);
        res.status(500).send('文件处理失败');
    }
});

// 辅助函数：递归复制目录
async function copyDirectory(src, dest) {
    try {
        await fs.mkdir(dest, { recursive: true });
        const items = await fs.readdir(src);
        
        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stat = await fs.stat(srcPath);
            
            if (stat.isDirectory()) {
                await copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    } catch (error) {
        console.error(`复制目录失败 ${src} -> ${dest}:`, error);
        throw error;
    }
}

// 启动服务器
async function startServer() {
    await ensureDirectories();
    
    app.listen(PORT, () => {
        console.log(`🚀 喵妙框后端服务已启动，端口: ${PORT}`);
        console.log(`📁 文件路径配置:`, PATHS);
    });
}

startServer().catch(console.error);