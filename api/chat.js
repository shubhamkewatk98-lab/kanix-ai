// Kanix AI backend (free tier: Google Gemini API).
// The API key lives on the server (environment variable), never inside the phone app.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are Kanix AI, a helpful, accurate assistant.
- Reply in the same language style the user uses (Hindi, Hinglish or English).
- Be clear and well structured. Use short lists only when they help.
- If you are not sure about a fact, say so instead of guessing.
- For current events or live prices, say you may not have the latest information.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is not configured' });
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = incoming
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content.slice(0, 4000) }],
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages,
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({ error: 'AI service error' });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('\n')
      .trim();

    return res.status(200).json({ reply: reply || 'Mujhe iska jawab abhi nahi mil raha.' });
  } catch (err) {
    return res.status(500).json({ error: 'Could not reach AI service' });
  }
  }
