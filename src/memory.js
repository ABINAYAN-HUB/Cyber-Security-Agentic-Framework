// Jarvis Cyber — Persistent Memory System (SQLite)
// Enhanced with full operation logging, threat intel, FOFA cache, auto-learning, and dynamic strategy storage
import Database from 'better-sqlite3';
import config from './config.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

class Memory {
  constructor() {
    this.db = null;
  }

  init() {
    if (this.db) return this;

    const dir = dirname(config.memoryDbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    this.db = new Database(config.memoryDbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._createTables();
    return this;
  }

  _createTables() {
    this.db.exec(`
      -- ═══════════════════════════════════════════
      -- Key-Value Knowledge Store
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS knowledge (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════
      -- Target Profiles (Recon Data)
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        type TEXT DEFAULT 'host',
        data TEXT NOT NULL,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_targets_id ON targets(identifier);

      -- ═══════════════════════════════════════════
      -- Conversation Sessions
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id);

      -- ═══════════════════════════════════════════
      -- Tool Results Cache
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS cache (
        cache_key TEXT PRIMARY KEY,
        result TEXT NOT NULL,
        tool_name TEXT,
        ttl_hours INTEGER DEFAULT 24,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════
      -- Skills Registry
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS skills (
        name TEXT PRIMARY KEY,
        description TEXT,
        path TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        loaded_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════
      -- Credentials / Loot Store
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS loot (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target TEXT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════
      -- Task Queue (for daemon heartbeat)
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );

      -- ═══════════════════════════════════════════
      -- OPERATIONS LOG — Every hacking operation
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_type TEXT NOT NULL,
        target TEXT,
        tool_name TEXT NOT NULL,
        args TEXT,
        status TEXT DEFAULT 'running',
        result_summary TEXT,
        full_result TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        session_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ops_target ON operations(target);
      CREATE INDEX IF NOT EXISTS idx_ops_type ON operations(op_type);
      CREATE INDEX IF NOT EXISTS idx_ops_tool ON operations(tool_name);

      -- ═══════════════════════════════════════════
      -- SCAN RESULTS — Structured scan data
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS scan_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_type TEXT NOT NULL,
        target TEXT NOT NULL,
        scanner TEXT NOT NULL,
        ports TEXT,
        services TEXT,
        vulns TEXT,
        os_detected TEXT,
        raw_output TEXT,
        severity TEXT DEFAULT 'info',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_scan_target ON scan_results(target);
      CREATE INDEX IF NOT EXISTS idx_scan_type ON scan_results(scan_type);

      -- ═══════════════════════════════════════════
      -- THREAT INTEL — CVEs, IOCs, malware hashes
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS threat_intel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intel_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        title TEXT,
        description TEXT,
        severity TEXT,
        cvss_score REAL,
        affected_products TEXT,
        references_json TEXT,
        source TEXT NOT NULL,
        published_at TEXT,
        fetched_at TEXT DEFAULT (datetime('now')),
        UNIQUE(intel_type, identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_ti_type ON threat_intel(intel_type);
      CREATE INDEX IF NOT EXISTS idx_ti_id ON threat_intel(identifier);
      CREATE INDEX IF NOT EXISTS idx_ti_severity ON threat_intel(severity);

      -- ═══════════════════════════════════════════
      -- FOFA RESULTS — FOFA search cache
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS fofa_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        ip TEXT,
        port INTEGER,
        protocol TEXT,
        domain TEXT,
        host TEXT,
        title TEXT,
        banner TEXT,
        server TEXT,
        os TEXT,
        country TEXT,
        city TEXT,
        cert_subject TEXT,
        raw_data TEXT,
        fetched_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fofa_query ON fofa_results(query);
      CREATE INDEX IF NOT EXISTS idx_fofa_ip ON fofa_results(ip);

      -- ═══════════════════════════════════════════
      -- EXPLOIT DB — Local exploit database
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS exploit_db (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exploit_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        platform TEXT,
        exploit_type TEXT,
        author TEXT,
        code TEXT,
        cve_ids TEXT,
        source_url TEXT,
        source TEXT NOT NULL,
        published_at TEXT,
        fetched_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_exploit_platform ON exploit_db(platform);
      CREATE INDEX IF NOT EXISTS idx_exploit_type ON exploit_db(exploit_type);
      CREATE INDEX IF NOT EXISTS idx_exploit_cve ON exploit_db(cve_ids);

      -- ═══════════════════════════════════════════
      -- ATTACK LOGS — Full attack chain logging
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS attack_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id INTEGER,
        phase TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        command TEXT,
        result TEXT,
        success INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(operation_id) REFERENCES operations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_attack_op ON attack_logs(operation_id);

      -- ═══════════════════════════════════════════
      -- LEARNING HISTORY — Dedup tracker
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS learning_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        fetched_at TEXT DEFAULT (datetime('now')),
        items_count INTEGER DEFAULT 0,
        UNIQUE(source, resource_id)
      );
      CREATE INDEX IF NOT EXISTS idx_learn_source ON learning_history(source);

      -- ═══════════════════════════════════════════
      -- PROJECTDISCOVERY RESULTS
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS nuclei_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target TEXT NOT NULL,
        template_id TEXT,
        template_name TEXT,
        severity TEXT,
        matched_at TEXT,
        extracted_results TEXT,
        curl_command TEXT,
        raw_output TEXT,
        scanned_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_nuclei_target ON nuclei_results(target);
      CREATE INDEX IF NOT EXISTS idx_nuclei_severity ON nuclei_results(severity);

      -- ═══════════════════════════════════════════
      -- TOOL KNOWLEDGE — Learned tool info
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS tool_knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        usage_examples TEXT,
        install_command TEXT,
        official_url TEXT,
        documentation TEXT,
        source TEXT DEFAULT 'auto-learned',
        learned_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tool_name)
      );
      CREATE INDEX IF NOT EXISTS idx_tk_name ON tool_knowledge(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tk_category ON tool_knowledge(category);

      -- ═══════════════════════════════════════════
      -- DYNAMIC STRATEGIES — AI-generated attack plans
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target TEXT NOT NULL,
        objective TEXT NOT NULL,
        attack_framework TEXT,
        phase TEXT,
        strategy TEXT NOT NULL,
        tools_used TEXT,
        success INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_strat_target ON strategies(target);

      -- ═══════════════════════════════════════════
      -- INSTALLED TOOLS — Dynamic tool installation log
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS installed_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT UNIQUE NOT NULL,
        install_method TEXT,
        install_source TEXT,
        version TEXT,
        install_path TEXT,
        installed_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_it_name ON installed_tools(tool_name);

      -- ═══════════════════════════════════════════
      -- CHAT SESSIONS — Web UI chat history
      -- ═══════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        message_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_cs_updated ON chat_sessions(updated_at);
    `);
  }

  // ═══════════════════════════════════════════
  // Knowledge Store
  // ═══════════════════════════════════════════
  storeKnowledge(key, value, category = 'general') {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge (key, value, category, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : value, category);
  }

  getKnowledge(key) {
    const row = this.db.prepare('SELECT value, category FROM knowledge WHERE key = ?').get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  }

  searchKnowledge(query, category = null) {
    let sql = 'SELECT key, value, category FROM knowledge WHERE (key LIKE ? OR value LIKE ?)';
    const params = [`%${query}%`, `%${query}%`];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' LIMIT 20';
    return this.db.prepare(sql).all(...params);
  }

  // ═══════════════════════════════════════════
  // Target Profiles
  // ═══════════════════════════════════════════
  storeTarget(identifier, data, type = 'host', source = 'manual') {
    const stmt = this.db.prepare('INSERT INTO targets (identifier, type, data, source) VALUES (?, ?, ?, ?)');
    stmt.run(identifier, type, typeof data === 'object' ? JSON.stringify(data) : data, source);
  }

  getTarget(identifier) {
    const rows = this.db.prepare('SELECT * FROM targets WHERE identifier = ? ORDER BY created_at DESC').all(identifier);
    return rows.map(r => {
      try { r.data = JSON.parse(r.data); } catch {}
      return r;
    });
  }

  // ═══════════════════════════════════════════
  // Cache
  // ═══════════════════════════════════════════
  cacheResult(key, result, toolName, ttlHours = 24) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (cache_key, result, tool_name, ttl_hours, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(key, JSON.stringify(result), toolName, ttlHours);
  }

  getCached(key) {
    const row = this.db.prepare(`
      SELECT result, ttl_hours, created_at FROM cache 
      WHERE cache_key = ? 
      AND datetime(created_at, '+' || ttl_hours || ' hours') > datetime('now')
    `).get(key);
    if (!row) return null;
    try { return JSON.parse(row.result); } catch { return row.result; }
  }

  // ═══════════════════════════════════════════
  // Loot Store
  // ═══════════════════════════════════════════
  storeLoot(target, type, data, source = 'unknown') {
    const stmt = this.db.prepare('INSERT INTO loot (target, type, data, source) VALUES (?, ?, ?, ?)');
    stmt.run(target, type, typeof data === 'object' ? JSON.stringify(data) : data, source);
  }

  getLoot(target = null) {
    if (target) {
      return this.db.prepare('SELECT * FROM loot WHERE target = ? ORDER BY created_at DESC').all(target);
    }
    return this.db.prepare('SELECT * FROM loot ORDER BY created_at DESC LIMIT 50').all();
  }

  // ═══════════════════════════════════════════
  // Task Queue
  // ═══════════════════════════════════════════
  addTask(description, priority = 5) {
    const stmt = this.db.prepare('INSERT INTO tasks (description, priority) VALUES (?, ?)');
    return stmt.run(description, priority);
  }

  getPendingTasks() {
    return this.db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority DESC, created_at ASC").all();
  }

  completeTask(id, result) {
    const stmt = this.db.prepare("UPDATE tasks SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?");
    stmt.run(typeof result === 'object' ? JSON.stringify(result) : result, id);
  }

  // ═══════════════════════════════════════════
  // Conversations
  // ═══════════════════════════════════════════
  storeMessage(sessionId, role, content, toolCalls = null) {
    const stmt = this.db.prepare('INSERT INTO conversations (session_id, role, content, tool_calls) VALUES (?, ?, ?, ?)');
    stmt.run(sessionId, role, content, toolCalls ? JSON.stringify(toolCalls) : null);
  }

  getConversation(sessionId, limit = 50) {
    return this.db.prepare('SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at ASC LIMIT ?').all(sessionId, limit);
  }

  // ═══════════════════════════════════════════
  // Chat Sessions (Web UI History)
  // ═══════════════════════════════════════════
  createChatSession(id, title = 'New Chat') {
    this.db.prepare(
      `INSERT INTO chat_sessions (id, title) VALUES (?, ?)`
    ).run(id, title);
    return { id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0 };
  }

  getChatSessions(limit = 100) {
    return this.db.prepare(
      `SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?`
    ).all(limit);
  }

  getChatSession(id) {
    return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
  }

  updateSessionTitle(id, title) {
    this.db.prepare(
      `UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title, id);
  }

  updateSessionTimestamp(id) {
    this.db.prepare(
      `UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  incrementSessionMessageCount(id) {
    this.db.prepare(
      `UPDATE chat_sessions SET message_count = message_count + 1, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  deleteChatSession(id) {
    this.db.prepare('DELETE FROM conversations WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
  }

  getSessionMessages(sessionId, limit = 200) {
    return this.db.prepare(
      'SELECT role, content, tool_calls, created_at FROM conversations WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(sessionId, limit);
  }

  storeSessionMessage(sessionId, role, content) {
    this.db.prepare(
      'INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)'
    ).run(sessionId, role, content);
    this.incrementSessionMessageCount(sessionId);
  }

  searchChatSessions(query) {
    const pattern = `%${query}%`;
    return this.db.prepare(
      `SELECT DISTINCT s.* FROM chat_sessions s
       LEFT JOIN conversations c ON s.id = c.session_id
       WHERE s.title LIKE ? OR c.content LIKE ?
       ORDER BY s.updated_at DESC LIMIT 50`
    ).all(pattern, pattern);
  }

  // ═══════════════════════════════════════════
  // Skills
  // ═══════════════════════════════════════════
  registerSkill(name, description, path) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO skills (name, description, path, loaded_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(name, description, path);
  }

  getSkills() {
    return this.db.prepare('SELECT * FROM skills WHERE enabled = 1').all();
  }

  // ═══════════════════════════════════════════
  // OPERATIONS LOG
  // ═══════════════════════════════════════════
  logOperation(opType, target, toolName, args, sessionId = null) {
    const stmt = this.db.prepare(`
      INSERT INTO operations (op_type, target, tool_name, args, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(opType, target, toolName, typeof args === 'object' ? JSON.stringify(args) : args, sessionId);
    return result.lastInsertRowid;
  }

  completeOperation(id, status, resultSummary, fullResult = null) {
    const stmt = this.db.prepare(`
      UPDATE operations SET status = ?, result_summary = ?, full_result = ?, completed_at = datetime('now') WHERE id = ?
    `);
    stmt.run(status, resultSummary, fullResult ? (typeof fullResult === 'object' ? JSON.stringify(fullResult) : fullResult) : null, id);
  }

  getOperations(limit = 50) {
    return this.db.prepare('SELECT * FROM operations ORDER BY started_at DESC LIMIT ?').all(limit);
  }

  getOperationsByTarget(target) {
    return this.db.prepare('SELECT * FROM operations WHERE target = ? ORDER BY started_at DESC').all(target);
  }

  // ═══════════════════════════════════════════
  // SCAN RESULTS
  // ═══════════════════════════════════════════
  storeScanResult(scanType, target, scanner, data = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO scan_results (scan_type, target, scanner, ports, services, vulns, os_detected, raw_output, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      scanType, target, scanner,
      data.ports ? JSON.stringify(data.ports) : null,
      data.services ? JSON.stringify(data.services) : null,
      data.vulns ? JSON.stringify(data.vulns) : null,
      data.os || null,
      data.raw ? (typeof data.raw === 'object' ? JSON.stringify(data.raw) : data.raw) : null,
      data.severity || 'info'
    );
  }

  getScanResults(target = null, scanType = null) {
    let sql = 'SELECT * FROM scan_results WHERE 1=1';
    const params = [];
    if (target) { sql += ' AND target = ?'; params.push(target); }
    if (scanType) { sql += ' AND scan_type = ?'; params.push(scanType); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    return this.db.prepare(sql).all(...params);
  }

  // ═══════════════════════════════════════════
  // THREAT INTEL
  // ═══════════════════════════════════════════
  storeThreatIntel(intelType, identifier, data = {}) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO threat_intel 
      (intel_type, identifier, title, description, severity, cvss_score, affected_products, references_json, source, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      intelType, identifier,
      data.title || null,
      data.description || null,
      data.severity || null,
      data.cvss_score || null,
      data.affected_products ? JSON.stringify(data.affected_products) : null,
      data.references ? JSON.stringify(data.references) : null,
      data.source || 'unknown',
      data.published_at || null
    );
  }

  searchThreatIntel(query, intelType = null) {
    let sql = 'SELECT * FROM threat_intel WHERE (identifier LIKE ? OR title LIKE ? OR description LIKE ?)';
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];
    if (intelType) { sql += ' AND intel_type = ?'; params.push(intelType); }
    sql += ' ORDER BY fetched_at DESC LIMIT 50';
    return this.db.prepare(sql).all(...params);
  }

  getLatestCVEs(limit = 20) {
    return this.db.prepare(`
      SELECT * FROM threat_intel WHERE intel_type = 'cve' ORDER BY published_at DESC LIMIT ?
    `).all(limit);
  }

  getThreatIntelCount() {
    return this.db.prepare('SELECT COUNT(*) as count FROM threat_intel').get().count;
  }

  // ═══════════════════════════════════════════
  // FOFA RESULTS
  // ═══════════════════════════════════════════
  storeFofaResult(query, data = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO fofa_results (query, ip, port, protocol, domain, host, title, banner, server, os, country, city, cert_subject, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      query, data.ip || null, data.port || null, data.protocol || null,
      data.domain || null, data.host || null, data.title || null,
      data.banner || null, data.server || null, data.os || null,
      data.country || null, data.city || null, data.cert_subject || null,
      data.raw ? JSON.stringify(data.raw) : null
    );
  }

  getFofaResults(query = null) {
    if (query) {
      return this.db.prepare('SELECT * FROM fofa_results WHERE query = ? ORDER BY fetched_at DESC LIMIT 100').all(query);
    }
    return this.db.prepare('SELECT * FROM fofa_results ORDER BY fetched_at DESC LIMIT 100').all();
  }

  // ═══════════════════════════════════════════
  // EXPLOIT DB
  // ═══════════════════════════════════════════
  storeExploit(exploitId, data = {}) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO exploit_db 
      (exploit_id, title, description, platform, exploit_type, author, code, cve_ids, source_url, source, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      exploitId,
      data.title || null, data.description || null,
      data.platform || null, data.exploit_type || null,
      data.author || null, data.code || null,
      data.cve_ids ? JSON.stringify(data.cve_ids) : null,
      data.source_url || null, data.source || 'exploit-db',
      data.published_at || null
    );
  }

  searchExploits(query) {
    return this.db.prepare(`
      SELECT * FROM exploit_db WHERE title LIKE ? OR description LIKE ? OR cve_ids LIKE ? OR platform LIKE ?
      ORDER BY published_at DESC LIMIT 50
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  getExploitCount() {
    return this.db.prepare('SELECT COUNT(*) as count FROM exploit_db').get().count;
  }

  // ═══════════════════════════════════════════
  // ATTACK LOGS
  // ═══════════════════════════════════════════
  logAttack(operationId, phase, action, target, command = null, result = null, success = false) {
    const stmt = this.db.prepare(`
      INSERT INTO attack_logs (operation_id, phase, action, target, command, result, success)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(operationId, phase, action, target, command, result ? (typeof result === 'object' ? JSON.stringify(result) : result) : null, success ? 1 : 0);
  }

  getAttackLog(operationId) {
    return this.db.prepare('SELECT * FROM attack_logs WHERE operation_id = ? ORDER BY timestamp ASC').all(operationId);
  }

  // ═══════════════════════════════════════════
  // LEARNING HISTORY
  // ═══════════════════════════════════════════
  markLearned(source, resourceId, resourceType, itemsCount = 0) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO learning_history (source, resource_id, resource_type, items_count, fetched_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(source, resourceId, resourceType, itemsCount);
  }

  isLearned(source, resourceId) {
    const row = this.db.prepare('SELECT id FROM learning_history WHERE source = ? AND resource_id = ?').get(source, resourceId);
    return !!row;
  }

  getLearningStats() {
    return this.db.prepare(`
      SELECT source, resource_type, COUNT(*) as count, SUM(items_count) as total_items, MAX(fetched_at) as last_fetch
      FROM learning_history GROUP BY source, resource_type
    `).all();
  }

  // ═══════════════════════════════════════════
  // NUCLEI / PROJECTDISCOVERY RESULTS
  // ═══════════════════════════════════════════
  storeNucleiResult(target, data = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO nuclei_results (target, template_id, template_name, severity, matched_at, extracted_results, curl_command, raw_output)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      target,
      data.template_id || null, data.template_name || null,
      data.severity || 'info', data.matched_at || null,
      data.extracted_results ? JSON.stringify(data.extracted_results) : null,
      data.curl_command || null,
      data.raw ? (typeof data.raw === 'object' ? JSON.stringify(data.raw) : data.raw) : null
    );
  }

  getNucleiResults(target = null, severity = null) {
    let sql = 'SELECT * FROM nuclei_results WHERE 1=1';
    const params = [];
    if (target) { sql += ' AND target = ?'; params.push(target); }
    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    sql += ' ORDER BY scanned_at DESC LIMIT 100';
    return this.db.prepare(sql).all(...params);
  }

  // ═══════════════════════════════════════════
  // TOOL KNOWLEDGE
  // ═══════════════════════════════════════════
  storeToolKnowledge(toolName, data = {}) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tool_knowledge 
      (tool_name, category, description, usage_examples, install_command, official_url, documentation, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      toolName, data.category || null, data.description || null,
      data.usage_examples ? JSON.stringify(data.usage_examples) : null,
      data.install_command || null, data.official_url || null,
      data.documentation || null, data.source || 'auto-learned'
    );
  }

  searchToolKnowledge(query) {
    return this.db.prepare(`
      SELECT * FROM tool_knowledge WHERE tool_name LIKE ? OR description LIKE ? OR category LIKE ?
      ORDER BY tool_name LIMIT 30
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  getToolKnowledgeCount() {
    return this.db.prepare('SELECT COUNT(*) as count FROM tool_knowledge').get().count;
  }

  // ═══════════════════════════════════════════
  // FULL STATS
  // ═══════════════════════════════════════════
  getStats() {
    const tables = ['knowledge', 'targets', 'loot', 'tasks', 'skills', 'operations', 'scan_results', 'threat_intel', 'fofa_results', 'exploit_db', 'attack_logs', 'nuclei_results', 'tool_knowledge'];
    const stats = {};
    for (const table of tables) {
      try {
        const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        stats[table] = row.count;
      } catch {
        stats[table] = 0;
      }
    }
    // Active skills
    try {
      stats.active_skills = this.db.prepare('SELECT COUNT(*) as count FROM skills WHERE enabled = 1').get().count;
    } catch { stats.active_skills = 0; }
    return stats;
  }

  close() {
    if (this.db) this.db.close();
  }
}

// Singleton
export const memory = new Memory();
