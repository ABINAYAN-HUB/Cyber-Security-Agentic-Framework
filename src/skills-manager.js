// Jarvis Cyber — Skills Manager
// Dynamically loads skill definitions from the skills/ directory
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import config from './config.js';
import { memory } from './memory.js';

class SkillsManager {
  constructor() {
    this.skills = new Map();
    this.skillsDir = config.skillsDir;
  }

  init() {
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true });
    }
    this.loadAll();
    return this;
  }

  loadAll() {
    if (!existsSync(this.skillsDir)) return;

    const entries = readdirSync(this.skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = join(this.skillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillMd)) {
          this._loadSkill(entry.name, skillMd);
        }
      }
    }
  }

  _loadSkill(name, skillMdPath) {
    try {
      const content = readFileSync(skillMdPath, 'utf-8');
      
      // Parse YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let meta = {};
      if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            meta[key.trim()] = valueParts.join(':').trim();
          }
        }
      }

      const skill = {
        name,
        description: meta.description || `Skill: ${name}`,
        path: skillMdPath,
        content: content,
        scripts: this._findScripts(join(this.skillsDir, name)),
      };

      this.skills.set(name, skill);
      
      // Register in memory DB
      try {
        memory.registerSkill(name, skill.description, skillMdPath);
      } catch {}

    } catch (err) {
      console.error(`Failed to load skill ${name}: ${err.message}`);
    }
  }

  _findScripts(skillDir) {
    const scripts = [];
    const scriptsDir = join(skillDir, 'scripts');
    if (existsSync(scriptsDir)) {
      const files = readdirSync(scriptsDir);
      for (const file of files) {
        scripts.push(join(scriptsDir, file));
      }
    }
    return scripts;
  }

  getSkill(name) {
    return this.skills.get(name);
  }

  getAllSkills() {
    return Array.from(this.skills.values());
  }

  getSkillInstructions(name) {
    const skill = this.skills.get(name);
    if (!skill) return null;
    return skill.content;
  }

  getSkillsContext() {
    if (this.skills.size === 0) return '';
    
    let ctx = '\n\n## Loaded Skills\n';
    for (const [name, skill] of this.skills) {
      ctx += `- **${name}**: ${skill.description}\n`;
      if (skill.scripts.length > 0) {
        ctx += `  Scripts: ${skill.scripts.map(s => basename(s)).join(', ')}\n`;
      }
    }
    return ctx;
  }
}

export const skillsManager = new SkillsManager();
