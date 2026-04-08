import { streamChat } from './src/api.js';
import { toolDefinitions } from './src/tools/index.js';
import config from './src/config.js';

async function test() {
   config.apiKey = process.env.NVIDIA_API_KEY || 'dummy'; // Ensure api key
   console.log("Starting stream...");
   try {
     const stream = streamChat([{role: 'user', content: 'hi'}], [], 'System prompt');
     for await (const chunk of stream) {
        console.log("Chunk:", chunk.type);
     }
   } catch(e) {
     console.error("Error:", e);
   }
}
test();
