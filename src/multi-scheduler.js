require('dotenv').config();
const cron = require('node-cron');
const { SmartBot, BOT_CONFIGS } = require('./multi-bot');
const { log } = require('./logger');
const { syncToGit } = require('./sync-stats');

// 多Bot调度器
class MultiBotScheduler {
  constructor(botTypes) {
    this.botTypes = botTypes; // ['tech', 'study', 'general']
  }

  async runBots() {
    const now = new Date();
    console.log('\n========================================');
    console.log(`[多Bot调度] 开始执行 - ${now.toLocaleString()}`);
    console.log(`[多Bot调度] 将运行 ${this.botTypes.length} 个Bot`);
    console.log('========================================\n');
    
    log('multi-bot', `开始执行 ${this.botTypes.length} 个Bot`);

    // 依次运行每个Bot（避免同时打开多个浏览器）
    for (const botType of this.botTypes) {
      const config = BOT_CONFIGS[botType];
      console.log(`\n>>> 正在运行: ${config.name} <<<\n`);
      
      const bot = new SmartBot(config);
      await bot.run();
      
      // 每个Bot之间稍作休息
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('\n========================================');
    console.log(`[多Bot调度] 全部完成 - ${now.toLocaleString()}`);
    console.log('========================================\n');
    
    log('multi-bot', '全部Bot执行完成');
    
    // 同步统计数据到 GitHub
    try {
      syncToGit();
    } catch (e) {
      console.log('[同步] 统计同步失败:', e.message);
    }
  }
}

// 配置要运行的Bot类型
const ACTIVE_BOTS = ['tech', 'study', 'general'];

// 定时任务配置
const cronSchedule = process.env.CRON_SCHEDULE || '0 * * * *';

console.log('========================================');
console.log('Moltbook 多Bot调度器');
console.log('========================================');
console.log(`论坛: ${process.env.MOLTBOOK_URL || 'http://moltbook.com'}`);
console.log(`执行计划: 每小时 (${cronSchedule})`);
console.log(`活跃Bot:`);
ACTIVE_BOTS.forEach(bot => {
  const config = BOT_CONFIGS[bot];
  console.log(`  - ${config.name}: ${config.description}`);
});
console.log('========================================\n');

// 立即执行一次
console.log('[调度器] 立即执行一次...\n');
const scheduler = new MultiBotScheduler(ACTIVE_BOTS);
scheduler.runBots();

// 设置定时任务
cron.schedule(cronSchedule, () => {
  scheduler.runBots();
});

console.log('[调度器] 定时任务已启动，等待执行...');
console.log('[提示] 按 Ctrl+C 停止\n');

// 优雅退出
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
