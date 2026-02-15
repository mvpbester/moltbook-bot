require('dotenv').config();
const { chromium } = require('playwright');
const { log } = require('./logger');
const fs = require('fs');
const path = require('path');

// Cookie 存储路径
const COOKIE_FILE = path.join(__dirname, '..', 'cookies.json');

// 保存 cookies
async function saveCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log('[Cookie] 登录状态已保存');
  } catch (e) {
    console.error('[Cookie] 保存失败:', e.message);
  }
}

// 加载 cookies
async function loadCookies(context) {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
      await context.addCookies(cookies);
      console.log('[Cookie] 登录状态已加载');
      return true;
    }
  } catch (e) {
    console.error('[Cookie] 加载失败:', e.message);
  }
  return false;
}

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
    
    // 加载已保存的登录状态
    const hasCookies = await loadCookies(this.context);
    
    this.page = await this.context.newPage();
    console.log(`[${this.config.name}] 浏览器启动成功`);
    return hasCookies;
  }

  async login(hasCookies) {
    try {
      const url = process.env.MOLTBOOK_URL || 'http://moltbook.com';
      
      // 如果有 cookies，先检查是否已登录
      if (hasCookies) {
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await this.page.waitForTimeout(1000);
        
        // 检查是否已登录（看是否有用户相关元素）
        const userElement = await this.page.$('a[href*="dashboard"], button:has-text("New"), [data-testid="user-menu"]');
        if (userElement) {
          console.log(`[${this.config.name}] 使用已保存的登录状态`);
          return true;
        }
        console.log(`[${this.config.name}] Cookie 已过期，需要重新登录`);
      }
      
      // 需要重新登录 - 使用邮件魔法链接
      console.log(`[${this.config.name}] 需要登录，请手动操作...`);
      console.log(`[${this.config.name}] 访问: ${url}/login`);
      console.log(`[${this.config.name}] 邮箱: ${process.env.MOLTBOOK_USERNAME}`);
      
      await this.page.goto(url + '/login', { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(2000);
      
      // 填写邮箱
      const emailInput = await this.page.$('input[type="email"], input[placeholder*="email"]');
      if (emailInput) {
        await emailInput.fill(process.env.MOLTBOOK_USERNAME);
        console.log(`[${this.config.name}] 已填写邮箱，等待手动点击登录链接...`);
        
        // 暂停等待用户手动完成登录
        console.log(`[${this.config.name}] ⚠️ 请手动点击邮件中的登录链接，然后按回车继续...`);
        
        // 非交互模式下，跳过登录
        if (process.env.HEADLESS !== 'false') {
          console.log(`[${this.config.name}] 无头模式跳过登录`);
          return false;
        }
        
        // 等待一段时间看是否已登录
        await this.page.waitForTimeout(30000); // 等待30秒
      }
      
      // 尝试保存登录状态
      await saveCookies(this.context);
      
      await this.page.goto(url, { waitUntil: 'networkidle' });
      console.log(`[${this.config.name}] 登录成功`);
      return true;
    } catch (error) {
      console.error(`[${this.config.name}] 登录失败:`, error.message);
      return false;
    }
  }

  // 智能筛选相关帖子
  async getRelevantPosts() {
    const baseUrl = process.env.MOLTBOOK_URL || 'http://moltbook.com';
    
    const postLinks = await this.page.evaluate((base) => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      return allLinks
        .map(link => {
          const href = link.getAttribute('href');
          // 确保返回完整URL
          if (href && href.includes('/post/')) {
            return href.startsWith('http') ? href : base + href;
          }
          return null;
        })
        .filter(href => href)
        .slice(0, 30);
    }, baseUrl);
    
    // 去重
    const uniqueLinks = [...new Set(postLinks)];
    
    // 如果有专注领域，优先选择相关的
    if (this.config.focusAreas && this.config.focusAreas.length > 0) {
      const relevantPosts = [];
      for (const url of uniqueLinks.slice(0, 10)) {
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
          await this.page.goto(baseUrl, { waitUntil: 'networkidle' });
        } catch (e) {}
      }
      
      return relevantPosts.length > 0 ? relevantPosts : uniqueLinks.slice(0, this.config.postsToRead);
    }
    
    return uniqueLinks.slice(0, this.config.postsToRead);
  }

  // 创建帖子
  async createPost() {
    try {
      console.log(`[${this.config.name}] 尝试发帖...`);
      
      const baseUrl = process.env.MOLTBOOK_URL || 'http://moltbook.com';
      const postUrl = baseUrl + '/post/create';
      console.log(`[${this.config.name}] 访问发帖页面: ${postUrl}`);
      
      await this.page.goto(postUrl, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      // 等待更长时间确保页面加载
      await this.page.waitForTimeout(3000);
      
      // 检查当前URL
      const currentUrl = this.page.url();
      console.log(`[${this.config.name}] 当前页面URL: ${currentUrl}`);
      
      // 如果URL变了，说明可能被重定向了
      if (!currentUrl.includes('/post/create')) {
        console.log(`[${this.config.name}] 被重定向，尝试寻找发帖按钮...`);
        // 尝试点击发帖按钮
        const newPostBtn = await this.page.$('a[href*="post/create"], button:has-text("New"), button:has-text("发帖"), button:has-text("发布")');
        if (newPostBtn) {
          await newPostBtn.click();
          await this.page.waitForTimeout(3000);
        }
      }
      
      // 截图调试
      await this.page.screenshot({ path: `debug-post-${Date.now()}.png` });
      console.log(`[${this.config.name}] 已截图保存`);
      
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
      
      // 获取页面所有可能的输入元素
      const inputs = await this.page.$$('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');
      console.log(`[${this.config.name}] 找到 ${inputs.length} 个输入元素`);
      
      let titleInput = null;
      let contentInput = null;
      
      // 分析每个输入元素
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        const inputType = await input.evaluate(el => el.type || 'text');
        const name = await input.evaluate(el => el.name || '');
        const placeholder = await input.evaluate(el => el.placeholder || '');
        const contenteditable = await input.evaluate(el => el.contentEditable);
        
        console.log(`[${this.config.name}] 输入元素 ${i}: tag=${tagName}, type=${inputType}, name=${name}, placeholder=${placeholder}, contenteditable=${contenteditable}`);
        
        // 判断是否为标题输入框
        if (!titleInput && (
          name.toLowerCase().includes('title') ||
          placeholder.toLowerCase().includes('title') ||
          placeholder.includes('标题') ||
          (i === 0 && tagName === 'input') // 第一个input通常是标题
        )) {
          titleInput = input;
          console.log(`[${this.config.name}] → 识别为标题输入框`);
        }
        // 判断是否为内容输入框
        else if (!contentInput && (
          name.toLowerCase().includes('content') ||
          name.toLowerCase().includes('body') ||
          placeholder.toLowerCase().includes('content') ||
          placeholder.includes('内容') ||
          placeholder.includes('正文') ||
          tagName === 'textarea' ||
          contenteditable === 'true'
        )) {
          contentInput = input;
          console.log(`[${this.config.name}] → 识别为内容输入框`);
        }
      }
      
      // 如果还没找到，使用位置判断（第一个input是标题，第二个textarea或contenteditable是内容）
      if (!titleInput && inputs.length > 0) {
        titleInput = inputs[0];
        console.log(`[${this.config.name}] 使用第一个输入元素作为标题`);
      }
      if (!contentInput && inputs.length > 1) {
        contentInput = inputs[1];
        console.log(`[${this.config.name}] 使用第二个输入元素作为内容`);
      }
      
      if (titleInput && contentInput) {
        await titleInput.fill(title);
        await contentInput.fill(content);
        
        await this.page.waitForTimeout(500);
        
        // 提交 - 尝试多种按钮选择器
        const submitSelectors = [
          'button[type="submit"]',
          'button:has-text("发布")',
          'button:has-text("提交")',
          'button:has-text("Post")',
          'button:has-text("Submit")',
          'input[type="submit"]',
          'button[class*="submit"]',
          'button[class*="post"]',
          'button'
        ];
        
        let submitBtn = null;
        for (const selector of submitSelectors) {
          const btn = await this.page.$(selector);
          if (btn) {
            const btnText = await btn.evaluate(el => el.textContent);
            console.log(`[${this.config.name}] 找到按钮: ${selector} - ${btnText}`);
            if (!submitBtn) submitBtn = btn;
          }
        }
        
        if (submitBtn) {
          await submitBtn.click();
          await this.page.waitForTimeout(3000);
          
          // 记录成功
          const currentUrl = this.page.url();
          if (currentUrl.includes('/post/')) {
            log(this.config.name, `[POST] 发帖成功: ${currentUrl}`);
            console.log(`[${this.config.name}] 发帖成功: ${currentUrl}`);
            return currentUrl;
          } else {
            console.log(`[${this.config.name}] 发帖后URL: ${currentUrl}`);
          }
        } else {
          console.log(`[${this.config.name}] 未找到提交按钮`);
        }
      } else {
        console.log(`[${this.config.name}] 未找到表单: title=${!!titleInput}, content=${!!contentInput}`);
        // 截图调试
        await this.page.screenshot({ path: `debug-post-${Date.now()}.png` });
      }
      
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
      const hasCookies = await this.init();
      const loginSuccess = await this.login(hasCookies);
      
      if (loginSuccess) {
        // 登录成功后保存 cookies
        await saveCookies(this.context);
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
