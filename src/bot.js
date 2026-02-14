require('dotenv').config();
const { chromium } = require('playwright');
const { log } = require('./logger');

class MoltbookBot {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = {
      url: process.env.MOLTBOOK_URL || 'http://moltbook.com',
      username: process.env.MOLTBOOK_USERNAME,
      password: process.env.MOLTBOOK_PASSWORD,
      postsToRead: parseInt(process.env.POSTS_TO_READ) || 5,
      replyChance: parseFloat(process.env.REPLY_CHANCE) || 0.3,
      newPostChance: parseFloat(process.env.NEW_POST_CHANCE) || 0.1,
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO) || 500
    };
  }

  async init() {
    console.log('[初始化] 启动浏览器...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    this.page = await this.context.newPage();
    console.log('[初始化] 浏览器启动成功');
  }

  async login() {
    console.log('[登录] 正在登录论坛...');
    try {
      // 访问登录页面
      await this.page.goto(this.config.url + '/login', { waitUntil: 'networkidle', timeout: 30000 });
      
      // 检查是否已有登录表单
      const usernameInput = await this.page.$('input[name="username"], input[name="email"], input[type="text"], #username, input#username');
      const passwordInput = await this.page.$('input[name="password"], input[type="password"], #password');

      if (usernameInput && passwordInput) {
        console.log('[登录] 找到登录表单，填写信息...');
        await usernameInput.fill(this.config.username);
        await passwordInput.fill(this.config.password);

        // 尝试提交
        const submitButton = await this.page.$('button[type="submit"], button:has-text("Login"), button:has-text("登录"), .btn-primary');
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        }

        console.log('[登录] 登录完成！');
        log('login', '登录成功');
        return true;
      } else {
        // 尝试访问首页看是否已登录
        await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
        console.log('[登录] 已进入首页');
        return true;
      }
    } catch (error) {
      console.error('[登录] 登录过程出错:', error.message);
      // 尝试直接访问首页
      try {
        await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
        return true;
      } catch {
        return false;
      }
    }
  }

  // 智能获取帖子列表（带热度信息）
  async getSmartPostList() {
    return await this.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const postSet = new Set();
      
      // 收集所有帖子链接
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes('/post/') && !href.includes('/comment')) {
          postSet.add(href);
        }
      });
      
      // 尝试获取每个帖子的热度信息
      const posts = Array.from(postSet).slice(0, 30).map(href => {
        // 尝试从页面中找到对应的热度信息
        let votes = 0;
        let comments = 0;
        
        // 查找包含这个链接的元素附近的投票/评论数
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const text = el.textContent || '';
          // 简单的热度估算
          if (text.match(/\d+\s*(upvote|vote|▲|👍)/i)) {
            const match = text.match(/(\d+)/);
            if (match) votes = Math.max(votes, parseInt(match[1]));
          }
        });
        
        return { href, votes, comments };
      });
      
      // 按热度排序（votes 高的在前）
      posts.sort((a, b) => b.votes - a.votes);
      
      return posts.map(p => p.href);
    });
  }

  async learnAndInteract() {
    console.log('[智能学习] 开始浏览和学习帖子...');
    try {
      // 访问首页
      await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 等待帖子加载
      await this.page.waitForTimeout(2000);

      // 智能获取帖子列表
      const postLinks = await this.getSmartPostList();
      
      console.log(`[智能学习] 找到 ${postLinks.length} 个帖子，优先学习热门内容`);

      const postsToVisit = Math.min(postLinks.length, this.config.postsToRead);
      
      for (let i = 0; i < postsToVisit; i++) {
        try {
          const postUrl = postLinks[i];
          
          console.log(`[智能学习] 浏览帖子 ${i + 1}/${postsToVisit}: ${postUrl.substring(postUrl.length - 20)}`);
          log('learn', `浏览帖子: ${postUrl}`);

          // 直接导航到帖子页面
          await this.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 15000 });
          await this.page.waitForTimeout(1500);

          // 随机决定是否投票/互动
          if (Math.random() < this.config.replyChance) {
            await this.interactWithPost();
          }

          // 返回首页继续
          await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 15000 });
          await this.page.waitForTimeout(1000);
          
        } catch (error) {
          console.error(`[智能学习] 浏览帖子 ${i + 1} 出错:`, error.message);
          // 返回首页继续
          try {
            await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 15000 });
          } catch {}
        }
      }

      // 随机决定是否发新帖
      if (Math.random() < this.config.newPostChance) {
        await this.createNewPost();
      }

      console.log('[智能学习] 学习完成！');
    } catch (error) {
      console.error('[智能学习] 学习过程出错:', error.message);
    }
  }

  // 智能分析帖子内容
  async analyzePostContent() {
    return await this.page.evaluate(() => {
      // 获取帖子标题
      const titleEl = document.querySelector('h1, [class*="title"], [class*="header"]');
      const title = titleEl ? titleEl.textContent.trim() : '';
      
      // 获取帖子内容
      const contentEl = document.querySelector('[class*="content"], [class*="body"], article, .post-content');
      const content = contentEl ? contentEl.textContent.trim() : '';
      
      // 获取评论区内容
      const comments = Array.from(document.querySelectorAll('[class*="comment"], .reply-content'))
        .map(el => el.textContent.trim())
        .slice(0, 5);
      
      return { title, content: content.substring(0, 500), comments };
    });
  }

  // 根据帖子内容生成智能回复
  generateSmartReply(postInfo) {
    const { title, content } = postInfo;
    const combined = (title + ' ' + content).toLowerCase();
    
    // 根据帖子内容关键词生成相关回复
    const smartReplies = [
      // 技术相关
      ...(combined.includes('code') || combined.includes('programming') || combined.includes('developer') ? [
        '作为开发者，这个观点很有启发性！',
        '代码层面的分析很到位，学到了',
        '感谢分享开发经验！'
      ] : []),
      
      // 学习相关
      ...(combined.includes('learn') || combined.includes('study') || combined.includes('tutorial') ? [
        '很好的学习资源，收藏了！',
        '感谢分享学习心得',
        '这个教程对我帮助很大'
      ] : []),
      
      // 问题求解
      ...(combined.includes('help') || combined.includes('question') || combined.includes('?') ? [
        '希望你能找到答案！',
        '加油，问题一定能解决',
        '有需要帮助的可以问我'
      ] : []),
      
      // 通用回复
      '很有见地，感谢分享！',
      '学习到了，支持一下',
      '分析得很到位，赞！',
      '受益匪浅，继续加油',
      '说得对！',
      '很棒的内容，收藏了',
      '感谢楼主的分享',
      '支持！很有价值'
    ];
    
    return smartReplies[Math.floor(Math.random() * smartReplies.length)];
  }

  async interactWithPost() {
    try {
      console.log('[智能互动] 正在分析帖子内容...');
      
      // 分析帖子内容
      const postInfo = await this.analyzePostContent();
      console.log(`[智能互动] 帖子标题: ${postInfo.title.substring(0, 30)}...`);
      
      // 记录学习内容
      if (postInfo.title || postInfo.content) {
        log('learn', `学习内容: ${postInfo.title || postInfo.content.substring(0, 50)}`);
      }

      // 尝试点赞 (upvote)
      const upvoteButton = await this.page.$('button[aria-label*="upvote"], button[title*="upvote"], .upvote, button:has-text("▲"), [class*="upvote"]');
      if (upvoteButton) {
        await upvoteButton.click().catch(() => {});
        await this.page.waitForTimeout(500);
        console.log('[智能互动] 已点赞热门帖子');
        log('interact', '点赞成功');
      }

      // 尝试评论/回复（生成智能回复）
      const commentButton = await this.page.$('button:has-text("Comment"), button:has-text("评论"), a:has-text("Comment"), a:has-text("评论"), [class*="comment"]');
      if (commentButton) {
        await commentButton.click().catch(() => {});
        await this.page.waitForTimeout(1000);

        // 查找评论输入框
        const commentInput = await this.page.$('textarea, input[name="comment"], input[placeholder*="comment"], [contenteditable="true"]');
        if (commentInput) {
          // 生成智能回复
          const smartComment = this.generateSmartReply(postInfo);
          await commentInput.fill(smartComment);
          await this.page.waitForTimeout(500);

          // 提交评论
          const submitButton = await this.page.$('button[type="submit"]:has-text("Submit"), button:has-text("Submit"), button:has-text("发送"), .submit');
          if (submitButton) {
            await submitButton.click().catch(() => {});
            await this.page.waitForTimeout(1000);
            console.log(`[智能互动] 已提交智能回复: "${smartComment}"`);
            log('interact', `智能评论: ${smartComment}`);
          }
        }
      }
    } catch (error) {
      console.error('[智能互动] 互动失败:', error.message);
    }
  }

  async createNewPost() {
    try {
      console.log('[发帖] 尝试发布新帖子...');

      // 访问发帖页面 - 更新选择器匹配Moltbook的实际按钮
      const newPostButton = await this.page.$('button:has-text("🆕 New"), button:has-text("New"), button:has-text("New Post"), a[href*="/create"], button:has-text("Create Post"), a:has-text("Create Post")');
      
      if (newPostButton) {
        await newPostButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);

        // 智能生成更有意义的帖子内容
        const topics = [
          { title: '学习打卡 Day ' + Math.floor(Math.random() * 100), content: '今日学习总结：继续钻研中，每天进步一点点！欢迎大家一起交流学习心得～' },
          { title: '新手求问', content: '刚开始学习不久，有几个问题想请教一下社区的大神们：1. 最佳实践是什么？2. 有什么推荐的学习资源吗？感谢！' },
          { title: '分享一个有用的技巧', content: '最近发现一个很有用的技巧，分享给大家。希望对学习有帮助！如果有问题，欢迎讨论～' },
          { title: '读书笔记', content: '阅读了一些优质内容，做个记录：关键要点已整理，欢迎补充和指正！大家一起进步～' },
          { title: '周末学习计划', content: '周末打算集中学习，有一起的吗？可以互相监督打卡！' },
          { title: '问题讨论', content: '对某个话题有一些思考，想和大家讨论一下。期待听到不同的观点！' },
          { title: '资源分享', content: '收集了一些优质学习资源，分享给需要的朋友们。一起加油！' }
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        // 填写标题
        const titleInput = await this.page.$('input[name="title"], input[id="title"], #title, input[placeholder*="title"]');
        if (titleInput) {
          await titleInput.fill(randomTopic.title);
        }

        // 填写内容
        const contentInput = await this.page.$('textarea[name="content"], textarea[id="content"], #content, textarea[placeholder*="content"], [contenteditable="true"]');
        if (contentInput) {
          await contentInput.fill(randomTopic.content);
          await this.page.waitForTimeout(500);
        }

        // 发布帖子
        const submitButton = await this.page.$('button[type="submit"]:has-text("Post"), button:has-text("Submit"), button[type="submit"]:has-text("Create"), .submit-btn');
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForTimeout(2000);
          
          // 获取发布的帖子链接
          const postUrl = this.page.url();
          console.log('[发帖] 发布成功！链接: ' + postUrl);
          log('post', '发布新帖成功: ' + postUrl);
        }
      } else {
        console.log('[发帖] 未找到发帖按钮');
      }
    } catch (error) {
      console.error('[发帖] 发布失败:', error.message);
    }
  }

  async run() {
    try {
      await this.init();
      const loginSuccess = await this.login();
      if (loginSuccess) {
        await this.learnAndInteract();
      }
    } catch (error) {
      console.error('[运行] 执行出错:', error.message);
    } finally {
      await this.close();
    }
  }

  async close() {
    if (this.browser) {
      console.log('[关闭] 关闭浏览器...');
      await this.browser.close();
    }
  }
}

module.exports = MoltbookBot;
