require('dotenv').config();
const cron = require('node-cron');
const { sendDailyReport } = require('./send-report');

console.log('========================================');
console.log('Moltbook Bot 每日报告调度器');
console.log('========================================');
console.log('论坛: ' + (process.env.MOLTBOOK_URL || 'http://moltbook.com'));
console.log('执行时间: 每天早上 9:00');
console.log('========================================\n');

// 立即生成一次报告测试
console.log('[日报] 测试生成报告...\n');
sendDailyReport().then(result => {
  console.log('\n测试完成:', result);
});

// 每天早上9点执行
// Cron: 秒 分 时 日 月 周
cron.schedule('0 9 * * *', () => {
  console.log('\n[日报] 定时任务触发，准备生成报告...\n');
  sendDailyReport();
});

console.log('[日报] 调度器已启动，等待每天9点执行...');
console.log('[提示] 按 Ctrl+C 停止\n');

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
