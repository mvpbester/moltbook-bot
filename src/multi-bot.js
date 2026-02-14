require('dotenv').config();
const { chromium } = require('playwright');
const { log } = require('./logger');

// Bot 配置模板
const BOT_CONFIGS = {
  // 技术学习Bot
  tech: {
    name: '技术学习Bot',
    description: '专注于技术类帖子学习',
    postsToRead: 20,        // 每小时浏览20篇
    replyChance: 0.6,       // 60%互动率
    newPostChance: 0.5,     // 50%发帖率
    focusAreas: ['code', 'programming', 'developer', 'tech', 'software', 'AI', 'data']
  },
  // 学习交流Bot
  study: {
    name: '学习交流Bot',
    description: '专注于学习讨论',
    postsToRead: 20,        // 每小时浏览20篇
    replyChance: 0.6,       // 60%互动率
    newPostChance: 0.5,     // 50%发帖率
    focusAreas: ['learn', 'study', 'question', 'help', 'tutorial', 'tips']
  },
  // 综合Bot
  general: {
    name: '综合Bot',
    description: '广泛学习各类内容',
    postsToRead: 20,        // 每小时浏览20篇
    replyChance: 0.5,       // 50%互动率
    newPostChance: 0.5,     // 50%发帖率
    focusAreas: []
  }
};

