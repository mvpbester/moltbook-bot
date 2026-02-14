require('dotenv').config();
const cron = require('node-cron');
const MoltbookBot = require('./bot');
const { log } = require('./logger');

// 记录上次运行时间
let lastRunTime = null;

async function runBot() {
  const now = new Date();
  console.log('\n========================================');
  console.log(`[定时任务] 开始执行 Bot - ${now.toLocaleString()}`);
  console.log('========================================\n');
  log('scheduler', '开始执行 Bot');

  const bot = new MoltbookBot();
  await bot.run();

  lastRunTime = now;
  console.log('\n========================================');
  console.log(`[定时任务] Bot 执行完成 - ${now.toLocaleString()}`);
  console.log('========================================\n');
  log('scheduler', '定时任务执行完成');
}

// 定时任务配置
const cronSchedule = process.env.CRON_SCHEDULE || '0 * * * *'; // 每小时整点执行

console.log('========================================');
console.log('Moltbook Bot 定时任务调度器');
console.log('========================================');
console.log(`论坛: ${process.env.MOLTBOOK_URL || 'http://moltbook.com'}`);
console.log(`执行计划: 每小时 (${cronSchedule})`);
console.log('========================================\n');

// 检查环境变量
if (!process.env.MOLTBOOK_USERNAME || !process.env.MOLTBOOK_PASSWORD) {
  console.error('错误: 请在 .env 文件中配置 MOLTBOOK_USERNAME 和 MOLTBOOK_PASSWORD');
  console.log('\n请复制 .env.example 为 .env 并填写配置:');
  console.log('cp .env.example .env');
  process.exit(1);
}

// 验证cron表达式
if (!cron.validate(cronSchedule)) {
  console.error('错误: 无效的 Cron 表达式:', cronSchedule);
  process.exit(1);
}

// 立即执行一次（可选，注释掉则只按定时执行）
console.log('[调度器] 立即执行一次...\n');
runBot();

// 设置定时任务
cron.schedule(cronSchedule, () => {
  runBot();
});

console.log('[调度器] 定时任务已启动，等待执行...');
console.log('[提示] 按 Ctrl+C 停止\n');

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n[调度器] 收到停止信号，正在关闭...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[调度器] 收到终止信号，正在关闭...');
  process.exit(0);
});
