// Jarvis Cyber — Dynamic Tool Installer
// Auto-downloads and installs tools from apt, pip, go, GitHub, and web URLs
import { execSync, exec as execCb } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { memory } from './memory.js';
import { getToolInfo, invalidateCache } from './kali-tools-registry.js';
import config from './config.js';

const TOOL_DIR = join(config.dataDir, 'jarvis-tools');

class ToolInstaller {
  constructor() {
    if (!existsSync(TOOL_DIR)) {
      mkdirSync(TOOL_DIR, { recursive: true });
    }
  }

  /**
   * Check if a tool is available on the system
   * @param {string} toolName - Name or binary of the tool
   * @returns {boolean}
   */
  isInstalled(toolName) {
    const info = getToolInfo(toolName);
    const bin = info?.bin || toolName;
    try {
      execSync(`command -v ${bin}`, { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch { return false; }
  }

  /**
   * Install a tool by name — auto-detects install method from registry
   * @param {string} toolName
   * @returns {Object} { success, method, output, error }
   */
  installTool(toolName) {
    const info = getToolInfo(toolName);

    if (!info) {
      // Not in registry — try apt and pip as fallback
      return this._tryFallbackInstall(toolName);
    }

    if (this.isInstalled(toolName)) {
      return { success: true, method: 'already-installed', output: `${toolName} is already installed` };
    }

    const installCmd = info.install;
    const method = this._detectMethod(installCmd);

    // Force sudo to non-interactive mode to prevent hanging in headless environments
    const safeCmd = installCmd.replace(/\bsudo\b(?!\s+-[nSAkKp])/g, 'sudo -n');

    try {
      const output = execSync(safeCmd, {
        encoding: 'utf8',
        timeout: 300000, // 5 min timeout for large installs
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive', SUDO_ASKPASS: '/bin/false' },
      });

      // Invalidate tool cache after install
      invalidateCache();

      // Log to DB
      this._logInstall(toolName, method, installCmd, true);

      return { success: true, method, output: output.slice(0, 2000) };
    } catch (err) {
      this._logInstall(toolName, method, installCmd, false, err.message);
      return { success: false, method, error: err.message?.slice(0, 1000) || 'Unknown error' };
    }
  }

  /**
   * Install a tool from a GitHub repository URL
   * @param {string} repoUrl - e.g., 'https://github.com/user/repo'
   * @param {Object} options - { branch, buildCmd, language }
   * @returns {Object}
   */
  installFromGitHub(repoUrl, options = {}) {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
    const cloneDir = join(TOOL_DIR, repoName);

    try {
      // Clone
      if (existsSync(cloneDir)) {
        execSync(`cd ${cloneDir} && git pull`, { encoding: 'utf8', timeout: 60000 });
      } else {
        const branch = options.branch ? `-b ${options.branch}` : '';
        execSync(`git clone --depth 1 ${branch} ${repoUrl} ${cloneDir}`, {
          encoding: 'utf8', timeout: 120000,
        });
      }

      // Auto-detect build method
      let buildOutput = '';
      if (options.buildCmd) {
        buildOutput = execSync(`cd ${cloneDir} && ${options.buildCmd}`, {
          encoding: 'utf8', timeout: 300000,
        });
      } else if (existsSync(join(cloneDir, 'requirements.txt'))) {
        buildOutput = execSync(`cd ${cloneDir} && pip3 install -r requirements.txt`, {
          encoding: 'utf8', timeout: 120000,
        });
      } else if (existsSync(join(cloneDir, 'setup.py'))) {
        buildOutput = execSync(`cd ${cloneDir} && pip3 install .`, {
          encoding: 'utf8', timeout: 120000,
        });
      } else if (existsSync(join(cloneDir, 'go.mod'))) {
        buildOutput = execSync(`cd ${cloneDir} && go build -o ${join(TOOL_DIR, repoName)} .`, {
          encoding: 'utf8', timeout: 120000,
        });
      } else if (existsSync(join(cloneDir, 'Makefile'))) {
        buildOutput = execSync(`cd ${cloneDir} && make`, {
          encoding: 'utf8', timeout: 120000,
        });
      } else if (existsSync(join(cloneDir, 'Cargo.toml'))) {
        buildOutput = execSync(`cd ${cloneDir} && cargo build --release`, {
          encoding: 'utf8', timeout: 300000,
        });
      }

      invalidateCache();
      this._logInstall(repoName, 'github', repoUrl, true);

      return {
        success: true, method: 'github',
        path: cloneDir,
        output: buildOutput?.slice(0, 2000) || 'Cloned successfully',
      };
    } catch (err) {
      this._logInstall(repoName, 'github', repoUrl, false, err.message);
      return { success: false, method: 'github', error: err.message?.slice(0, 1000) || 'Clone/build failed' };
    }
  }

  /**
   * Install a tool from a direct download URL
   * @param {string} url
   * @param {string} toolName
   * @returns {Object}
   */
  installFromUrl(url, toolName) {
    const destDir = join(TOOL_DIR, toolName);
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

    const filename = url.split('/').pop() || toolName;
    const destPath = join(destDir, filename);

    try {
      execSync(`curl -sL -o ${destPath} "${url}"`, { timeout: 120000 });

      // Make executable if it looks like a binary
      if (!filename.endsWith('.tar.gz') && !filename.endsWith('.zip') && !filename.endsWith('.deb')) {
        execSync(`chmod +x ${destPath}`);
      }

      // Handle archives
      if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
        execSync(`tar xzf ${destPath} -C ${destDir}`, { timeout: 30000 });
      } else if (filename.endsWith('.zip')) {
        execSync(`unzip -o ${destPath} -d ${destDir}`, { timeout: 30000 });
      } else if (filename.endsWith('.deb')) {
        execSync(`sudo -n dpkg -i ${destPath}`, { timeout: 60000 });
      }

      invalidateCache();
      this._logInstall(toolName, 'url', url, true);

      return { success: true, method: 'url', path: destPath };
    } catch (err) {
      this._logInstall(toolName, 'url', url, false, err.message);
      return { success: false, method: 'url', error: err.message?.slice(0, 1000) || 'Download failed' };
    }
  }

  /**
   * Ensure a tool is available — install if missing
   * @param {string} toolName
   * @returns {Object}
   */
  ensureAvailable(toolName) {
    if (this.isInstalled(toolName)) {
      return { success: true, method: 'already-installed' };
    }
    return this.installTool(toolName);
  }

  /**
   * Install a Python module via pip
   * @param {string} moduleName
   * @returns {Object}
   */
  installPythonModule(moduleName) {
    try {
      const output = execSync(`pip3 install ${moduleName}`, {
        encoding: 'utf8', timeout: 120000,
      });
      return { success: true, method: 'pip', output: output.slice(0, 1000) };
    } catch (err) {
      return { success: false, method: 'pip', error: err.message?.slice(0, 500) };
    }
  }

  /**
   * Resolve a missing dependency error and install the required package
   * @param {string} errorMessage - The error output
   * @returns {Object|null} Install result or null if can't determine
   */
  resolveFromError(errorMessage) {
    if (!errorMessage) return null;

    // Python: ModuleNotFoundError
    const pyModuleMatch = errorMessage.match(/ModuleNotFoundError:\s+No module named '([^']+)'/);
    if (pyModuleMatch) {
      return this.installPythonModule(pyModuleMatch[1]);
    }

    // Command not found
    const cmdNotFoundMatch = errorMessage.match(/(?:bash:\s+)?(\S+):\s+(?:command )?not found/i);
    if (cmdNotFoundMatch) {
      return this.installTool(cmdNotFoundMatch[1]);
    }

    // npm packages
    const npmMatch = errorMessage.match(/Cannot find module '([^']+)'/);
    if (npmMatch) {
      try {
        const output = execSync(`npm install ${npmMatch[1]}`, { encoding: 'utf8', timeout: 60000 });
        return { success: true, method: 'npm', output: output.slice(0, 500) };
      } catch (err) {
        return { success: false, method: 'npm', error: err.message?.slice(0, 500) };
      }
    }

    // Go packages
    const goMatch = errorMessage.match(/cannot find package "([^"]+)"/);
    if (goMatch) {
      try {
        const output = execSync(`go get ${goMatch[1]}`, { encoding: 'utf8', timeout: 60000 });
        return { success: true, method: 'go', output: output.slice(0, 500) };
      } catch (err) {
        return { success: false, method: 'go', error: err.message?.slice(0, 500) };
      }
    }

