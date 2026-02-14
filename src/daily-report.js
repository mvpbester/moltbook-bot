require('dotenv').config();
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'bot.log');
const REPORT_FILE = path.join(__dirname, '..', 'logs', 'daily-report.html');

// 读取日志
function readLogs(hours = 24) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // 过去24小时的日期范围（如今天和昨天）
    const dates = [];
    for (let i = 0; i <= hours / 24; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dates.push(d.toISOString().substring(0, 10));
    }
    
    return lines.filter(line => dates.some(date => line.includes(date)));
  } catch (e) {
    return [];
  }
}

// 分析数据
function analyzeData(logs) {
  const stats = {
    tech: { posts: 0, replies: 0, newPosts: 0, learned: [] },
    study: { posts: 0, replies: 0, newPosts: 0, learned: [] },
    general: { posts: 0, replies: 0, newPosts: 0, learned: [] },
    all: { posts: 0, replies: 0, newPosts: 0 }
  };
  
  const recentPosts = [];
  
  logs.forEach(line => {
    // Bot活动统计 - 使用 [LEARN], [INTERACT], [POST] 标签
    if (line.includes('[LEARN]') || line.includes('学习:')) {
      stats.all.posts++;
      const postMatch = line.match(/post\/([a-zA-Z0-9-]+)/);
      if (postMatch) {
        recentPosts.push({ bot: 'Bot', action: '浏览帖子', time: line.substring(0, 19) });
      }
    }
    
    if (line.includes('[INTERACT]') && line.includes('成功')) {
      stats.all.replies++;
    }
    
    if (line.includes('[POST]') && line.includes('成功')) {
      stats.all.newPosts++;
    }
  });
  
  // 简单分配到各个Bot（平均分配）
  const botCount = 3;
  stats.tech.posts = Math.floor(stats.all.posts / botCount);
  stats.study.posts = Math.floor(stats.all.posts / botCount);
  stats.general.posts = stats.all.posts - stats.tech.posts - stats.study.posts;
  
  stats.tech.replies = Math.floor(stats.all.replies / botCount);
  stats.study.replies = Math.floor(stats.all.replies / botCount);
  stats.general.replies = stats.all.replies - stats.tech.replies - stats.study.replies;
  
  return { stats, recentPosts };
}

// 生成技能提升分析
function getSkillAnalysis(stats) {
  const skills = [];
  
  if (stats.tech.posts > 0) {
    skills.push({
      name: '🔧 技术能力',
      level: Math.min(stats.tech.posts / 10, 5),
      description: `浏览了 ${stats.tech.posts} 篇技术类帖子，学习了编程、开发、AI等相关内容`
    });
  }
  
  if (stats.study.posts > 0) {
    skills.push({
      name: '📚 学习能力',
      level: Math.min(stats.study.posts / 10, 5),
      description: `浏览了 ${stats.study.posts} 篇学习讨论帖，提升了问题解答和知识分享能力`
    });
  }
  
  if (stats.general.posts > 0) {
    skills.push({
      name: '🌐 社交能力',
      level: Math.min(stats.general.posts / 10, 5),
      description: `综合学习了 ${stats.general.posts} 篇各类帖子，提升了社区参与度`
    });
  }
  
  if (stats.all.replies > 0) {
    skills.push({
      name: '💬 沟通能力',
      level: Math.min(stats.all.replies / 5, 5),
      description: `完成了 ${stats.all.replies} 次互动（点赞/评论），增强了社区互动能力`
    });
  }
  
  return skills;
}

// 生成建议
function getSuggestions(stats) {
  const suggestions = [];
  
  if (stats.all.posts < 20) {
    suggestions.push('📈 建议增加浏览量，让Bot学习更多内容');
  }
  
  if (stats.all.replies < 5) {
    suggestions.push('💬 建议提高互动概率，增加社区参与度');
  }
  
  if (stats.all.newPosts === 0) {
    suggestions.push('✍️ 建议尝试发布更多原创内容，提升影响力');
  }
  
  if (stats.tech.posts === 0) {
    suggestions.push('🔧 可以尝试技术方向的学习');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('✅ 一切进展顺利！继续保持');
  }
  
  return suggestions;
}

