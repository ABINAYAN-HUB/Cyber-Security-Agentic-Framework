import config from '../src/config.js';
import { chatCompletion, streamChat } from '../src/api.js';

async function run() {
  console.log(`\n--- Testing NVIDIA NIM Fix for DeepSeek Reasoning Timeouts ---`);
  console.log(`Model: ${config.model}`);
  console.log(`Note: DeepSeek V4 Pro and Flash can take >5 minutes to generate deep reasoning traces.`);
  console.log(`The bug causing "thinking for many times" was Node.js aborting the request at exactly 300 seconds (5 mins) and triggering a retry loop.`);
  console.log(`We have now injected an Undici Agent with a 30-minute headers timeout to tolerate this delay natively.\n`);

  try {
    const start = Date.now();
    console.log(`[STREAMING CHAT TEST] Sending prompt: "Say hello and nothing else."`);
    const stream = streamChat([{ role: 'user', content: 'Say hello and nothing else.' }]);
    
    for await (const chunk of stream) {
      if (chunk.type === 'thinking') {
         process.stdout.write(`[Thinking] ${chunk.content}`);
      } else if (chunk.type === 'text') {
         process.stdout.write(chunk.content);
      } else if (chunk.type === 'done') {
         console.log(`\n\n✅ Stream completed successfully! Time taken: ${((Date.now() - start) / 1000).toFixed(1)}s`);
      }
    }
  } catch(e) {
    console.error(`\n❌ Error:`, e);
  }
}

run();
