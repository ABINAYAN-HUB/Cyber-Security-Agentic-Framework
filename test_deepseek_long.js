const apiKey = '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';
const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

async function testLong() {
  console.log(`\n--- Testing deepseek-ai/deepseek-v4-flash-0731 (Expect ~5 minutes delay) ---`);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4-flash-0731',
        messages: [{ role: 'user', content: 'Say hello and nothing else.' }],
        max_tokens: 50
      }),
      // Native fetch has a 300s (5m) headers timeout. 
      // If NVIDIA takes >5m, this will still throw unless we override Undici dispatchers, 
      // but let's let it run to demonstrate.
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
    console.log(`Failed after ${(Date.now() - start) / 1000}s: ${e.stack}`);
  }
}

testLong();
