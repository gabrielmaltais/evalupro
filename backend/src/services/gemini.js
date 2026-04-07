async function generateSummary(inputText) {
  if (!process.env.GEMINI_API_KEY) return "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: inputText }] }] }),
  });
  if (!response.ok) throw new Error("Erreur Gemini");
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

module.exports = { generateSummary };
