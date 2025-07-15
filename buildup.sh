#!/bin/bash

# 项目根目录名称
PROJECT_NAME="catxframeup"

# 创建项目根目录并进入
# echo "Creating project directory: ${PROJECT_NAME}..."
# mkdir -p "${PROJECT_NAME}"
# cd "${PROJECT_NAME}" || exit

# 1. 创建懒猫微服核心配置文件
# echo "Creating LazyCat config files..."
# touch lzc-build.yml
# touch lzc-manifest.yml
# touch lzc-icon.png # 请替换为您自己的 128x128 PNG 图标

# 2. 创建 app 目录，用于存放所有应用代码
echo "Creating app directory structure..."
mkdir -p app/backend
mkdir -p app/assets/frames      # 预设边框素材 [citation](2)
mkdir -p app/assets/decorations # 预设装饰素材 [citation](2)

# 3. 创建前端文件
echo "Creating frontend files..."
touch app/index.html
touch app/style.css
touch app/script.js

# 4. 创建后端文件
echo "Creating backend files..."
touch app/backend/run.sh
touch app/backend/server.js
touch app/backend/package.json

# 赋予 run.sh 执行权限
chmod +x app/backend/run.sh

echo "Project structure for '${PROJECT_NAME}' created successfully."
echo "Current directory: $(pwd)"
echo "You can now populate the configuration and code files."