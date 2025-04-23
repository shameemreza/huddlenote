// helpers/summariseLarge.js
// ──────────────────────────────────────────────
//  • Splits very long transcript+chat blobs
//    into ≤ 9 k‑token chunks
//  • Summarises each chunk
//  • Merges the partial summaries once more
// ──────────────────────────────────────────────
let enc;
let tokens;

try {
  // precise count (≈1‑2 ms per 10 k tokens)
  const { encoding_for_model } = require('@dqbd/tiktoken');
  enc     = encoding_for_model('gpt-3.5-turbo');
  tokens  = str => enc.encode(str).length;
} catch (err) {
  console.warn('[summariseLarge] @dqbd/tiktoken not installed – using rough estimator (~4 chars per token)');
  tokens  = str => Math.ceil(str.length / 4);         // ≈80‑90 % accurate
}

const OpenAI = require('openai').default;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_CTX    = 24_000;      // “safe” context window
const CHUNK_SIZE =  9_000;      // leave room for prompt + answer

/* ── split on sentence boundaries, keep ≤ CHUNK_SIZE tokens ── */
function chunk(raw) {
  const out = []; let buf = '';
  raw.split(/(?<=\.)\s+/).forEach(sentence => {
    if (tokens(buf + sentence) > CHUNK_SIZE) {
      out.push(buf.trim()); buf = sentence + ' ';
    } else {
      buf += sentence + ' ';
    }
  });
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/* summarise a single chunk */
async function summariseOnce(text, part, total) {
  const res = await openai.chat.completions.create({
    model   : 'gpt-4o-mini',
    stream  : false,
    messages: [
      { role: 'system',
        content: `You’re a meeting‑notes assistant. Summarise chunk ${part}/${total}.` },
      { role: 'user', content: text }
    ]
  });
  return res.choices[0].message.content.trim();
}

/* public entry point ------------------------------------------------ */
async function summariseLarge(raw) {
  /* small enough → one‑shot */
  if (tokens(raw) <= MAX_CTX) {
    return await summariseOnce(raw, 1, 1);
  }

  /* otherwise chunk + summarise each part */
  const parts     = chunk(raw);
  const partials  = [];
  for (let i = 0; i < parts.length; i++) {
    partials.push(await summariseOnce(parts[i], i + 1, parts.length));
  }

  /* merge partial summaries */
  const merged = partials.join('\n\n');
  return summariseOnce(
    'Combine these partial summaries into a final set of meeting notes:\n\n' + merged,
    'final', 'final'
  );
}

module.exports = { summariseLarge };
