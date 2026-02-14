require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATS_FILE = path.join(__dirname, '..', 'stats.json');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'bot.log');

function getTodayStats() {
  const stats = { posts: 0, replies: 0, newPosts: 0, date: new Date().toISOString().substring(0, 10) };
  
  try {
    if (!fs.existsSync(LOG_FILE)) return stats;
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n');
    const today = stats.date;
    
    lines.forEach(line => {
      if (!line.includes(today)) return;
      if (line.includes('[LEARN]')) stats.posts++;
      if (line.includes('[INTERACT]') && line.includes('成功')) stats.replies++;
      if (line.includes('[POST]') && line.includes('成功')) stats.newPosts++;
    });
  } catch (e) {
    console.error('读取日志失败:', e.message);
  }
  
  return stats;
}

function syncToGit() {
  const todayStats = getTodayStats();
  
  // 读取现有统计数据
  let allStats = { daily: [], lastSync: null };
  try {
    if (fs.existsSync(STATS_FILE)) {
      allStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch (e) {}
  
  // 更新今天的统计
  const todayIndex = allStats.daily.findIndex(d => d.date === todayStats.date);
  if (todayIndex >= 0) {
    allStats.daily[todayIndex] = todayStats;
  } else {
    allStats.daily.push(todayStats);
  }
  
  // 只保留最近30天
  allStats.daily = allStats.daily.slice(-30);
  allStats.lastSync = new Date().toISOString();
  
  // 保存
  fs.writeFileSync(STATS_FILE, JSON.stringify(allStats, null, 2));
  console.log(`[同步] 今日统计: 浏览${todayStats.posts}篇, 互动${todayStats.replies}次, 发帖${todayStats.newPosts}篇`);
  
  // 自动提交到 GitHub
  try {
    execSync('git add stats.json', { cwd: path.join(__dirname, '..') });
    execSync('git commit -m "同步统计"', { cwd: path.join(__dirname, '..') });
    execSync('git push', { cwd: path.join(__dirname, '..') });
    console.log('[同步] 已推送到 GitHub');
  } catch (e) {
    console.log('[同步] Git 推送跳过（可能未配置远程仓库）');
  }
  
  return todayStats;
}

if (require.main === module) {
  syncToGit();
}

module.exports = { syncToGit, getTodayStats };
