const key = "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";

async function testNvidia() {
  console.log("Testing NVIDIA NIM API Key with model meta/llama-3.3-70b-instruct...");
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          {
            role: "user",
            content: "You are an environmental carbon analyst. Return a JSON object with keys: summary, score, status.",
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    console.log("HTTP Status:", res.status, res.statusText);
    const body = await res.json();
    console.log("Full NVIDIA Response:\n", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("NVIDIA Test Error:", err);
  }
}

testNvidia();
