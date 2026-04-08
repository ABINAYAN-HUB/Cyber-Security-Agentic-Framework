// OpenClaw Cyber — Interactive REPL
import readline from 'readline';
import { Agent } from './agent.js';
import { checkServer } from './api.js';
import { toolDefinitions } from './tools/index.js';
import config from './config.js';
import { memory } from './memory.js';
import { skillsManager } from './skills-manager.js';
import * as ui from './ui.js';

export async function startRepl(cwd, options = {}) {
  // Print welcome banner
  ui.printBanner();

  // Initialize memory
  try {
    memory.init();
    ui.printInfo('🧠 Persistent memory loaded.');
  } catch (err) {
    ui.printWarning(`Memory init: ${err.message}`);
  }

  // Initialize skills
  try {
    skillsManager.init();
    const skills = skillsManager.getAllSkills();
    if (skills.length > 0) {
      ui.printInfo(`📦 ${skills.length} skills loaded.`);
    }
  } catch {}

  // Check NVIDIA NIM connection
  const spinner = ui.createSpinner('Connecting to NVIDIA NIM...');
  spinner.start();
  
  const serverCheck = await checkServer();
  spinner.stop();

  if (!serverCheck.ok) {
    ui.printError(`Cannot connect to NVIDIA NIM at ${config.baseUrl}`);
    console.log(ui.colors.muted('  Make sure your NVIDIA API key is set in .env'));
    console.log(ui.colors.muted('  Get your key at: https://integrate.api.nvidia.com\n'));
    process.exit(1);
  }

  const availableModels = serverCheck.models || [];
  const modelAvailable = availableModels.length === 0 || availableModels.some(m => m.id === config.model);

  if (modelAvailable) {
    ui.printInfo(`${ui.icons.success} Connected — Model: ${ui.colors.secondary(config.model)}`);
  } else {
    ui.printWarning(`Model "${config.model}" not available.`);
    if (availableModels.length > 0) {
      config.model = availableModels[0].id;
      ui.printInfo(`${ui.icons.success} Auto-switched to: ${ui.colors.secondary(config.model)}`);
    }
  }

  // Show loaded tools count
  ui.printInfo(`${ui.icons.tool} ${toolDefinitions.length} tools loaded. Type /help for commands.\n`);

  // Create the agent
  const agent = new Agent(cwd);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 100,
    terminal: process.stdin.isTTY,
  });

  const askLine = () => new Promise((resolve) => {
    rl.question(ui.getPromptString(), resolve);
  });

  let isProcessing = false;
  let ctrlCCount = 0;
  rl.on('SIGINT', () => {
    ctrlCCount++;
    if (isProcessing) {
      console.log(ui.colors.warning('\n  Interrupted.'));
      isProcessing = false;
    } else if (ctrlCCount >= 2) {
      console.log(ui.colors.muted('\n  Force exit.'));
      try { memory.close(); } catch {}
      rl.close();
      process.exit(0);
    } else {
      console.log(ui.colors.muted('\n  Use /exit to quit, or Ctrl+C again to force exit.'));
    }
    setTimeout(() => { ctrlCCount = 0; }, 2000);
  });

  let multiLineBuffer = '';
  
  async function promptLoop() {
    let rawLine;
    try {
      rawLine = await askLine();
    } catch {
      console.log();
      cleanupAndExit();
      return;
    }

    ctrlCCount = 0;

    if (rawLine.endsWith('\\')) {
      multiLineBuffer += rawLine.slice(0, -1) + '\n';
      process.stdout.write(ui.colors.muted('  ... '));
      return promptLoop();
    }

    const fullInput = multiLineBuffer ? multiLineBuffer + rawLine : rawLine.trim();
    multiLineBuffer = '';

    if (!fullInput.trim()) return promptLoop();

    if (fullInput.startsWith('/')) {
      const shouldExit = await handleSlashCommand(fullInput, agent, rl);
      if (shouldExit) {
        cleanupAndExit();
        return;
      }
      return promptLoop();
    }

    isProcessing = true;
    try {
      await agent.processMessage(fullInput);
    } catch (error) {
      ui.printError(`Error: ${error.message}`);
    }
    isProcessing = false;
    console.log(); 
    promptLoop();
  }

  function cleanupAndExit() {
    console.log(ui.colors.muted('\n  🐉 OpenClaw Cyber v3.0 — Goodbye! 👋\n'));
    try { memory.close(); } catch {}
    rl.close();
    process.exit(0);
  }

  promptLoop();
}

