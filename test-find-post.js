require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 先截图登录页面
  await page.goto('http://moltbook.com/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'debug-login.png' });
  
  // 查找所有输入框
  const inputs = await page.$$('input');
  console.log('登录页面输入框:');
  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].evaluate(el => el.type);
    const name = await inputs[i].evaluate(el => el.name);
    const placeholder = await inputs[i].evaluate(el => el.placeholder);
    console.log(`  [${i}] type=${type}, name=${name}, placeholder=${placeholder}`);
  }
  
  await browser.close();
})();
