const apiKey = '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';


async function test() {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4-flash-0731',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 100
      })
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body);
  } catch (e) {
    console.error(e);
  }
}
test();
