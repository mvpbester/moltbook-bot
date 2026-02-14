require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 38888;
const LOG_FILE = path.join(__dirname, '..', 'logs', 'bot.log');

// 从日志获取统计
function getStatsFromLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return { posts: 0, interactions: 0, newPosts: 0, lastUpdate: null };
    }
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let posts = 0;
    let interactions = 0;
    let newPosts = 0;
    let lastUpdate = null;
    
    lines.forEach(line => {
      if (line.includes('[LEARN]')) posts++;
      if (line.includes('[INTERACT]') && line.includes('成功')) interactions++;
      if (line.includes('[POST]') && line.includes('成功')) newPosts++;
      
      // 更新时间
      const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      if (timeMatch) lastUpdate = timeMatch[1];
    });
    
    return { posts, interactions, newPosts, lastUpdate };
  } catch (e) {
    return { posts: 0, interactions: 0, newPosts: 0, lastUpdate: null };
  }
}

// 解析帖子链接（只显示浏览过的帖子）
function parsePostLinks() {
  const posts = [];
  try {
    if (!fs.existsSync(LOG_FILE)) return posts;
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      if (!line.includes('[LEARN]')) return;
      
      const linkMatch = line.match(/https?:\/\/[^\s]+post\/[a-zA-Z0-9-]+/);
      if (linkMatch) {
        const url = linkMatch[0];
        // 提取帖子ID作为标题
        const idMatch = url.match(/post\/([a-zA-Z0-9-]+)/);
        const title = idMatch ? `帖子 ${idMatch[1].substring(0, 8)}...` : '帖子';
        
        const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
        const time = timeMatch ? timeMatch[1] : '';
        
        if (!posts.find(p => p.url === url)) {
          posts.push({ url, title, time });
        }
      }
    });
    
    return posts.reverse().slice(0, 50); // 最近50条
  } catch (e) {
    return [];
  }
}

// 获取最近活动
function getRecentActivity(limit = 30) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.slice(-limit).reverse();
  } catch (e) {
    return [];
  }
}

// HTML模板
function generateHTML() {
  const stats = getStatsFromLog();
  const posts = parsePostLinks();
  const activity = getRecentActivity(30);
  
  const postsHtml = posts.map(p => `
    <div class="post-item">
      <span class="post-time">${p.time.substring(11, 16)}</span>
      <a href="${p.url}" target="_blank" class="post-title">${p.title}</a>
      <a href="${p.url}" target="_blank" class="post-link">查看 →</a>
    </div>
  `).join('');
  
  const activityHtml = activity.map(line => `
    <div class="activity-item">
      <span class="time">${line.substring(0, 19)}</span>
      <span class="content">${line.substring(20)}</span>
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
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { text-align: center; padding: 30px 0; }
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
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 30px 0;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .stat-card .value {
      font-size: 3rem;
      font-weight: bold;
      color: #00ff88;
    }
    .stat-card .label {
      color: #888;
      margin-top: 10px;
    }
    .section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
    }
    .section h2 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      color: #00d9ff;
    }
    .posts-list { display: grid; gap: 10px; }
    .post-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 12px 15px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
    }
    .post-time { color: #00ff88; font-size: 0.85rem; min-width: 50px; }
    .post-title {
      flex: 1;
      color: #fff;
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .post-title:hover { color: #00d9ff; }
    .post-link {
      color: #00ff88;
      font-size: 0.85rem;
      text-decoration: none;
      padding: 4px 12px;
      background: rgba(0, 255, 136, 0.2);
      border-radius: 15px;
    }
    .post-link:hover { background: rgba(0, 255, 136, 0.4); }
    .activity-item {
      display: flex;
      gap: 15px;
      padding: 10px 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.85rem;
    }
    .activity-item:hover { background: rgba(255, 255, 255, 0.05); }
    .activity-item .time { color: #00ff88; white-space: nowrap; }
    .activity-item .content { color: #ddd; }
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
    }
    .refresh-btn:hover { transform: scale(1.1); }
    footer { text-align: center; padding: 30px; color: #666; font-size: 0.85rem; }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: 1fr; }
      .post-item { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Moltbook Bot 监控面板</h1>
      <span class="status">● 在线运行中</span>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${stats.posts}</div>
        <div class="label">浏览帖子</div>
      </div>
      <div class="stat-card">
        <div class="value">${stats.interactions}</div>
        <div class="label">互动次数</div>
      </div>
      <div class="stat-card">
        <div class="value">${stats.newPosts}</div>
        <div class="label">发布帖子</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📝 最近浏览的帖子</h2>
      <div class="posts-list">
        ${postsHtml || '<p style="color:#666">暂无帖子记录</p>'}
      </div>
    </div>
    
    <div class="section">
      <h2>📊 最近活动</h2>
      ${activityHtml || '<p style="color:#666">暂无活动记录</p>'}
    </div>
  </div>
  
  <button class="refresh-btn" onclick="location.reload()">🔄</button>
  
  <footer>
    <p>最后更新: ${stats.lastUpdate || '等待中...'} | <a href="#" onclick="location.reload();return false">刷新</a></p>
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
    res.end(JSON.stringify(getStatsFromLog()));
  } else if (req.url === '/api/posts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(parsePostLinks()));
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
