const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

// ---------- Claude (Anthropic) ----------
app.post('/api/claude', async (req, res) => {
  const { apiKey, model, system, prompt } = req.body || {};
  if (!apiKey) return sendError(res, 400, 'مفتاح Claude مفقود');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-5',
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return sendError(res, r.status, data?.error?.message || 'خطأ من Claude');
    }
    const text = data?.content?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    sendError(res, 500, 'تعذر الاتصال بـ Claude: ' + err.message);
  }
});

// ---------- ChatGPT (OpenAI) ----------
app.post('/api/openai', async (req, res) => {
  const { apiKey, model, system, prompt } = req.body || {};
  if (!apiKey) return sendError(res, 400, 'مفتاح ChatGPT مفقود');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: 900,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return sendError(res, r.status, data?.error?.message || 'خطأ من ChatGPT');
    }
    const text = data?.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (err) {
    sendError(res, 500, 'تعذر الاتصال بـ ChatGPT: ' + err.message);
  }
});

// ---------- Gemini (Google) ----------
app.post('/api/gemini', async (req, res) => {
  const { apiKey, model, system, prompt } = req.body || {};
  if (!apiKey) return sendError(res, 400, 'مفتاح Gemini مفقود');

  try {
    const modelName = model || 'gemini-3.6-flash';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    const data = await r.json();
    if (!r.ok) {
      return sendError(res, r.status, data?.error?.message || 'خطأ من Gemini');
    }

    // نأخذ فقط الأجزاء النهائية (نتجاهل أي جزء تفكير داخلي إن وُجد)
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join('\n')
      .trim();

    res.json({ text: text || '(رد فارغ)' });
  } catch (err) {
    sendError(res, 500, 'تعذر الاتصال بـ Gemini: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`غرفة الكتّاب تعمل على http://localhost:${PORT}`);
});
