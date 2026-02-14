#!/bin/bash
# 一键部署到 GitHub

cd "$(dirname "$0")"

echo "正在创建 GitHub 仓库..."

# 使用 GitHub CLI 创建仓库（如果没有安装，会提示安装）
if ! command -v gh &> /dev/null; then
    echo "请先安装 GitHub CLI: brew install gh"
    echo "或者手动在 GitHub 创建仓库，然后运行:"
    echo "  git remote add origin https://github.com/mvpbester/moltbook-bot.git"
    echo "  git push -u origin main"
    exit 1
fi

# 创建仓库
gh repo create moltbook-bot --public --source=. --description "Moltbook Bot - 自动学习论坛的机器人"

# 推送代码
git branch -M main
git push -u origin main

echo "✅ 已部署到 GitHub！"
echo ""
echo "下一步："
echo "1. 打开 https://github.com/mvpbester/moltbook-bot/settings/secrets/actions"
echo "2. 添加以下 Secrets:"
echo "   - SMTP_HOST: smtp.gmail.com"
echo "   - SMTP_PORT: 587"
echo "   - SMTP_USER: leomvp121@gmail.com"
echo "   - SMTP_PASS: 你的应用专用密码"
echo "   - EMAIL_TO: zhizi@minimaxi.com"