async function handleSlashCommand(input, agent, rl) {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case '/help':
      ui.printHelp();
      break;

    case '/clear':
      agent.clearHistory();
      console.clear();
      ui.printBanner();
      ui.printInfo('Conversation cleared.');
      break;

    case '/compact':
      await agent.compactHistory();
      break;

    case '/model': {
      if (args.length > 0) {
        config.model = args.join(' ');
        ui.printInfo(`Model changed to: ${ui.colors.secondary(config.model)}`);
      } else {
        ui.printInfo(`Current model: ${ui.colors.secondary(config.model || '(auto)')}`);
        const serverCheck = await checkServer();
        if (serverCheck.models && serverCheck.models.length > 0) {
          console.log(ui.colors.muted('  Available models:'));
          serverCheck.models.forEach(m => console.log(ui.colors.muted(`    • ${m.id}`)));
        }
      }
      break;
    }

    case '/cost': {
      const usage = agent.getUsage();
      ui.printTokenUsage(usage.inputTokens, usage.outputTokens);
      ui.printInfo(`Messages: ${usage.messages} | Turns: ${usage.turns}`);
      break;
    }

    case '/tools':
      console.log(`\n${ui.colors.bright.bold('🔧 Available Tools ('+toolDefinitions.length+'):')}`);
      toolDefinitions.forEach(t => {
        const fn = t.function;
        console.log(`  ${ui.colors.tool(fn.name.padEnd(20))} ${ui.colors.muted('—')} ${ui.colors.muted(fn.description.slice(0, 70))}`);
      });
      console.log();
      break;

    case '/skills': {
      const skills = skillsManager.getAllSkills();
      if (skills.length === 0) {
        ui.printInfo('📦 No skills loaded. Add skill folders to skills/ directory.');
      } else {
        console.log(`\n${ui.colors.bright.bold('📦 Loaded Skills:')}`);
        skills.forEach(s => console.log(`  ${ui.colors.secondary(s.name)} — ${ui.colors.muted(s.description)}`));
        console.log();
      }
      break;
    }

    case '/memory': {
      try {
        const stats = memory.getStats();
        console.log(`\n${ui.colors.bright.bold('🧠 Memory / Database Stats:')}`);
        console.log(`  ${ui.colors.muted('Knowledge entries:')}  ${ui.colors.secondary(stats.knowledge)}`);
        console.log(`  ${ui.colors.muted('Targets profiled:')}   ${ui.colors.secondary(stats.targets)}`);
        console.log(`  ${ui.colors.muted('Loot items:')}         ${ui.colors.secondary(stats.loot)}`);
        console.log(`  ${ui.colors.muted('Queued tasks:')}       ${ui.colors.secondary(stats.tasks)}`);
        console.log(`  ${ui.colors.muted('Skills loaded:')}      ${ui.colors.secondary(stats.active_skills)}`);
        console.log(`  ${ui.colors.muted('Operations logged:')} ${ui.colors.secondary(stats.operations)}`);
        console.log(`  ${ui.colors.muted('Scan results:')}       ${ui.colors.secondary(stats.scan_results)}`);
        console.log(`  ${ui.colors.muted('Threat intel:')}       ${ui.colors.secondary(stats.threat_intel)}`);
        console.log(`  ${ui.colors.muted('FOFA results:')}       ${ui.colors.secondary(stats.fofa_results)}`);
        console.log(`  ${ui.colors.muted('Exploits DB:')}        ${ui.colors.secondary(stats.exploit_db)}`);
        console.log(`  ${ui.colors.muted('Attack logs:')}        ${ui.colors.secondary(stats.attack_logs)}`);
        console.log(`  ${ui.colors.muted('Nuclei results:')}     ${ui.colors.secondary(stats.nuclei_results)}`);
        console.log(`  ${ui.colors.muted('Tool knowledge:')}     ${ui.colors.secondary(stats.tool_knowledge)}`);
        console.log();
      } catch {
        ui.printInfo('Memory not initialized.');
      }
      break;
    }

    case '/learn': {
      try {
        const stats = memory.getLearningStats();
        console.log(`\n${ui.colors.bright.bold('🧠 Auto-Learning Stats:')}`);
        if (stats.length === 0) {
          console.log(ui.colors.muted('  No learning data yet. Run: node cli.js --learn'));
        } else {
          for (const s of stats) {
            console.log(`  ${ui.colors.secondary(s.source.padEnd(20))} ${ui.colors.muted(s.resource_type.padEnd(15))} ${ui.colors.secondary(s.total_items || s.count)} items  ${ui.colors.muted('last: ' + (s.last_fetch || 'never'))}`);
          }
        }
        console.log();
      } catch {
        ui.printInfo('Memory not initialized.');
      }
      break;
    }

    case '/exit':
    case '/quit':
      return true;

    default:
      ui.printWarning(`Unknown command: ${cmd}. Type /help for available commands.`);
  }

  return false;
}
