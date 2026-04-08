// OpenClaw Cyber — Comprehensive Test Suite
// Tests all components: database, tools, auto-learner, agent
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = join(__dirname, '..');

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ═══════════════════════════════════════════════
// TEST 1: Database / Memory
// ═══════════════════════════════════════════════
async function testDatabase() {
  console.log('\n📦 Test: Database / Memory');

  // Use a temp db for testing
  const Database = (await import('better-sqlite3')).default;
  const { memory } = await import('../src/memory.js');

  test('Memory initializes without error', () => {
    memory.init();
    assert(memory.db !== null, 'DB should not be null');
  });

  test('Knowledge store/get', () => {
    memory.storeKnowledge('test-key', 'test-value', 'test');
    const val = memory.getKnowledge('test-key');
    assert(val === 'test-value', `Expected 'test-value', got '${val}'`);
  });

  test('Knowledge store/get JSON', () => {
    memory.storeKnowledge('test-json', { foo: 'bar' }, 'test');
    const val = memory.getKnowledge('test-json');
    assert(val && val.foo === 'bar', 'JSON round-trip failed');
  });

  test('Knowledge search', () => {
    const results = memory.searchKnowledge('test');
    assert(results.length >= 1, 'Should find at least 1 result');
  });

  test('Target store/get', () => {
    memory.storeTarget('192.168.1.1', { ports: [22, 80] }, 'host', 'test');
    const targets = memory.getTarget('192.168.1.1');
    assert(targets.length >= 1, 'Should find target');
  });

  test('Cache store/get', () => {
    memory.cacheResult('test-cache', { data: 'cached' }, 'test_tool', 24);
    const cached = memory.getCached('test-cache');
    assert(cached && cached.data === 'cached', 'Cache miss');
  });

  test('Loot store/get', () => {
    memory.storeLoot('192.168.1.1', 'credential', { user: 'admin', pass: '123' }, 'test');
    const loot = memory.getLoot('192.168.1.1');
    assert(loot.length >= 1, 'Should find loot');
  });

  test('Task add/get/complete', () => {
    const result = memory.addTask('Test task', 5);
    assert(result.lastInsertRowid, 'Should return row id');
    const pending = memory.getPendingTasks();
    assert(pending.length >= 1, 'Should have pending task');
    memory.completeTask(result.lastInsertRowid, 'done');
  });

  test('Operation log', () => {
    const opId = memory.logOperation('scan', '10.0.0.1', 'nmap', { ports: '1-1000' });
    assert(opId, 'Should return operation ID');
    memory.completeOperation(opId, 'completed', 'Found 3 open ports', { ports: [22, 80, 443] });
    const ops = memory.getOperations();
    assert(ops.length >= 1, 'Should have operations');
  });

  test('Scan result store/get', () => {
    memory.storeScanResult('port_scan', '10.0.0.1', 'nmap', {
      ports: [22, 80, 443], services: ['ssh', 'http', 'https'], severity: 'medium'
    });
    const scans = memory.getScanResults('10.0.0.1');
    assert(scans.length >= 1, 'Should find scan results');
  });

  test('Threat intel store/search', () => {
    memory.storeThreatIntel('cve', 'CVE-2024-12345', {
      title: 'Test CVE', description: 'A test vulnerability',
      severity: 'HIGH', cvss_score: 8.5, source: 'test'
    });
    const results = memory.searchThreatIntel('CVE-2024-12345');
    assert(results.length >= 1, 'Should find threat intel');
  });

  test('FOFA result store/get', () => {
    memory.storeFofaResult('test-query', {
      ip: '1.2.3.4', port: 443, protocol: 'https',
      domain: 'test.com', title: 'Test Page'
    });
    const results = memory.getFofaResults('test-query');
    assert(results.length >= 1, 'Should find FOFA results');
  });

  test('Exploit store/search', () => {
    memory.storeExploit('EDB-99999', {
      title: 'Test Exploit', platform: 'linux',
      exploit_type: 'local', source: 'test'
    });
    const results = memory.searchExploits('Test Exploit');
    assert(results.length >= 1, 'Should find exploit');
  });

  test('Attack log', () => {
    memory.logAttack(1, 'recon', 'nmap scan', '10.0.0.1', 'nmap -sV 10.0.0.1', 'Found ports', true);
    const logs = memory.getAttackLog(1);
    assert(logs.length >= 1, 'Should have attack log');
  });

  test('Learning history', () => {
    memory.markLearned('test-source', 'test-resource', 'test-type', 10);
    assert(memory.isLearned('test-source', 'test-resource'), 'Should be marked as learned');
    assert(!memory.isLearned('test-source', 'nonexistent'), 'Should not find nonexistent');
  });

  test('Nuclei result store/get', () => {
    memory.storeNucleiResult('https://test.com', {
      template_id: 'test-001', template_name: 'Test Template',
      severity: 'high', matched_at: 'https://test.com/admin'
    });
    const results = memory.getNucleiResults('https://test.com');
    assert(results.length >= 1, 'Should find nuclei result');
  });

  test('Tool knowledge store/search', () => {
    memory.storeToolKnowledge('test-tool', {
      category: 'test', description: 'A test tool',
      install_command: 'apt install test', official_url: 'https://test.com'
    });
    const results = memory.searchToolKnowledge('test-tool');
    assert(results.length >= 1, 'Should find tool knowledge');
  });

  test('Full stats', () => {
    const stats = memory.getStats();
    assert(stats.knowledge >= 1, 'Knowledge count should be >= 1');
    assert(stats.operations >= 1, 'Operations count should be >= 1');
    assert(stats.threat_intel >= 1, 'Threat intel count should be >= 1');
    assert(stats.tool_knowledge >= 1, 'Tool knowledge count should be >= 1');
  });

  test('Learning stats', () => {
    const stats = memory.getLearningStats();
    assert(stats.length >= 1, 'Should have learning stats');
  });
}