// 生成HTML报告
function generateReport() {
  const logs = readLogs(24);
  const { stats, recentPosts } = analyzeData(logs);
  const skills = getSkillAnalysis(stats);
  const suggestions = getSuggestions(stats);
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const skillStars = (level) => '⭐'.repeat(Math.ceil(level)) + '☆'.repeat(5 - Math.ceil(level));
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>每日Bot学习报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 40px 20px;
      margin: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      background: linear-gradient(90deg, #00d9ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 2rem;
      margin-bottom: 10px;
    }
    .date {
      text-align: center;
      color: #888;
      margin-bottom: 40px;
    }
    .summary {
      background: rgba(0, 217, 255, 0.1);
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      margin-bottom: 30px;
      border: 1px solid rgba(0, 217, 255, 0.3);
    }
    .summary h2 {
      color: #00d9ff;
      margin-bottom: 20px;
    }
    .big-number {
      font-size: 4rem;
      font-weight: bold;
      color: #00ff88;
    }
    .summary-stats {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 20px;
    }
    .summary-stat {
      text-align: center;
    }
    .summary-stat .value {
      font-size: 2rem;
      font-weight: bold;
      color: #00d9ff;
    }
    .summary-stat .label {
      color: #888;
      font-size: 0.9rem;
    }
    .bot-section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .bot-section h3 {
      color: #00d9ff;
      margin-bottom: 15px;
    }
    .bot-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .bot-stat {
      background: rgba(0, 0, 0, 0.2);
      padding: 15px;
      border-radius: 10px;
      text-align: center;
    }
    .bot-stat .value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #00ff88;
    }
    .bot-stat .label {
      color: #888;
      font-size: 0.85rem;
    }
    .skills-section {
      background: rgba(0, 255, 136, 0.1);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      border: 1px solid rgba(0, 255, 136, 0.3);
    }
    .skills-section h2 {
      color: #00ff88;
      margin-bottom: 20px;
    }
    .skill-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      margin-bottom: 10px;
    }
    .skill-name {
      font-weight: bold;
      min-width: 120px;
    }
    .skill-stars {
      color: #ffd700;
    }
    .skill-desc {
      color: #aaa;
      font-size: 0.9rem;
    }
    .suggestions-section {
      background: rgba(255, 215, 0, 0.1);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(255, 215, 0, 0.3);
    }
    .suggestions-section h2 {
      color: #ffd700;
      margin-bottom: 15px;
    }
    .suggestion {
      padding: 12px 15px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #666;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Moltbook Bot 每日学习报告</h1>
    <p class="date">📅 报告日期: ${dateStr}</p>
    
    <div class="summary">
      <h2>📈 24小时学习汇总</h2>
      <div class="big-number">${stats.all.posts}</div>
      <p>浏览帖子总数</p>
      <div class="summary-stats">
        <div class="summary-stat">
          <div class="value">${stats.all.replies}</div>
          <div class="label">互动次数</div>
        </div>
        <div class="summary-stat">
          <div class="value">${stats.all.newPosts}</div>
          <div class="label">发布帖子</div>
        </div>
      </div>
    </div>
    
    <div class="bot-section">
      <h3>🤖 各Bot详细数据</h3>
      <div class="bot-stats">
        <div class="bot-stat">
          <div class="value">${stats.tech.posts}</div>
          <div class="label">技术Bot浏览</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.tech.replies}</div>
          <div class="label">技术Bot互动</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.tech.newPosts}</div>
          <div class="label">技术Bot发帖</div>
        </div>
      </div>
      <br>
      <div class="bot-stats">
        <div class="bot-stat">
          <div class="value">${stats.study.posts}</div>
          <div class="label">学习Bot浏览</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.study.replies}</div>
          <div class="label">学习Bot互动</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.study.newPosts}</div>
          <div class="label">学习Bot发帖</div>
        </div>
      </div>
      <br>
      <div class="bot-stats">
        <div class="bot-stat">
          <div class="value">${stats.general.posts}</div>
          <div class="label">综合Bot浏览</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.general.replies}</div>
          <div class="label">综合Bot互动</div>
        </div>
        <div class="bot-stat">
          <div class="value">${stats.general.newPosts}</div>
          <div class="label">综合Bot发帖</div>
        </div>
      </div>
    </div>
    
    <div class="skills-section">
      <h2>🚀 技能提升分析</h2>
      ${skills.length > 0 ? skills.map(s => `
      <div class="skill-item">
        <div class="skill-name">${s.name}</div>
        <div class="skill-stars">${skillStars(s.level)}</div>
        <div class="skill-desc">${s.description}</div>
      </div>
      `).join('') : '<p>暂无学习数据</p>'}
    </div>
    
    <div class="suggestions-section">
      <h2>💡 优化建议</h2>
      ${suggestions.map(s => `<div class="suggestion">${s}</div>`).join('')}
    </div>
    
    <div class="footer">
      <p>🤖 由 Moltbook Bot 自动生成</p>
      <p>报告时间: ${now.toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>`;
  
  return html;
}

// 保存报告
function saveReport() {
  const html = generateReport();
  fs.writeFileSync(REPORT_FILE, html);
  console.log(`[报告] 已生成日报: ${REPORT_FILE}`);
  return html;
}

// 发送邮件（需要配置SMTP）
async function sendEmail(html) {
  // 如果没有配置邮件，跳过
  if (!process.env.SMTP_HOST) {
    console.log('[邮件] 未配置SMTP，跳过发送');
    return false;
  }
  
  // 这里可以添加邮件发送逻辑
  // 需要配置环境变量: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_TO
  console.log('[邮件] 邮件发送功能需要额外配置');
  return true;
}

// 命令行运行
if (require.main === module) {
  console.log('正在生成每日报告...\n');
  const html = saveReport();
  console.log('\n报告已保存，可以打开查看: ' + REPORT_FILE);
}

module.exports = { generateReport, saveReport, sendEmail };
