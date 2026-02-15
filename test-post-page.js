const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://moltbook.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 查找所有可能的发帖按钮
  const buttons = await page.$$('button, a');
  console.log(`找到 ${buttons.length} 个按钮/链接`);
  
  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const text = await buttons[i].evaluate(el => el.textContent?.trim() || '');
    const href = await buttons[i].evaluate(el => el.href || '');
    const className = await buttons[i].evaluate(el => el.className || '');
    if (text || href) {
      console.log(`[${i}] text="${text}", href="${href}", class="${className}"`);
    }
  }
  
  await browser.close();
})();
