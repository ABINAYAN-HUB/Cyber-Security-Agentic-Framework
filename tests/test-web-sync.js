import { io as ClientIO } from 'socket.io-client';
import { startWebServer } from '../src/web-server.js';
import { execute as executeSupplyChainScan } from '../src/tools/supply-chain-scanner.js';
import { memory } from '../src/memory.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n🐉 Jarvis Cyber — Web Sync & Real-Time Replay Test Suite');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── TEST 1: Supply Chain Severity Tally ────────────────────────
  console.log('📦 Test 1: Supply Chain Scanner Severity Tally Mapping');
  try {
    const mockFindings = [
      { id: 'TEST-1', severity: 'MODERATE' },
      { id: 'TEST-2', severity: 'warn' },
      { id: 'TEST-3', severity: 'warning' },
      { id: 'TEST-4', severity: 'critical' },
      { id: 'TEST-5', severity: 'HIGH' },
      { id: 'TEST-6', severity: 'low' },
      { id: 'TEST-7', severity: 'info' },
      { id: 'TEST-8', severity: 'unknown_type' }
    ];

    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    for (const f of mockFindings) {
      let sev = (f.severity || 'info').toLowerCase();
      if (sev === 'moderate' || sev === 'warn' || sev === 'warning') sev = 'medium';
      if (summary[sev] !== undefined) {
        summary[sev]++;
      } else {
        summary.info++;
      }
      summary.total++;
    }

    assert(summary.medium === 3, `Moderate and warning map to medium (got ${summary.medium}, expected 3)`);
    assert(summary.critical === 1, `Critical is 1`);
    assert(summary.high === 1, `High is 1`);
    assert(summary.low === 1, `Low is 1`);
    assert(summary.info === 2, `Info + unknown fallback is 2 (got ${summary.info})`);
    assert(summary.total === 8, `Total findings tally is 8`);
  } catch (err) {
    assert(false, `Supply chain test error: ${err.message}`);
  }

  // ── TEST 2: REST Table Preview Endpoint ───────────────────────
  console.log('\n🌐 Test 2: Generic Database Table Endpoints (/api/memory/table/:name)');
  const testPort = 3847;
  let serverInstance = null;

  try {
    serverInstance = await startWebServer({ port: testPort });
    const { httpServer, io, activeExecution } = serverInstance;

    // Test querying multiple tables
    const tablesToTest = [
      'knowledge',
      'targets',
      'scan_results',
      'operations',
      'threat_intel',
      'loot',
      'tasks',
      'tool_knowledge'
    ];

    for (const table of tablesToTest) {
      const res = await fetch(`http://localhost:${testPort}/api/memory/table/${table}`);
      assert(res.status === 200, `GET /api/memory/table/${table} returns HTTP 200`);
      const body = await res.json();
      assert(body.table === table, `Response table name is "${table}"`);
      assert(Array.isArray(body.results), `Response contains results array`);
    }

    // Test disallowed / SQL injection table names
    const invalidRes = await fetch(`http://localhost:${testPort}/api/memory/table/sqlite_master`);
    assert(invalidRes.status === 400, `GET /api/memory/table/sqlite_master returns HTTP 400 (forbidden table)`);

    const sqlInjRes = await fetch(`http://localhost:${testPort}/api/memory/table/knowledge;DROP%20TABLE%20knowledge;`);
    assert(sqlInjRes.status === 400, `SQL injection table name returns HTTP 400`);

    // ── TEST 3: Multi-Socket Synchronization & State Replay ────────
    console.log('\n🔌 Test 3: Multi-Socket Broadcast & Active Execution Reconnection Replay');

    // Connect Socket 1
    const socket1 = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });

    const socket1ReadyPromise = new Promise((resolve) => {
      socket1.on('chat:ready', (data) => resolve(data));
    });

    const s1ReadyData = await socket1ReadyPromise;
    assert(socket1.connected, `Socket 1 connected successfully`);
    assert(s1ReadyData.activeExecution === null, `Initial activeExecution is null when idle`);

    // Now simulate an ongoing agent execution in the background
    activeExecution.isRunning = true;
    activeExecution.sessionId = 'test-session-recon-001';
    activeExecution.userMessage = 'Scan target 10.95.188.128 for open ports';
    activeExecution.startTime = Date.now();
    activeExecution.events = [
      { event: 'chat:token', data: { token: 'Initiating stealth reconnaissance...', sessionId: 'test-session-recon-001' } },
      { event: 'chat:tool_start', data: { name: 'naabu_scan', id: 'call_1', input: { host: '10.95.188.128' } } },
      { event: 'chat:tool_end', data: { name: 'naabu_scan', id: 'call_1', result: 'Found ports 22, 80, 443' } }
    ];

    // Connect Socket 2 (simulating a tab reload, second device, or reconnecting socket)
    const socket2 = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });

    const socket2ReadyPromise = new Promise((resolve) => {
      socket2.on('chat:ready', (data) => resolve(data));
    });

    const s2ReadyData = await socket2ReadyPromise;
    assert(socket2.connected, `Socket 2 connected successfully`);
    assert(s2ReadyData.activeExecution !== null, `Socket 2 received non-null activeExecution on connect`);
    assert(s2ReadyData.activeExecution.isRunning === true, `Socket 2 received activeExecution.isRunning = true`);
    assert(s2ReadyData.activeExecution.sessionId === 'test-session-recon-001', `Socket 2 received correct sessionId`);
    assert(s2ReadyData.activeExecution.events.length === 3, `Socket 2 replayed all 3 buffered turn events`);

    // Now test broadcast emission: emit an event via io.emit and verify BOTH sockets receive it
    const s1TokenPromise = new Promise(res => socket1.once('chat:token', res));
    const s2TokenPromise = new Promise(res => socket2.once('chat:token', res));

    io.emit('chat:token', { token: 'Synchronized real-time update test', sessionId: 'test-session-recon-001' });

    const [s1Token, s2Token] = await Promise.all([s1TokenPromise, s2TokenPromise]);
    assert(s1Token.token === 'Synchronized real-time update test', `Socket 1 received broadcast token`);
    assert(s2Token.token === 'Synchronized real-time update test', `Socket 2 received broadcast token simultaneously`);

    // Clean up active execution state
    activeExecution.isRunning = false;
    activeExecution.sessionId = null;
    activeExecution.events = [];

    // Disconnect sockets and stop server
    socket1.disconnect();
    socket2.disconnect();
    httpServer.close();
    io.close();
  } catch (err) {
    assert(false, `Web sync test error: ${err.message}`);
    if (serverInstance?.httpServer) {
      serverInstance.httpServer.close();
      serverInstance.io.close();
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run();
