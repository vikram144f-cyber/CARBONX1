const geminiKey = "AQ.Ab8RN6Lmcakq4ejsknSqZeJA5Z7GtBJhXZFCgCCgAd4l6bAqaQ";

async function testGemini() {
  const modelName = "deep-research-preview-04-2026";
  console.log(`Testing Gemini API Key with model ${modelName}...`);
  try {
    const promptText = "You are an environmental carbon analyst. Respond with JSON: {\"status\": \"ok\", \"analysis\": \"Multi-modal carbon validation successful\"}";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      }
    );

    console.log("HTTP Status:", res.status, res.statusText);
    const body = await res.json();
    console.log("Response:\n", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Gemini Test Error:", err);
  }
}

testGemini();
