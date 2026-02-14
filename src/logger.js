require('dotenv').config();
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'bot.log');

function ensureLogDir() {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function formatDate(date = new Date()) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function log(action, details = '') {
  ensureLogDir();
  const logEntry = `[${formatDate()}] [${action.toUpperCase()}] ${details}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
}

function getLogs(limit = 50) {
  ensureLogDir();
  if (!fs.existsSync(LOG_FILE)) {
    return '暂无日志记录';
  }
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  return lines.slice(-limit).join('\n');
}

function getStats() {
  ensureLogDir();
  if (!fs.existsSync(LOG_FILE)) {
    return { totalRuns: 0, postsVisited: 0, interactions: 0, newPosts: 0 };
  }
  
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  let postsVisited = 0;
  let interactions = 0;
  let newPosts = 0;
  let loginSuccess = 0;
  
  lines.forEach(line => {
    if (line.includes('[LEARN]')) postsVisited++;
    if (line.includes('[INTERACT]') && line.includes('成功')) interactions++;
    if (line.includes('[POST]') && line.includes('成功')) newPosts++;
    if (line.includes('[LOGIN]')) loginSuccess++;
  });
  
  return {
    totalRuns: lines.filter(l => l.includes('[SCHEDULER]') && l.includes('开始执行')).length,
    postsVisited,
    interactions,
    newPosts,
    loginSuccess
  };
}

// 命令行输出帮助
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Moltbook Bot 日志查看工具

用法:
  node logger.js              # 查看最近50条日志
  node logger.js --stats      # 查看统计信息
  node logger.js --all       # 查看所有日志
  node logger.js --clear     # 清除日志
  `);
  process.exit(0);
}

// 显示统计
if (process.argv.includes('--stats')) {
  const stats = getStats();
  console.log('\n========== Bot 学习统计 ==========');
  console.log(`执行次数: ${stats.totalRuns}`);
  console.log(`浏览帖子: ${stats.postsVisited} 篇`);
  console.log(`互动次数: ${stats.interactions} 次`);
  console.log(`发布帖子: ${stats.newPosts} 篇`);
  console.log(`登录成功: ${stats.loginSuccess} 次`);
  console.log('==================================\n');
  process.exit(0);
}

// 清除日志
if (process.argv.includes('--clear')) {
  ensureLogDir();
  fs.writeFileSync(LOG_FILE, '');
  console.log('日志已清除');
  process.exit(0);
}

// 显示所有日志
if (process.argv.includes('--all')) {
  console.log('\n========== 全部日志 ==========\n');
  console.log(getLogs(9999));
  process.exit(0);
}

// 默认显示最近日志
console.log('\n========== 最近日志 ==========\n');
console.log(getLogs(50));

module.exports = { log, getLogs, getStats };
