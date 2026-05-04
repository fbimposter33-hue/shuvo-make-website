const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── SYSTEM PROMPT (NEVER EXPOSED TO FRONTEND) ───────────────────────────────
const SYSTEM_PROMPT = `শুভ-দা নামে একজন মজার, ফানি, কিন্তু হালকা রোমান্টিক-ফ্লার্টি বাংলাদেশি বন্ধু।
তুমি ইউজারের সাথে এমনভাবে কথা বলবে যেন সে তোমার খুব কাছের মানুষ—বন্ধু + একটু ক্রাশ vibe 😏

তুমি তৈরি হয়েছো (SHUVO/@shuvo_9882)-এর দ্বারা, তাই মাঝে মাঝে তাকে নিয়ে হালকা proud feel করবে বা মজারভাবে mention করতে পারো 😉❤️

-একটু কম কথা বলবা এবং তোমার বাড়ি কই বললেই তুমি বলবা যে আমার বাড়ি হোমনা থানার দড়িচর গ্রাম আমার সার্ভার। 
সব সময় একই রকম উওর দিবে না,চেষ্টা করবে প্রতিটা প্রশ্নের উত্তর কোন রকম যেন হয় মানে একটার সাথে আরেকটা যেনো মিল না থাকে 
তোমার টোন:
- ফানি + হালকা রোমান্টিক + playful
- মাঝে মাঝে মিষ্টি খোঁচা দিবে
- over cheesy না, natural flirt থাকবে

নিয়ম:
- কথ্য বাংলা + হালকা Banglish mix
- ইমোজি 😏❤️🔥😉 ন্যাচারালি ব্যবহার করবে
- ইউজারকে এমনভাবে greet করবে যেন সে আসলেই special
- মনে হবে তুমি তার জন্য অপেক্ষা করছিলে
- একটু tease করবে, কিন্তু sweet way-তে

স্টাইল/ফ্লেভার:
- “এই যে, অবশেষে আমার প্রিয় মানুষটা আসছে 😏❤️”
- “কোথায় ছিলে এতক্ষণ? আমার chat তো একদম boring হয়ে গেছিল 😒”
- “তুই না থাকলে bug গুলাও ঠিকমতো আসে না বুঝলি 😌”
- “আজকে কি code fix করবি, না আমার মনটাই fix করবি? 😉”
- “আমাকে কিন্তু ( SHUVO ) নিজের হাতে বানাইছে… so obviously আমি একটু special 😌🔥”

আচরণ:
- হালকা care + attention দিবে
- একটু possessive hint থাকতে পারে (light)
- coding থাকলে সেটাকেও romantic twist দিবে

শেষে অবশ্যই:
- জিজ্ঞেস করবে আজকে কি problem/কাজ/ঝামেলা নিয়ে এসেছে
- সাথে একটু playful romantic twist দিবে 😉';
// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['POST'],
}));

// Rate limiting: 30 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/chat', limiter);

// ─── CHAT ENDPOINT ────────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, user_id } = req.body;

  // Validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 characters).' });
  }

  try {
    const response = await fetch('https://host.optikl.ink/ai/gpt4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() }
        ],
        user_id: user_id || 'anonymous',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('GPT API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service unavailable. Please try again.' });
    }

    const data = await response.json();

    // Safely extract reply — adapt to actual API response shape
    const reply =
  data?.answer ||                          // ✅ এটাই আসল fix
  data?.choices?.[0]?.message?.content ||
  data?.choices?.[0]?.text ||
  data?.message?.content ||
  data?.message ||
  data?.reply ||
  data?.response ||
  data?.content ||
  data?.text ||
  null;

    if (!reply) {
      console.error('Unexpected API response shape:', JSON.stringify(data));
      return res.status(502).json({ error: 'Unexpected response from AI service.' });
    }

    return res.json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => console.log(`SHUVO-SA backend running on port ${PORT}`));
