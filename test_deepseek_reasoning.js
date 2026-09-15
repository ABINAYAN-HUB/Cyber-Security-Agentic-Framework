import config from './src/config.js';
import { chatCompletion } from './src/api.js';

async function run() {
  console.log("Testing DeepSeek V4 Flash with forced chat_template_kwargs...");
  try {
    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v4-flash-0731",
        messages: [{ role: "user", content: "Say hello and nothing else." }],
        max_tokens: 100,
        chat_template_kwargs: {
          enable_thinking: false
        }
      })
    });
    console.log(`Status: ${res.status} in ${(Date.now() - start)/1000}s`);
    const data = await res.text();
    console.log(data);
  } catch(e) {
    console.error(e);
  }
}
run();
