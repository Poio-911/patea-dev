import fetch from "node-fetch";

const API_KEY = "AIzaSyCsXE7FonqgCYz70c1xbxSe20F7Qr1oWU0"; // tu GOOGLE_GENAI_API_KEY
const MODEL = "gemini-1.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const body = {
  contents: [
    { role: "user", parts: [{ text: "Say hello from Gemini" }] }
  ]
};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
})
  .then(async res => {
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    console.log("✅ Respuesta del modelo:\n", JSON.stringify(data, null, 2));
  })
  .catch(err => console.error("❌ Error:", err.message));
