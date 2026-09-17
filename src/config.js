// Jarvis Cyber — Configuration
// Powered by NVIDIA NIM API — Nemotron 3 Super (120B)
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import dns from 'dns';

// Force IPv4 resolution to prevent Node.js 'fetch failed' / ETIMEDOUT network outages
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) { }

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
  // ═══ Active Provider: 'nvidia' (Cloud) | 'local' (LM Studio, Ollama, Jan.ai) ═══
  activeProvider: process.env.DEFAULT_PROVIDER || 'nvidia',

  // ═══ NVIDIA NIM API ═══
  baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY || '',
  model: process.env.NVIDIA_MODEL || 'z-ai/glm-5.3',

  // ═══ Local AI Server (LM Studio, Ollama, Jan.ai, etc.) ═══
  localAiBackend: process.env.LOCAL_AI_BACKEND || 'lmstudio',
  localAiBaseUrl: process.env.LOCAL_AI_BASE_URL || 'http://localhost:1234/v1',
  localAiModel: process.env.LOCAL_AI_MODEL || '',
  localAiApiKey: process.env.LOCAL_AI_API_KEY || 'none',

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
  heartbeatCron: process.env.HEARTBEAT_CRON || '0 * * * *',
  heartbeatFile: join(dataDir, 'HEARTBEAT.md'),

  // ═══ Auto-Learning (24/7 Continuous) ═══
  learningCron: process.env.LEARNING_CRON || '0 */2 * * *', // Every 2 hours — tiered scheduling handles actual source frequency
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

  // ═══ BRON Knowledge Graph (ArangoDB) ═══
  bronDbUrl: process.env.BRON_DB_URL || 'http://127.0.0.1:8529',
  bronDbPassword: process.env.BRON_DB_PASSWORD || 'jarvis_bron_2024',
  bronDbName: process.env.BRON_DB_NAME || 'bron',
  bronEnabled: process.env.BRON_ENABLED !== 'false', // Enabled by default

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