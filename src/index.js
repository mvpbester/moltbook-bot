require('dotenv').config();
const MoltbookBot = require('./bot');

async function main() {
  console.log('========================================');
  console.log('Moltbook Bot 启动');
  console.log('========================================\n');

  // 检查环境变量
  if (!process.env.MOLTBOOK_USERNAME || !process.env.MOLTBOOK_PASSWORD) {
    console.error('错误: 请在 .env 文件中配置 MOLTBOOK_USERNAME 和 MOLTBOOK_PASSWORD');
    console.log('\n请复制 .env.example 为 .env 并填写配置:');
    console.log('cp .env.example .env');
    process.exit(1);
  }

  const bot = new MoltbookBot();
  await bot.run();

  console.log('\n========================================');
  console.log('Bot 执行完成');
  console.log('========================================\n');
}

main().catch(console.error);
