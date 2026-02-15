/**
 * 手动登录脚本 - 保存登录状态供 bot 使用
 * 运行方式: node save-login.js
 * 
 * 步骤:
 * 1. 运行此脚本，会打开浏览器
 * 2. 在浏览器中完成登录（点击邮件中的链接）
 * 3. 按回车键保存登录状态
 * 4. 之后 bot 就可以使用这个登录状态自动发帖
 */

require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  console.log('\n========================================');
  console.log('  Moltbook 登录状态保存工具');
  console.log('========================================\n');
  
  const browser = await chromium.launch({ 
    headless: false,  // 必须可见模式
    slowMo: 100 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const url = process.env.MOLTBOOK_URL || 'http://moltbook.com';
  
  console.log('1. 正在打开登录页面...');
  await page.goto(url + '/login', { waitUntil: 'networkidle' });
  
  // 填写邮箱
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill(process.env.MOLTBOOK_USERNAME);
    console.log(`2. 已填写邮箱: ${process.env.MOLTBOOK_USERNAME}`);
  }
  
  console.log('\n⚠️  请手动操作:');
  console.log('   - 点击 "Send Login Link" 按钮');
  console.log('   - 去邮箱查收登录邮件');
  console.log('   - 点击邮件中的登录链接');
  console.log('   - 确认登录成功后，回到这里按回车键\n');
  
  await new Promise(resolve => {
    rl.question('按回车键保存登录状态...', () => {
      resolve();
    });
  });
  
  // 保存 cookies
  const cookies = await context.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));
  console.log('\n✅ 登录状态已保存到 cookies.json');
  
  // 验证登录状态
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // 尝试找到发帖按钮
  const postBtn = await page.$('button:has-text("New"), a[href*="post/create"]');
  if (postBtn) {
    console.log('✅ 验证成功: 可以找到发帖按钮');
  } else {
    console.log('⚠️  未找到发帖按钮，可能需要检查页面');
  }
  
  await browser.close();
  rl.close();
  
  console.log('\n========================================');
  console.log('  现在可以运行 bot 了:');
  console.log('  node src/multi-bot.js tech');
  console.log('========================================\n');
})();