// ═══════════════════════════════════════════════
// TEST 2: Tool Definitions
// ═══════════════════════════════════════════════
async function testTools() {
  console.log('\n🔧 Test: Tool Definitions');

  const { toolDefinitions, toolExecutors, safeTools, writeTools, dangerousTools } = await import('../src/tools/index.js');

  test('Tool definitions loaded', () => {
    assert(toolDefinitions.length >= 50, `Expected 50+ tools, got ${toolDefinitions.length}`);
  });

  test('All tools have valid definitions', () => {
    for (const def of toolDefinitions) {
      assert(def.type === 'function', `Tool missing type=function`);
      assert(def.function?.name, `Tool missing function.name`);
      assert(def.function?.description, `Tool ${def.function?.name} missing description`);
      assert(def.function?.parameters, `Tool ${def.function?.name} missing parameters`);
    }
  });

  test('All tools have executors', () => {
    for (const def of toolDefinitions) {
      const name = def.function.name;
      assert(typeof toolExecutors[name] === 'function', `No executor for tool: ${name}`);
    }
  });

  test('FOFA tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'fofa_search'), 'fofa_search missing');
    assert(typeof toolExecutors.fofa_search === 'function', 'fofa_search executor missing');
  });

  test('Nuclei tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'nuclei_scan'), 'nuclei_scan missing');
  });

  test('Subfinder tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'subfinder_enum'), 'subfinder_enum missing');
  });

  test('Httpx tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'httpx_probe'), 'httpx_probe missing');
  });

  test('Naabu tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'naabu_scan'), 'naabu_scan missing');
  });

  test('Katana tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'katana_crawl'), 'katana_crawl missing');
  });

  test('Dnsx tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'dnsx_resolve'), 'dnsx_resolve missing');
  });

  test('Uncover tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'uncover_search'), 'uncover_search missing');
  });

  test('Safety classifications exist', () => {
    assert(safeTools.size >= 20, `Expected 20+ safe tools, got ${safeTools.size}`);
    assert(writeTools.size >= 5, `Expected 5+ write tools, got ${writeTools.size}`);
    assert(dangerousTools.size >= 1, `Expected 1+ dangerous tools, got ${dangerousTools.size}`);
  });

  test('No duplicate tool names', () => {
    const names = toolDefinitions.map(t => t.function.name);
    const unique = new Set(names);
    assert(names.length === unique.size, `Found duplicate tool names: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
  });
}

// ═══════════════════════════════════════════════
// TEST 3: Config
// ═══════════════════════════════════════════════
async function testConfig() {
  console.log('\n⚙️  Test: Configuration');

  const config = (await import('../src/config.js')).default;

  test('Config loads', () => {
    assert(config, 'Config should exist');
  });

  test('FOFA config fields exist', () => {
    assert('fofaEmail' in config, 'Missing fofaEmail');
    assert('fofaApiKey' in config, 'Missing fofaApiKey');
  });

  test('Learning config fields exist', () => {
    assert('learningCron' in config, 'Missing learningCron');
    assert('learningEnabled' in config, 'Missing learningEnabled');
  });

  test('Output dir uses openclaw', () => {
    assert(config.outputDir.includes('openclaw'), `Output dir should contain 'openclaw': ${config.outputDir}`);
  });

  test('Memory DB path uses openclaw', () => {
    assert(config.memoryDbPath.includes('openclaw'), `DB path should contain 'openclaw': ${config.memoryDbPath}`);
  });
}

// ═══════════════════════════════════════════════
// TEST 4: Auto-Learner
// ═══════════════════════════════════════════════
async function testAutoLearner() {
  console.log('\n🧠 Test: Auto-Learner');

  const { AutoLearner } = await import('../src/auto-learner.js');

  test('AutoLearner instantiates', () => {
    const learner = new AutoLearner();
    assert(learner, 'Should create instance');
    assert(!learner.isRunning, 'Should not be running initially');
  });

  test('AutoLearner has all methods', () => {
    const learner = new AutoLearner();
    assert(typeof learner.run === 'function', 'Missing run()');
    assert(typeof learner.fetchNVDCVEs === 'function', 'Missing fetchNVDCVEs()');
    assert(typeof learner.fetchCISAKEV === 'function', 'Missing fetchCISAKEV()');
    assert(typeof learner.fetchExploitDB === 'function', 'Missing fetchExploitDB()');
    assert(typeof learner.fetchThreatFeeds === 'function', 'Missing fetchThreatFeeds()');
    assert(typeof learner.learnCyberTools === 'function', 'Missing learnCyberTools()');
    assert(typeof learner.getStats === 'function', 'Missing getStats()');
  });

  test('AutoLearner stats structure', () => {
    const learner = new AutoLearner();
    const stats = learner.getStats();
    assert('cves' in stats, 'Missing cves stat');
    assert('exploits' in stats, 'Missing exploits stat');
    assert('threats' in stats, 'Missing threats stat');
    assert('tools' in stats, 'Missing tools stat');
    assert('total_runs' in stats, 'Missing total_runs stat');
  });
}

// ═══════════════════════════════════════════════
// TEST 5: Skills
// ═══════════════════════════════════════════════
async function testSkills() {
  console.log('\n📦 Test: Skills');

  const { existsSync } = await import('fs');
  const { join: pathJoin } = await import('path');

  const skillsDir = pathJoin(projectDir, 'skills');
  const expectedSkills = [
    'threat-intelligence', 'fofa-recon', 'zero-day-research',
    'dark-web-osint', 'apt-profiling',
    'full-recon', 'exploit-development', 'webapp-pentest',
    'wireless-attack', 'network-attack', 'password-attack',
    'privilege-escalation', 'social-engineering', 'stealth-osint',
    'malware-analysis', 'incident-response', 'cloud-security-audit',
    'container-escape', 'api-security-test', 'mobile-app-pentest',
    'active-directory-attack', 'bug-bounty-hunter', 'firewall-bypass',
    'lateral-movement', 'red-team-c2',
  ];

  for (const skill of expectedSkills) {
    test(`Skill exists: ${skill}`, () => {
      const skillPath = pathJoin(skillsDir, skill, 'SKILL.md');
      assert(existsSync(skillPath), `Missing: ${skillPath}`);
    });
  }
}

// ═══════════════════════════════════════════════
// TEST 6: CLI
// ═══════════════════════════════════════════════
async function testCLI() {
  console.log('\n🖥️  Test: CLI');

  const { execSync } = await import('child_process');

  test('CLI --help works', () => {
    const output = execSync(`node ${join(projectDir, 'cli.js')} --help`, { encoding: 'utf-8' });
    assert(output.includes('OpenClaw Cyber'), 'Help should mention OpenClaw Cyber');
    assert(output.includes('50+'), 'Help should mention 50+ tools');
    assert(output.includes('fofa_search'), 'Help should list fofa_search');
    assert(output.includes('nuclei_scan'), 'Help should list nuclei_scan');
    assert(output.includes('--learn'), 'Help should mention --learn');
    assert(output.includes('--daemon'), 'Help should mention --daemon');
  });

  test('CLI help does not mention Jarvis', () => {
    const output = execSync(`node ${join(projectDir, 'cli.js')} --help`, { encoding: 'utf-8' });
    assert(!output.includes('Jarvis'), 'Should not contain Jarvis branding');
  });
}

// ═══════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════
console.log('🐉 OpenClaw Cyber — Test Suite v3.0');
console.log('═══════════════════════════════════════');

try {
  await testConfig();
  await testDatabase();
  await testTools();
  await testAutoLearner();
  await testSkills();
  await testCLI();
} catch (err) {
  console.error(`\n💥 Fatal test error: ${err.message}`);
  console.error(err.stack);
}

console.log('\n═══════════════════════════════════════');
console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
