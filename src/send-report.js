require('dotenv').config();
const nodemailer = require('nodemailer');
const { generateReport, saveReport } = require('./daily-report');

// 邮件发送配置
const mailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const FROM_EMAIL = process.env.SMTP_USER || 'noreply@moltbook.com';
const TO_EMAIL = process.env.EMAIL_TO || process.env.MOLTBOOK_USERNAME;

async function sendDailyReport() {
  console.log('\n' + '='.repeat(50));
  console.log('[日报] 开始生成每日学习报告...');
  console.log('='.repeat(50) + '\n');
  
  // 确保 logs 目录存在
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // 生成报告
  const html = generateReport();
  const reportPath = path.join(logsDir, 'daily-report.html');
  
  // 保存报告文件
  fs.writeFileSync(reportPath, html);
  console.log(`[日报] 报告已保存: ${reportPath}`);
  
  // 发送邮件
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[日报] 未配置邮件，报告已保存到文件');
    console.log('[日报] 可在浏览器打开查看: file://' + reportPath);
    return { success: true, reportPath };
  }
  
  try {
    // 创建邮件传输器
    const transporter = nodemailer.createTransport(mailConfig);
    
    // 邮件内容
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const mailOptions = {
      from: `"Moltbook Bot" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject: `Moltbook Bot 每日学习报告 - ${dateStr}`,
      html: html,
      text: `您的Bot每日学习报告已生成。详细内容请查看HTML报告。`
    };
    
    // 发送邮件
    const info = await transporter.sendMail(mailOptions);
    console.log('[日报] 邮件发送成功!');
    console.log(`[日报] 收件人: ${TO_EMAIL}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[日报] 邮件发送失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 命令行直接运行
if (require.main === module) {
  sendDailyReport().then(() => process.exit(0));
}

module.exports = { sendDailyReport };
