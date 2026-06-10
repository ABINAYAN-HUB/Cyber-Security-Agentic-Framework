// Jarvis Cyber — Configuration
// Powered by NVIDIA NIM API — Z-AI GLM 5.1
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import dns from 'dns';

// Force IPv4 resolution to prevent Node.js 'fetch failed' / ETIMEDOUT network outages
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

// ═══ Resolve package directory (where cli.js lives) ═══
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = join(__dirname, '..');

// ═══ Load .env — check CWD first, then package dir ═══
const cwdEnv = join(process.cwd(), '.env');
const pkgEnv = join(packageDir, '.env');

if (existsSync(cwdEnv)) {
  dotenv.config({ path: cwdEnv });
} else if (existsSync(pkgEnv)) {
  dotenv.config({ path: pkgEnv });
} else {
  dotenv.config();
}

// ═══ Data Directory ═══
const isGlobalInstall = process.cwd() !== packageDir && !existsSync(join(process.cwd(), 'package.json'));
const dataDir = isGlobalInstall ? join(homedir(), '.jarvis') : process.cwd();

if (isGlobalInstall && !existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// ═══ Filter placeholder values from TELEGRAM_ALLOWED_IDS ═══
const PLACEHOLDER_PATTERNS = ['your-telegram', 'your_telegram', 'changeme', 'replace-me', 'placeholder'];
function parseAllowedIds(raw) {
  return (raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(id => {
      const lower = id.toLowerCase();
      return !PLACEHOLDER_PATTERNS.some(p => lower.includes(p));
    })
    .filter(id => /^\d+$/.test(id));
}

const config = {
  // ═══ NVIDIA NIM API ═══
  baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY || '',
  model: process.env.NVIDIA_MODEL || 'z-ai/glm-5.1',

  // ═══ Generation Settings ═══
  temperature: 0.4,
  topP: 0.9,
  topK: 20,
  maxTokens: 16384,
  presencePenalty: 0,
  repetitionPenalty: 1,

  // ═══ Telegram Bot ═══
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAllowedIds: parseAllowedIds(process.env.TELEGRAM_ALLOWED_IDS),

  // ═══ External API Keys ═══
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  shodanApiKey: process.env.SHODAN_API_KEY || '',
  virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY || '',

  // ═══ FOFA API ═══
  fofaEmail: process.env.FOFA_EMAIL || '',
  fofaApiKey: process.env.FOFA_API_KEY || '',

  // ═══ ProjectDiscovery Cloud Platform ═══
  pdcpApiKey: process.env.PDCP_API_KEY || '',

  // ═══ Directories & Paths ═══
  packageDir,
  dataDir,
  outputDir: process.env.OUTPUT_DIR || join(dataDir, 'jarvis-output'),
  skillsDir: join(packageDir, 'skills'),
  memoryDbPath: join(dataDir, 'jarvis-memory.db'),

  // ═══ Heartbeat / Daemon ═══
  heartbeatCron: process.env.HEARTBEAT_CRON || '*/30 * * * *',
  heartbeatFile: join(dataDir, 'HEARTBEAT.md'),

  // ═══ Auto-Learning (24/7 Continuous) ═══
  learningCron: process.env.LEARNING_CRON || '*/30 * * * *', // Every 30 minutes — 24/7
  learningEnabled: process.env.LEARNING_ENABLED !== 'false',  // Enabled by default

  // ═══ Stealth Browser ═══
  stealthBrowserHeadless: true,
  stealthBrowserProxy: process.env.STEALTH_PROXY || '',

  // ═══ Permission Settings ═══
  autoApproveReadTools: true,
  autoApproveWriteTools: true,
  autoApproveCommands: true,

  // ═══ Dangerous Command Patterns (DISABLED — fully uncensored mode) ═══
  dangerousPatterns: [],

  // ═══ History ═══
  maxHistoryMessages: 50,

  // ═══ Verbose Mode ═══
  verbose: false,

  // ═══ Token Tracking ═══
  totalInputTokens: 0,
  totalOutputTokens: 0,

  // ═══ .env file path ═══
  envFilePath: existsSync(cwdEnv) ? cwdEnv : (existsSync(pkgEnv) ? pkgEnv : cwdEnv),
};

export default config;