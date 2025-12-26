#!/bin/bash
set -e  # 遇到任何错误立即停止，确保快照是完美的

echo "--- 开始配置 yt-dlp 环境 ---"

# 1. 更新包索引并安装核心依赖
# ffmpeg: 用于音视频合并
# curl & unzip: Deno 安装器需要它们
echo "--- 正在安装系统依赖 (ffmpeg, curl, unzip) ---"
sudo apt-get update
sudo apt-get install -y ffmpeg curl unzip

# 2. 安装/更新 yt-dlp (包含 [default] 依赖, 如 yt-dlp-ejs)
# 我们使用 --pre 来获取最新的 Nightly 开发版，因为它包含了针对 YouTube 的最新修复
echo "--- 正在安装/更新 yt-dlp 到最新的 Nightly 版本 ---"
pip install -U --pre "yt-dlp[default]"

# 3. 安装 Deno JS 运行时
# Deno 是 yt-dlp 解密 YouTube n-sig 签名的关键外部工具
echo "--- 正在安装 Deno JS 运行时 ---"
# 使用官方脚本进行安装
curl -fsSL https://deno.land/install.sh | sh

# 4. 将 Deno 添加到当前会话的 PATH 中
# 这样脚本的后续步骤才能直接调用 deno 命令
echo "--- 将 Deno 添加到 PATH 环境变量 ---"
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
echo "PATH 已更新，Deno 现在可用。"

# 5. 验证所有工具的安装结果
echo "--- 正在验证所有工具的版本 ---"
echo "[yt-dlp version:]"
yt-dlp --version
echo -e "\n[ffmpeg version:]"
ffmpeg -version | head -n 1 # 只显示 ffmpeg 版本信息的第一行
echo -e "\n[deno version:]"
deno --version

echo "--- 环境配置完成，准备进行快照 ---"
