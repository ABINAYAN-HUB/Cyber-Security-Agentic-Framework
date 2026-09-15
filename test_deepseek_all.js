const apiKey = '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';
const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

async function testModel(modelName, desc) {
  console.log(`\n--- Testing ${modelName} (${desc}) ---`);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 50
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    console.log(`Status: ${res.status}`);
    const time = (Date.now() - start) / 1000;
    console.log(`Time taken: ${time}s`);
    if (res.ok) {
        const text = await res.text();
        console.log(`Response: ${text.substring(0, 100)}...`);
    } else {
        console.log(`Error Response: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`Failed after ${(Date.now() - start) / 1000}s: ${e.message}`);
  }
}

async function runAll() {
    await testModel('meta/llama-3.1-8b-instruct', 'Control Model - Llama');
    await testModel('deepseek-ai/deepseek-v4-flash-0731', 'Target Model - DeepSeek Flash');
    await testModel('deepseek-ai/deepseek-v4-pro-0813', 'Target Model - DeepSeek Pro');
}

runAll();
