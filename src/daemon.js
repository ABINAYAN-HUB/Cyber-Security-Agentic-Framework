// Jarvis Cyber — Daemon / Heartbeat System
// Persistent background process with auto-learning, task execution, and Telegram bot
import cron from 'node-cron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Agent } from './agent.js';
import config from './config.js';
import { memory } from './memory.js';
import { autoLearner } from './auto-learner.js';

export class Daemon {
  constructor() {
    this.agent = null;
    this.telegramBot = null;
    this.heartbeatJob = null;
    this.learningJob = null;
    this.isRunning = false;
    this._heartbeatRunning = false;
  }

  async start() {
    console.log('🔄 Jarvis Cyber Daemon starting...');
    
    // Initialize memory
    try { memory.init(); } catch {}

    // Create output directory
    if (!existsSync(config.outputDir)) {
      mkdirSync(config.outputDir, { recursive: true });
    }

    // Create heartbeat file if missing
    if (!existsSync(config.heartbeatFile)) {
      writeFileSync(config.heartbeatFile, `# Jarvis Heartbeat Tasks\n\n## Pending Tasks\n\n_No tasks queued. Add tasks here and the daemon will pick them up._\n`);
    }

    // Start Telegram bot if token is available
    if (config.telegramToken) {
      try {
        const { TelegramInterface } = await import('./telegram-bot.js');
        this.telegramBot = new TelegramInterface();
        await this.telegramBot.start();
        console.log('✅ Telegram bot active in daemon mode');
      } catch (err) {
        console.error(`⚠️ Telegram bot failed to start: ${err.message}`);
      }
    }

    // Create shared agent instance
    this.agent = new Agent(process.cwd());

    // ═══ HEARTBEAT CRON — Task execution ═══
    this.heartbeatJob = cron.schedule(config.heartbeatCron, () => {
      this._heartbeat();
    });

    // ═══ AUTO-LEARNING CRON — Cyber intelligence ═══
    if (config.learningEnabled) {
      this.learningJob = cron.schedule(config.learningCron, async () => {
        console.log('\n🧠 [Daemon] Auto-learning cycle triggered by cron...');
        try {
          await autoLearner.run();
        } catch (err) {
          console.error(`❌ [Daemon] Auto-learning error: ${err.message}`);
        }
      });
      console.log(`✅ Auto-learning enabled. Schedule: ${config.learningCron}`);
    }

    this.isRunning = true;
    console.log(`✅ Daemon running. Heartbeat: ${config.heartbeatCron}`);
    console.log(`📝 Add tasks to: ${config.heartbeatFile}`);

    // ═══ DEFERRED START: Wait 2 minutes before first auto-learn to avoid burning API quota on startup ═══
    if (config.learningEnabled) {
      console.log('\n⏳ First auto-learning cycle will run in 2 minutes (deferred to save API quota)...');
      setTimeout(async () => {
        console.log('\n🚀 Running initial auto-learning cycle (deferred)...');
        try {
          await autoLearner.run();
        } catch (err) {
          console.error(`⚠️ Initial auto-learning error: ${err.message}`);
        }
      }, 120000); // 2 minute delay
    }

    // Initial heartbeat
    await this._heartbeat();

    // Keep process alive
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  async _heartbeat() {
    if (this._heartbeatRunning) {
      console.log('⏳ Previous heartbeat still running, skipping...');
      return;
    }

    this._heartbeatRunning = true;

    try {
      console.log(`\n💓 Heartbeat at ${new Date().toISOString()}`);

      // Check heartbeat file for tasks
      if (existsSync(config.heartbeatFile)) {
        try {
          const content = readFileSync(config.heartbeatFile, 'utf-8');
          const tasks = this._parseTasks(content);
          
          for (const task of tasks) {
            console.log(`  📋 Executing task: ${task}`);
            try {
              await this.agent.processMessage(task);
              
              if (this.telegramBot?.bot && config.telegramAllowedIds.length > 0) {
                const notifyId = config.telegramAllowedIds[0];
                await this.telegramBot.bot.sendMessage(notifyId, `✅ Heartbeat task completed:\n${task}`);
              }
            } catch (err) {
              console.error(`  ❌ Task failed: ${err.message}`);
            }
          }

          if (tasks.length > 0) {
            writeFileSync(config.heartbeatFile, `# Jarvis Heartbeat Tasks\n\n## Pending Tasks\n\n_No tasks queued._\n\n## Last Run: ${new Date().toISOString()}\nCompleted ${tasks.length} tasks.\n`);
          }
        } catch (err) {
          console.error(`  ❌ Heartbeat file error: ${err.message}`);
        }
      }

      // Check database task queue
      try {
        const pendingTasks = memory.getPendingTasks();
        for (const task of pendingTasks) {
          console.log(`  📋 DB Task #${task.id}: ${task.description}`);
          try {
            await this.agent.processMessage(task.description);
            memory.completeTask(task.id, 'completed');
          } catch (err) {
            memory.completeTask(task.id, `failed: ${err.message}`);
          }
        }
      } catch {}
    } finally {
      this._heartbeatRunning = false;
    }
  }

  _parseTasks(content) {
    const tasks = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-*]\s*\[\s*\]\s*(.+)/);
      if (match) {
        tasks.push(match[1].trim());
      }
    }
    return tasks;
  }

  stop() {
    console.log('\n🛑 Daemon shutting down...');
    if (this.heartbeatJob) this.heartbeatJob.stop();
    if (this.learningJob) this.learningJob.stop();
    if (this.telegramBot) this.telegramBot.stop();
    try { memory.close(); } catch {}
    this.isRunning = false;
    process.exit(0);
  }
}
