const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || ''; // optional but recommended

const SYSTEM_PROMPT = {
  role: 'system',
  content: 'You are DeftAI, a highly intelligent, polite and logical AI assistant. Reply in the same language the user writes in. Give smart, well-structured, precise answers.'
};

app.get('/health', (req, res) => res.send('ok'));

app.post('/api/chat', async (req, res) => {
  if (ACCESS_PASSWORD && req.get('x-access-code') !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  if (!GROQ_KEY) return res.status(500).json({ error: 'GROQ_API_KEY set nahi hai' });

  const history = Array.isArray(req.body.messages) ? req.body.messages.slice(-10) : [];
  const messages = [SYSTEM_PROMPT, ...history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 8000)
  }))];

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, stream: true }),
      signal: controller.signal
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e) });
    else res.end();
  }
});

app.listen(process.env.PORT || 3000, () => console.log('DeftAI running'));
