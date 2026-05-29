// Jarvis Cyber v4.0 — Generate Report Tool
// AI-callable tool that triggers dynamic report generation
import { reportEngine } from '../report-engine.js';

export const definition = {
  type: 'function',
  function: {
    name: 'generate_report',
    description: 'Auto-generate a structured penetration test report from the current session\'s tool execution history. The report dynamically adapts to whatever tools and techniques were used — no hardcoded templates. Includes: Executive Summary, Methodology (Kill Chain phases), Findings, MITRE ATT&CK Mapping, Tool Usage Breakdown, Timeline, and Recommendations. Call this after completing any security assessment.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target identifier (domain, IP, URL, network range) for the report header',
        },
        objective: {
          type: 'string',
          description: 'Objective of the assessment (e.g., "Web Application Pentest", "Network Security Audit", "XSS Vulnerability Assessment")',
        },
      },
      required: ['target'],
    },
  },
};

export async function execute(args) {
  const { target, objective = 'Security Assessment' } = args;

  try {
    const result = reportEngine.generateReport({
      target,
      objective,
    });

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}
