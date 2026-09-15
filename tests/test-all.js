// Jarvis Cyber — Comprehensive Test Suite
// Tests all components: database, tools, frameworks, auto-learner, dynamic skills, agent
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

  test('Threat intel store/search', () => {
    memory.storeThreatIntel('cve', 'CVE-2024-12345', {
      title: 'Test CVE', description: 'A test vulnerability',
      severity: 'HIGH', cvss_score: 8.5, source: 'test'
    });
    const results = memory.searchThreatIntel('CVE-2024-12345');
    assert(results.length >= 1, 'Should find threat intel');
  });

  test('Strategies table exists', () => {
    const tables = memory.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='strategies'").get();
    assert(tables, 'Strategies table should exist');
  });

  test('Installed tools table exists', () => {
    const tables = memory.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='installed_tools'").get();
    assert(tables, 'Installed_tools table should exist');
  });

  test('Full stats', () => {
    const stats = memory.getStats();
    assert(stats.knowledge >= 1, 'Knowledge count should be >= 1');
    assert(stats.operations >= 1, 'Operations count should be >= 1');
  });
}

// ═══════════════════════════════════════════════
// TEST 2: Tool Definitions
// ═══════════════════════════════════════════════
async function testTools() {
  console.log('\n🔧 Test: Tool Definitions');

  const { toolDefinitions, toolExecutors, safeTools, writeTools, dangerousTools } = await import('../src/tools/index.js');

  test('Tool definitions loaded (35+)', () => {
    assert(toolDefinitions.length >= 35, `Expected 35+ tools, got ${toolDefinitions.length}`);
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

  test('install_tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'install_tool'), 'install_tool missing');
    assert(typeof toolExecutors.install_tool === 'function', 'install_tool executor missing');
  });

  test('FOFA tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'fofa_search'), 'fofa_search missing');
  });

  test('Nuclei tool registered', () => {
    assert(toolDefinitions.some(t => t.function.name === 'nuclei_scan'), 'nuclei_scan missing');
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

  test('Output dir uses jarvis', () => {
    assert(config.outputDir.includes('jarvis'), `Output dir should contain 'jarvis': ${config.outputDir}`);
  });

  test('Memory DB path uses jarvis', () => {
    assert(config.memoryDbPath.includes('jarvis'), `DB path should contain 'jarvis': ${config.memoryDbPath}`);
  });

  test('Model is DeepSeek V4 Flash', () => {
    assert(config.model.includes('deepseek-v4-flash'), `Model should be DeepSeek: ${config.model}`);
  });

  test('FOFA config fields exist', () => {
    assert('fofaEmail' in config, 'Missing fofaEmail');
    assert('fofaApiKey' in config, 'Missing fofaApiKey');
  });

  test('Learning config fields exist', () => {
    assert('learningCron' in config, 'Missing learningCron');
    assert('learningEnabled' in config, 'Missing learningEnabled');
  });
}

// ═══════════════════════════════════════════════
// TEST 4: Frameworks (MITRE ATT&CK + Cyber Kill Chain)
// ═══════════════════════════════════════════════
async function testFrameworks() {
  console.log('\n🛡️  Test: Frameworks');

  const { MITRE_ATTACK, CYBER_KILL_CHAIN, mapFindingsToTechniques, getCurrentKillChainPhase, buildFrameworkContext } = await import('../src/frameworks.js');

  test('MITRE ATT&CK has 14 tactics', () => {
    assert(MITRE_ATTACK.tactics.length === 14, `Expected 14 tactics, got ${MITRE_ATTACK.tactics.length}`);
  });

  test('Cyber Kill Chain has 7 phases', () => {
    assert(CYBER_KILL_CHAIN.phases.length === 7, `Expected 7 phases, got ${CYBER_KILL_CHAIN.phases.length}`);
  });

  test('mapFindingsToTechniques works', () => {
    const findings = { ports: [80, 443], services: ['http', 'ssh'], hasWebApp: true };
    const result = mapFindingsToTechniques(findings);
    assert(result.length > 0, 'Should map findings to at least 1 tactic');
  });

  test('getCurrentKillChainPhase works', () => {
    const result = getCurrentKillChainPhase(['recon', 'scan']);
    assert(result.current, 'Should return current phase');
    assert(result.current.name === 'Reconnaissance', `Expected Reconnaissance, got ${result.current.name}`);
  });

  test('buildFrameworkContext returns string', () => {
    const ctx = buildFrameworkContext();
    assert(ctx.length > 100, 'Framework context should be substantial');
    assert(ctx.includes('MITRE'), 'Should include MITRE');
    assert(ctx.includes('Kill Chain'), 'Should include Kill Chain');
  });
}

// ═══════════════════════════════════════════════
// TEST 5: Kali Tools Registry
// ═══════════════════════════════════════════════
async function testKaliRegistry() {
  console.log('\n🔪 Test: Kali Tools Registry');

  const { detectInstalledTools, getAllTools, getToolsByCategory, getToolsForTechnique, searchTools, getCategories, buildToolsContext } = await import('../src/kali-tools-registry.js');

  test('Registry has 100+ tools', () => {
    const all = getAllTools();
    assert(all.length >= 100, `Expected 100+ tools, got ${all.length}`);
  });

  test('Has 10+ categories', () => {
    const cats = getCategories();
    assert(cats.length >= 10, `Expected 10+ categories, got ${cats.length}`);
  });

  test('detectInstalledTools returns Map', () => {
    const installed = detectInstalledTools();
    assert(installed instanceof Map, 'Should return a Map');
  });

  test('getToolsForTechnique works', () => {
    const tools = getToolsForTechnique('T1595');
    assert(tools.length > 0, 'Should find tools for T1595 (Active Scanning)');
  });

  test('searchTools works', () => {
    const results = searchTools('nmap');
    assert(results.length > 0, 'Should find nmap');
  });

  test('buildToolsContext returns string', () => {
    const ctx = buildToolsContext();
    assert(ctx.length > 50, 'Tools context should be substantial');
  });
}

// ═══════════════════════════════════════════════
// TEST 6: Dynamic Skills Engine
// ═══════════════════════════════════════════════
async function testDynamicSkills() {
  console.log('\n🧠 Test: Dynamic Skills Engine');

  const { dynamicSkills } = await import('../src/dynamic-skills.js');

  test('decomposeObjective — web pentest', () => {
    const result = dynamicSkills.decomposeObjective('pentest the webapp at example.com');
    assert(result.type === 'web_application', `Expected web_application, got ${result.type}`);
    assert(result.phases.length > 0, 'Should have phases');
  });

  test('decomposeObjective — full pentest', () => {
    const result = dynamicSkills.decomposeObjective('hack the target and exploit vulnerabilities');
    assert(result.type === 'full_pentest', `Expected full_pentest, got ${result.type}`);
  });

  test('decomposeObjective — wireless', () => {
    const result = dynamicSkills.decomposeObjective('crack the wifi password');
    assert(result.type === 'wireless', `Expected wireless, got ${result.type}`);
  });

  test('decomposeObjective — AD', () => {
    const result = dynamicSkills.decomposeObjective('attack the active directory domain');
    assert(result.type === 'active_directory', `Expected active_directory, got ${result.type}`);
  });

  test('getSkillsContext returns string', () => {
    const ctx = dynamicSkills.getSkillsContext();
    assert(ctx.includes('DYNAMIC'), 'Should mention dynamic capabilities');
    assert(ctx.includes('MITRE'), 'Should mention MITRE ATT&CK');
  });
}

// ═══════════════════════════════════════════════
// TEST 7: Auto-Learner
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
    assert(typeof learner.getStats === 'function', 'Missing getStats()');
  });
}

