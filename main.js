// main.js  ── Electron entry
// ───────────────────────────────────────────────────────────
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const rimraf = require('rimraf');
const which = require('which');
require('dotenv').config();

const cfg = require('./helpers/config');   // user settings
const { summariseLarge } = require('./helpers/summariseLarge');

// ── helpers ────────────────────────────────────────────────
const { startRecording, stopRecording } = require('./helpers/recordAudio');
const { transcribe }       = require('./helpers/transcribe');
const { pickSource, startLiveCapture, stopLiveCapture } = require('./helpers/liveCapture');

// ---------- one‑time setup: verify ffmpeg + ensure temp dir ----------
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
rimraf.sync(path.join(TEMP_DIR, '**/*'));        // clean leftovers

function ensureFFmpeg() {
  try { which.sync('ffmpeg'); }
  catch (_) {
    dialog.showErrorBox(
      'Missing dependency',
      'ffmpeg is not installed.\n\nRun:\n  brew install ffmpeg\n\nand restart HuddleNote.'
    );
    app.quit();
  }
}

// ---------- window factory ----------
function createWindow () {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile('renderer/index.html');
}

// ---------- Electron life‑cycle ----------
app.whenReady().then(() => {
  ensureFFmpeg();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- state holders ----------
let liveCapHandle = null;

/* ── IPC handlers ───────────────────────────────────────── */

// A) start recording  +  start live chat capture
ipcMain.handle('start-recording', async () => {
  const sourceId = await pickSource();
  if (!sourceId) return { status: 'cancelled' };

  startRecording();                               // audio
  liveCapHandle = startLiveCapture(sourceId);     // screenshots
  return { status: 'started' };
});

// B) stop both, transcribe later in renderer
ipcMain.handle('stop-recording', async () => {
  const wav   = await stopRecording();
  const threadText = await stopLiveCapture(liveCapHandle);
  liveCapHandle = null;
  return { status: wav ? 'stopped' : 'failed', file: wav, threadText };
});

// C) transcribe audio (local whisper → cloud fallback)
ipcMain.handle('transcribe-audio', async (_e, filePath) => {
  try {
    const text = await transcribe(filePath);

    // delete WAV if user doesn’t want raw files
    if (!cfg.keepRaw) fs.unlinkSync(filePath);

    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// D) ask GPT to merge transcript + chat
ipcMain.handle('gpt-summary', async (_e, { transcript, thread }) => {
  const OpenAI = require('openai').default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: cfg.prompt },
      { role: 'user',
        content:
`Transcript:
${transcript}

Chat thread:
${thread}` }
    ]
  });

  // clean frame PNGs unless user wants them
  if (!cfg.keepRaw) rimraf.sync(path.join(__dirname, 'temp/frames/*'));

  return resp.choices[0].message.content;
});

ipcMain.handle('gpt-summary-large', async (_e, { transcript, thread }) => {
  const raw = `TRANSCRIPT:\n${transcript}\n\nCHAT:\n${thread}`;
  return await summariseLarge(raw);
});