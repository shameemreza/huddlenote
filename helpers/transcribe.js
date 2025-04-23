// helpers/transcribe.js
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();          //  ← load .env first

// ------------ OpenAI v4 client ------------
const OpenAI = require('openai').default;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// ------------------------------------------

async function transcribe(audioPath) {
  // 1) try local whisper.cpp (if both binary *and* model exist)
  const whisperBin  = '/opt/homebrew/bin/whisper';
  const modelPath   = '/opt/homebrew/share/whisper/ggml-base.en.bin'; // adjust if you downloaded a model
  if (fs.existsSync(whisperBin) && fs.existsSync(modelPath)) {
    try {
      console.log('🖥️  Using local whisper.cpp …');
      const txtPath = path.join(path.dirname(audioPath), 'transcript.txt');
      execSync(
        `${whisperBin} "${audioPath}" -m ${modelPath} -f txt -otxt -of ${txtPath}`,
        { stdio: 'ignore' }
      );
      return fs.readFileSync(txtPath, 'utf8');
    } catch (err) {
      console.warn('Local whisper failed, falling back to API →', err.message);
    }
  }

  // 2) fallback → OpenAI Whisper API
  console.log('☁️  Using OpenAI Whisper API …');
  const resp = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1'
  });
  return resp.text;
}

module.exports = { transcribe };
