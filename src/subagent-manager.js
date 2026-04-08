import { Agent } from './agent.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

class SubagentManager {
  constructor() {
    this.subagents = new Map();
    this.resultsDir = path.join(process.cwd(), '.subagents');
    
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Spawns a new background subagent to handle a task
   */
  spawnSubagent(taskDescription, namePrefix = 'worker') {
    const id = `${namePrefix}-${randomUUID().slice(0, 6)}`;
    
    const agent = new Agent(process.cwd());
    // Mark as subagent to suppress standard UI output
    agent.isSubagent = true;
    agent.subagentId = id;
    
    const statusData = {
      id,
      task: taskDescription,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      error: null
    };
    
    this.subagents.set(id, statusData);

    // Run the agent process decoupled from the main event loop return
    // We wrap the instruction to ensure it outputs a final result to a file.
    const instruction = `
You are a background subagent (ID: ${id}). You MUST complete the following task:
<task>
${taskDescription}
</task>

CRITICAL RULES:
1. You run in the background. You cannot ask the user for permission.
2. Complete the task using your tools.
3. When you are completely finished, write your final findings, results, or errors to the file: .subagents/${id}.log
4. Do NOT stop until the results are written to that file.
`;

    // Fire and forget execution
    agent.processMessage(instruction).then(() => {
      const status = this.subagents.get(id);
      if (status) {
        status.status = 'completed';
        status.endTime = new Date().toISOString();
      }
    }).catch((err) => {
      const status = this.subagents.get(id);
      if (status) {
        status.status = 'failed';
        status.error = err.message;
        status.endTime = new Date().toISOString();
      }
    });

    return id;
  }

  /**
   * Gets the status of a specific subagent, and reads its log if finished.
   */
  getStatus(id) {
    const data = this.subagents.get(id);
    if (!data) return { error: `Subagent ${id} not found.` };
    
    const resultPath = path.join(this.resultsDir, `${id}.log`);
    let output = null;
    
    if (fs.existsSync(resultPath)) {
      try {
        output = fs.readFileSync(resultPath, 'utf-8');
      } catch (e) {
        output = `Error reading log file: ${e.message}`;
      }
    }

    return { ...data, output };
  }

  /**
   * Lists all subagents.
   */
  getAllStatuses() {
    return Array.from(this.subagents.values()).map(data => {
      return { id: data.id, status: data.status, task: data.task };
    });
  }

  /**
   * Kills a subagent. 
   *(Note: Since they run in the exact same Node process via async functions, 
   * "killing" them forcibly mid-tool-execution is tricky without child processes. 
   * But we can mark them as killed and throw an abort internally if desired.)
   */
  killSubagent(id) {
    const data = this.subagents.get(id);
    if (!data) return { success: false, error: `Subagent not found` };
    
    // Mark as failed/killed - the agent class would need an abort signal to truly exit standard async loops.
    // For now, this is a soft-kill/ignore flag.
    data.status = 'killed_by_user';
    return { success: true, message: `Subagent ${id} marked as killed and results will be ignored.` };
  }
}

// Singleton instance export
export const manager = new SubagentManager();