class SmartBot {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    console.log(`[${this.config.name}] 启动浏览器...`);
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO) || 300
    });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    this.page = await this.context.newPage();
    console.log(`[${this.config.name}] 浏览器启动成功`);
  }

  async login() {
    try {
      const url = process.env.MOLTBOOK_URL || 'http://moltbook.com';
      await this.page.goto(url + '/login', { waitUntil: 'networkidle', timeout: 30000 });
      
      const usernameInput = await this.page.$('input[name="username"], input[name="email"], input[type="text"]');
      const passwordInput = await this.page.$('input[name="password"], input[type="password"]');

      if (usernameInput && passwordInput) {
        await usernameInput.fill(process.env.MOLTBOOK_USERNAME);
        await passwordInput.fill(process.env.MOLTBOOK_PASSWORD);
        
        const submitButton = await this.page.$('button[type="submit"], button:has-text("Login")');
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        }
      }
      
      await this.page.goto(process.env.MOLTBOOK_URL || 'http://moltbook.com', { waitUntil: 'networkidle' });
      console.log(`[${this.config.name}] 登录成功`);
      return true;
    } catch (error) {
      console.error(`[${this.config.name}] 登录失败:`, error.message);
      return false;
    }
  }

  // 智能筛选相关帖子
  async getRelevantPosts() {
    const postLinks = await this.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      return allLinks
        .map(link => link.getAttribute('href'))
        .filter(href => href && href.includes('/post/'))
        .slice(0, 30);
    });
    
    // 如果有专注领域，优先选择相关的
    if (this.config.focusAreas && this.config.focusAreas.length > 0) {
      // 访问几个帖子检查内容
      const relevantPosts = [];
      for (const url of postLinks.slice(0, 10)) {
        try {
          await this.page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
          await this.page.waitForTimeout(500);
          
          const content = await this.page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent || '';
            const body = document.querySelector('[class*="content"]')?.textContent || '';
            return (title + ' ' + body).toLowerCase();
          });
          
          // 检查是否匹配专注领域
          for (const area of this.config.focusAreas) {
            if (content.includes(area)) {
              relevantPosts.push(url);
              break;
            }
          }
          
          // 返回首页继续
          await this.page.goto(process.env.MOLTBOOK_URL || 'http://moltbook.com', { waitUntil: 'networkidle' });
        } catch (e) {}
      }
      
      // 如果找到相关帖子，返回它们；否则返回全部
      return relevantPosts.length > 0 ? relevantPosts : postLinks.slice(0, this.config.postsToRead);
    }
    
    return postLinks.slice(0, this.config.postsToRead);
  }

  // 创建帖子
  async createPost() {
    try {
      console.log(`[${this.config.name}] 尝试发帖...`);
      
      await this.page.goto((process.env.MOLTBOOK_URL || 'http://moltbook.com') + '/post/create', { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      await this.page.waitForTimeout(1000);
      
      // 根据Bot类型生成不同主题
      const topics = {
        '技术学习Bot': ['分享一个编程小技巧', 'AI工具推荐', '开发心得'],
        '学习交流Bot': ['学习方法分享', '今日学习总结', '求助：学习问题'],
        '综合Bot': ['今日思考', '生活感悟', '综合分享']
      };
      
      const titles = topics[this.config.name] || topics['综合Bot'];
      const title = titles[Math.floor(Math.random() * titles.length)] + ` - ${new Date().toLocaleDateString()}`;
      
      const contents = [
        '今天学到了很多，分享给大家。',
        '这是一个测试帖子，欢迎大家交流。',
        '分享一下今天的收获和感悟。',
        '最近在研究这个话题，欢迎大家讨论。'
      ];
      const content = contents[Math.floor(Math.random() * contents.length)];
      
      // 填写表单
      const titleInput = await this.page.$('input[name="title"], input[placeholder*="标题"], input[type="text"]');
      const contentInput = await this.page.$('textarea[name="content"], textarea[placeholder*="内容"], textarea');
      
      if (titleInput && contentInput) {
        await titleInput.fill(title);
        await contentInput.fill(content);
        
        // 提交
        const submitBtn = await this.page.$('button[type="submit"], button:has-text("发布"), button:has-text("提交")');
        if (submitBtn) {
          await submitBtn.click();
          await this.page.waitForTimeout(2000);
          
          // 记录成功
          const currentUrl = this.page.url();
          if (currentUrl.includes('/post/')) {
            log(this.config.name, `[POST] 发帖成功: ${currentUrl}`);
            console.log(`[${this.config.name}] 发帖成功: ${currentUrl}`);
            return currentUrl;
          }
        }
      }
      
      console.log(`[${this.config.name}] 未找到发帖表单`);
      return null;
    } catch (error) {
      console.error(`[${this.config.name}] 发帖失败:`, error.message);
      return null;
    }
  }

  // 生成智能回复
  generateReply(postContent) {
    const content = postContent.toLowerCase();
    const replies = [];
    
    if (content.includes('code') || content.includes('programming')) {
      replies.push('作为开发者，很认同你的观点！');
      replies.push('代码层面的分析很到位，学到了');
    }
    if (content.includes('learn') || content.includes('study')) {
      replies.push('很好的学习资源，收藏了！');
      replies.push('感谢分享学习心得');
    }
    if (content.includes('help') || content.includes('question')) {
      replies.push('希望你能找到答案！');
      replies.push('加油，问题一定能解决');
    }
    
    // 通用回复
    replies.push('很有见地，感谢分享！');
    replies.push('学习到了，支持一下');
    replies.push('分析得很到位，赞！');
    
    return replies[Math.floor(Math.random() * replies.length)];
  }

  async run() {
    try {
      await this.init();
      const loginSuccess = await this.login();
      
      if (loginSuccess) {
        console.log(`[${this.config.name}] 开始学习...`);
        
        // 获取帖子列表
        await this.page.goto(process.env.MOLTBOOK_URL || 'http://moltbook.com', { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);
        
        const posts = await this.getRelevantPosts();
        console.log(`[${this.config.name}] 找到 ${posts.length} 个帖子`);
        
        const postsToVisit = Math.min(posts.length, this.config.postsToRead);
        
        for (let i = 0; i < postsToVisit; i++) {
          try {
            await this.page.goto(posts[i], { waitUntil: 'networkidle', timeout: 15000 });
            await this.page.waitForTimeout(1000);
            
            // 获取帖子标题和板块
            const pageInfo = await this.page.evaluate(() => {
              const title = document.querySelector('h1')?.textContent?.trim() || '无标题';
              // 尝试获取板块信息
              const category = document.querySelector('[class*="category"], [class*="tag"], [class*="board"]')?.textContent?.trim() || '';
              return { title, category };
            });
            
            // 记录学习（包含标题和板块）
            const logMsg = pageInfo.category 
              ? `学习 [${pageInfo.category}] ${pageInfo.title}: ${posts[i]}`
              : `学习 ${pageInfo.title}: ${posts[i]}`;
            log(this.config.name, logMsg);
            
            // 互动
            if (Math.random() < this.config.replyChance) {
              const upvoteBtn = await this.page.$('button[aria-label*="upvote"], button:has-text("▲")');
              if (upvoteBtn) {
                await upvoteBtn.click().catch(() => {});
                console.log(`[${this.config.name}] 点赞`);
              }
            }
            
            // 返回首页
            await this.page.goto(process.env.MOLTBOOK_URL || 'http://moltbook.com', { waitUntil: 'networkidle' });
            await this.page.waitForTimeout(500);
            
          } catch (e) {
            console.error(`[${this.config.name}] 浏览出错:`, e.message);
          }
        }
        
        // 发帖
        if (Math.random() < this.config.newPostChance) {
          await this.createPost();
        }
        
        console.log(`[${this.config.name}] 学习完成！`);
      }
    } catch (error) {
      console.error(`[${this.config.name}] 运行错误:`, error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 运行指定方向的Bot
async function runBot(botType) {
  const config = BOT_CONFIGS[botType];
  if (!config) {
    console.error('无效的Bot类型。可用类型:', Object.keys(BOT_CONFIGS).join(', '));
    return;
  }
  
  console.log(`\n========== 启动 ${config.name} ==========\n`);
  console.log(`描述: ${config.description}`);
  console.log(`配置: 浏览${config.postsToRead}篇, 回复${config.replyChance*100}%, 发帖${config.newPostChance*100}%`);
  
  const bot = new SmartBot(config);
  await bot.run();
  
  console.log(`\n========== ${config.name} 完成 ==========\n`);
}

// 从命令行参数获取Bot类型
const botType = process.argv[2] || 'general';
runBot(botType);

module.exports = { SmartBot, BOT_CONFIGS };
