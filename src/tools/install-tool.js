// Jarvis Cyber — install_tool — AI-callable tool for dynamic tool installation
import { toolInstaller } from '../tool-installer.js';

export const definition = {
  type: 'function',
  function: {
    name: 'install_tool',
    description: 'Dynamically install a security tool from apt, pip, go, GitHub, or URL. Use this when a tool is needed but not available on the system. Supports: Kali Linux tools, GitHub repos, Python packages, Go tools, and direct downloads.',
    parameters: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Name of the tool to install (e.g., "nmap", "gobuster", "linpeas", "nuclei")',
        },
        source: {
          type: 'string',
          description: 'Optional: Source URL for GitHub repos or direct downloads (e.g., "https://github.com/user/repo")',
        },
        install_method: {
          type: 'string',
          enum: ['auto', 'apt', 'pip', 'go', 'github', 'url', 'npm', 'gem', 'cargo'],
          description: 'Installation method. Default: auto (auto-detect from registry)',
        },
        python_module: {
          type: 'string',
          description: 'Optional: Python module name if installing a pip package (e.g., "requests", "pwntools")',
        },
      },
      required: ['tool_name'],
    },
  },
};

export async function execute(args) {
  const { tool_name, source, install_method = 'auto', python_module } = args;

  try {
    // Check if already installed
    if (toolInstaller.isInstalled(tool_name)) {
      return {
        success: true,
        tool: tool_name,
        status: 'already_installed',
        message: `${tool_name} is already available on this system`,
      };
    }

    let result;

    // Python module install
    if (python_module || install_method === 'pip') {
      result = toolInstaller.installPythonModule(python_module || tool_name);
    }
    // GitHub install
    else if (source && (source.includes('github.com') || install_method === 'github')) {
      result = toolInstaller.installFromGitHub(source);
    }
    // URL download
    else if (source && (source.startsWith('http') && install_method !== 'github')) {
      result = toolInstaller.installFromUrl(source, tool_name);
    }
    // Auto or specific method
    else {
      result = toolInstaller.installTool(tool_name);
    }

    if (result.success) {
      return {
        success: true,
        tool: tool_name,
        method: result.method,
        status: 'installed',
        message: `Successfully installed ${tool_name} via ${result.method}`,
        output: result.output?.slice(0, 1000) || '',
        path: result.path || null,
      };
    } else {
      return {
        success: false,
        tool: tool_name,
        method: result.method,
        error: result.error || 'Installation failed',
        suggestion: `Try: install_tool with source="https://github.com/..." or install_method="pip"`,
      };
    }
  } catch (err) {
    return {
      success: false,
      tool: tool_name,
      error: err.message || 'Unexpected error during installation',
    };
  }
}