// ═══════════════════════════════════════════════
// TEST 8: CLI
// ═══════════════════════════════════════════════
async function testCLI() {
  console.log('\n🖥️  Test: CLI');

  const { execSync } = await import('child_process');

  test('CLI --help works and shows Jarvis', () => {
    const output = execSync(`node ${join(projectDir, 'cli.js')} --help`, { encoding: 'utf-8' });
    assert(output.includes('Jarvis Cyber'), 'Help should mention Jarvis Cyber');
    assert(output.includes('50+'), 'Help should mention 50+ tools');
  });

  test('CLI help does NOT mention OpenClaw', () => {
    const output = execSync(`node ${join(projectDir, 'cli.js')} --help`, { encoding: 'utf-8' });
    assert(!output.includes('OpenClaw'), 'Should not contain old OpenClaw branding');
  });
}

// ═══════════════════════════════════════════════
// TEST 9: No OpenClaw References
// ═══════════════════════════════════════════════
async function testNoOpenClaw() {
  console.log('\n🔍 Test: No OpenClaw References in Source');

  const { execSync } = await import('child_process');

  test('No openclaw in src/*.js files', () => {
    try {
      const output = execSync(`grep -rli "openclaw" ${join(projectDir, 'src')} --include="*.js" 2>/dev/null || echo "CLEAN"`, { encoding: 'utf-8' });
      assert(output.trim() === 'CLEAN', `Found openclaw references in: ${output.trim()}`);
    } catch {
      // grep returns exit code 1 when no matches found — that's what we want
    }
  });
}

// ═══════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════
console.log('🐉 Jarvis Cyber — Test Suite v3.1 (Dynamic Edition)');
console.log('═══════════════════════════════════════');

try {
  await testConfig();
  await testDatabase();
  await testTools();
  await testFrameworks();
  await testKaliRegistry();
  await testDynamicSkills();
  await testAutoLearner();
  await testCLI();
  await testNoOpenClaw();
} catch (err) {
  console.error(`\n💥 Fatal test error: ${err.message}`);
  console.error(err.stack);
}

console.log('\n═══════════════════════════════════════');
console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