    return null;
  }

  // ═══ PRIVATE HELPERS ═══

  _detectMethod(installCmd) {
    if (installCmd.startsWith('sudo apt') || installCmd.startsWith('apt ')) return 'apt';
    if (installCmd.startsWith('pip') || installCmd.includes('pip3')) return 'pip';
    if (installCmd.startsWith('go install')) return 'go';
    if (installCmd.startsWith('git clone')) return 'git';
    if (installCmd.startsWith('gem ')) return 'gem';
    if (installCmd.startsWith('cargo ')) return 'cargo';
    if (installCmd.startsWith('npm ')) return 'npm';
    if (installCmd.startsWith('curl')) return 'curl';
    return 'custom';
  }

  _tryFallbackInstall(toolName) {
    // Try apt first
    try {
      const output = execSync(`sudo -n apt install -y ${toolName}`, {
        encoding: 'utf8', timeout: 120000,
        env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive', SUDO_ASKPASS: '/bin/false' },
      });
      invalidateCache();
      this._logInstall(toolName, 'apt-fallback', `sudo apt install -y ${toolName}`, true);
      return { success: true, method: 'apt', output: output.slice(0, 1000) };
    } catch { /* try pip */ }

    // Try pip
    try {
      const output = execSync(`pip3 install ${toolName}`, {
        encoding: 'utf8', timeout: 60000,
      });
      this._logInstall(toolName, 'pip-fallback', `pip3 install ${toolName}`, true);
      return { success: true, method: 'pip', output: output.slice(0, 1000) };
    } catch { /* fallthrough */ }

    return { success: false, method: 'unknown', error: `Could not find install method for '${toolName}'. Not in Kali registry, apt, or pip.` };
  }

  _logInstall(toolName, method, source, success, error = null) {
    try {
      memory.init();
      const stmt = memory.db.prepare(`
        INSERT OR REPLACE INTO installed_tools (tool_name, install_method, install_source, installed_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      stmt.run(toolName, method, source);
    } catch { /* DB not available yet — ignore */ }
  }
}

export const toolInstaller = new ToolInstaller();
