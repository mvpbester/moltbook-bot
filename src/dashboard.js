require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 38888;
const LOG_FILE = path.join(__dirname, '..', 'logs', 'out.log'); // 修复：读取正确的日志文件
const STATS_FILE = path.join(__dirname, '..', 'logs', 'stats.json');

// 读取统计数据
function getStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch (e) {}
  
  // 从日志文件统计
  return getStatsFromLog();
}

function getStatsFromLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return { bots: {}, lastUpdate: null };
    }
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const bots = {
      '技术学习Bot': { posts: 0, replies: 0, postsCreated: 0, postLinks: [] },
      '学习交流Bot': { posts: 0, replies: 0, postsCreated: 0, postLinks: [] },
      '综合Bot': { posts: 0, replies: 0, postsCreated: 0, postLinks: [] }
    };
    
    let lastUpdate = null;
    
    lines.forEach(line => {
      // 检测Bot名称和活动 - 修复匹配逻辑
      let hasBotName = false;
      
      for (const botName of Object.keys(bots)) {
        // 检查行是否包含Bot名称（带或不带方括号）
        if (line.includes(botName) || line.includes('[' + botName + ']')) {
          hasBotName = true;
          // 学习/浏览帖子
          if (line.includes('[LEARN]') || (line.includes('找到') && line.includes('帖子')) || line.includes('开始学习')) {
            bots[botName].posts++;
          }
          // 互动（点赞/评论）
          if (line.includes('[INTERACT]') || line.includes('点赞') || line.includes('互动') || line.includes('评论')) {
            bots[botName].replies++;
          }
          // 发帖/发布 - 记录链接
          if (line.includes('[POST]') || line.includes('发帖') || line.includes('发布成功')) {
            bots[botName].postsCreated++;
            // 提取帖子链接
            const linkMatch = line.match(/https?:\/\/[^\s]+post\/[a-zA-Z0-9-]+/);
            if (linkMatch) {
              bots[botName].postLinks.push(linkMatch[0]);
            }
          }
        }
      }
      
      // 对于没有Bot名称的通用日志（如[INTERACT]点赞），平均分配给所有Bot
      if (!hasBotName && (line.includes('[INTERACT]') || line.includes('点赞成功'))) {
        for (const botName of Object.keys(bots)) {
          bots[botName].replies++;
        }
      }
      
      // 更新时间
      const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      if (timeMatch) {
        lastUpdate = timeMatch[1];
      }
    });
    
    return { bots, lastUpdate };
  } catch (e) {
    return { bots: {}, lastUpdate: null };
  }
}

// 获取最近活动
function getRecentActivity(limit = 20) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.slice(-limit).reverse();
  } catch (e) {
    return [];
  }
}

// HTML模板
function generateHTML() {
  const stats = getStats();
  const activity = getRecentActivity(30);
  
  const botsHtml = Object.entries(stats.bots).map(([name, data]) => {
    const postLinksHtml = data.postLinks && data.postLinks.length > 0 
      ? `<div class="post-links"><span class="label">发布的帖子:</span>${data.postLinks.slice(0, 5).map(link => `<a href="${link}" target="_blank" class="post-link">🔗 查看</a>`).join('')}</div>`
      : '';
    
    return `
    <div class="bot-card">
      <h3>🤖 ${name}</h3>
      <div class="stats">
        <div class="stat">
          <span class="value">${data.posts}</span>
          <span class="label">浏览帖子</span>
        </div>
        <div class="stat">
          <span class="value">${data.replies}</span>
          <span class="label">互动次数</span>
        </div>
        <div class="stat">
          <span class="value">${data.postsCreated}</span>
          <span class="label">发布帖子</span>
        </div>
      </div>
      ${postLinksHtml}
    </div>
  `}).join('');
  
  const activityHtml = activity.map(line => `
    <div class="activity-item">
      <span class="time">${line.substring(0, 19)}</span>
      <span class="content">${line.substring(19)}</span>
    </div>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moltbook Bot 监控面板</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      text-align: center;
      padding: 30px 0;
    }
    header h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .status {
      display: inline-block;
      padding: 8px 20px;
      background: rgba(0, 255, 136, 0.2);
      border-radius: 20px;
      color: #00ff88;
      font-size: 0.9rem;
    }
    .bots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .bot-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .bot-card h3 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      color: #00d9ff;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .stat {
      text-align: center;
      padding: 15px 10px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 12px;
    }
    .stat .value {
      display: block;
      font-size: 1.8rem;
      font-weight: bold;
      color: #00ff88;
    }
    .stat .label {
      display: block;
      font-size: 0.8rem;
      color: #aaa;
      margin-top: 5px;
    }
    .post-links {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .post-links .label {
      font-size: 0.8rem;
      color: #888;
      display: block;
      margin-bottom: 8px;
    }
    .post-link {
      display: inline-block;
      padding: 4px 10px;
      margin: 3px;
      background: rgba(0,255,136,0.2);
      color: #00ff88;
      border-radius: 12px;
      font-size: 0.8rem;
      text-decoration: none;
    }
    .post-link:hover {
      background: rgba(0,255,136,0.4);
    }
    .activity-section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 24px;
      margin-top: 30px;
    }
    .activity-section h2 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      color: #00d9ff;
    }
    .activity-item {
      display: flex;
      gap: 15px;
      padding: 12px 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.9rem;
    }
    .activity-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .activity-item .time {
      color: #00ff88;
      white-space: nowrap;
    }
    .activity-item .content {
      color: #ddd;
    }
    .refresh-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00d9ff, #00ff88);
      border: none;
      color: #1a1a2e;
      font-size: 1.5rem;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4);
      transition: transform 0.3s;
    }
    .refresh-btn:hover {
      transform: scale(1.1);
    }
    footer {
      text-align: center;
      padding: 30px;
      color: #666;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Moltbook Bot 监控面板</h1>
      <span class="status">● 在线运行中</span>
    </header>
    
    <div class="bots-grid">
      ${botsHtml || '<p style="text-align:center;grid-column:1/-1;">暂无数据，请等待Bot执行...</p>'}
    </div>
    
    <div class="activity-section">
      <h2>📊 最近活动</h2>
      ${activityHtml || '<p>暂无活动记录</p>'}
    </div>
  </div>
  
  <button class="refresh-btn" onclick="location.reload()">🔄</button>
  
  <footer>
    <p>最后更新: ${stats.lastUpdate || '等待中...'} | 每小时自动更新</p>
  </footer>
</body>
</html>`;
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateHTML());
  } else if (req.url === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStats()));
  } else if (req.url === '/api/activity') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getRecentActivity(50)));
  } else if (req.url === '/api/bots') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const stats = getStats();
    res.end(JSON.stringify(Object.keys(stats.bots)));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     🤖 Moltbook Bot Dashboard 已启动              ║
╠═══════════════════════════════════════════════════╣
║  本地访问: http://localhost:${PORT}                ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = server;
