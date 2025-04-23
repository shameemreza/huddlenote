// helpers/liveCapture.js
// ────────────────────────────────────────────────────────────
// • pickSource()          → pops a chooser dialog, returns source‑id
// • startLiveCapture(id)  → grabs that source to PNG every 2 s
// • stopLiveCapture(hdl)  → OCRs all PNGs, merges + de‑dupes lines
// ────────────────────────────────────────────────────────────
const { desktopCapturer, dialog } = require('electron');
const fs              = require('fs');
const path            = require('path');
const sharp           = require('sharp');
const { createWorker } = require('tesseract.js');

const CAP_DIR = path.join(__dirname, '../temp/frames');
function ensureDir () {
  if (!fs.existsSync(CAP_DIR)) fs.mkdirSync(CAP_DIR, { recursive: true });
}

/* ── 1. let user pick window / screen ────────────────────── */
async function pickSource () {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 300, height: 180 }
  });

  const list    = sources.map((s, i) => `${i}: ${s.name}`).join('\n');
  const { response } = await dialog.showMessageBox({
    type   : 'question',
    buttons: sources.map((_, i) => `${i}`),
    noLink : true,
    title  : 'Pick window to capture',
    message: 'Select the number for the Slack (or other) window:\n\n' + list
  });

  return sources[response]?.id;    // undefined = user hit ESC / closed dlg
}

/* ── 2. single PNG grab helper (big first → small fallback) ─ */
async function grabPNG (sourceId) {
  const grab = async (w, h) => {
    const arr = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: w, height: h }
    });
    const src = arr.find(s => s.id === sourceId) || arr[0];
    return src.thumbnail.toPNG();
  };

  let buf = await grab(1920, 1080);
  if (buf.length < 1000) buf = await grab(300, 180);   // fallback
  return buf;
}

/* ── 3. start periodic capture ───────────────────────────── */
function startLiveCapture (sourceId, interval = 2000) {
  ensureDir();

  const frames = [];
  const timer  = setInterval(async () => {
    try {
      const buf = await grabPNG(sourceId);
      if (buf.length < 1000) return;            // blank frame – permissions?

      const file = path.join(CAP_DIR, `f-${Date.now()}.png`);
      fs.writeFileSync(file, buf);
      console.log('[CAPTURE] wrote', file);
      frames.push(file);

    } catch (err) {
      console.error('[CAPTURE] write error:', err);
    }
  }, interval);

  return { timer, frames };
}

/* ── 4. stop timer, OCR every frame, merge unique chat lines ─ */
async function stopLiveCapture (handle) {
  clearInterval(handle.timer);
  if (handle.frames.length === 0) return '';           // nothing captured

  const worker = await createWorker('eng');
  const seen   = new Set();
  let   merged = '';

  const BATCH = 4;                                     // OCR 4 frames in par.
  for (let i = 0; i < handle.frames.length; i += BATCH) {
    const slice = handle.frames.slice(i, i + BATCH);

    /* OCR every PNG in the current batch */
    const results = await Promise.all(slice.map(async pngPath => {
      const raw  = fs.readFileSync(pngPath);
      const meta = await sharp(raw).metadata();

      /* Crop out Slack side‑bar (≈ 25 %) + header (≈ 12 %) */
      const xOff = Math.round(meta.width  * 0.25);
      const yOff = Math.round(meta.height * 0.12);
      const w    = meta.width  - xOff;
      const h    = meta.height - yOff;
      const regionOkay = w >= 200 && h >= 200;          // avoid <200 px errors

      const processed = await sharp(raw)
        .extract(regionOkay ? { left: xOff, top: yOff, width: w, height: h }
                            : undefined)
        .resize({ width: 3000 })       // upscale improves OCR accuracy
        .grayscale()
        .linear(1.4, -30)              // boost contrast
        .threshold(180)                // binarise
        .toBuffer();

      return (await worker.recognize(processed)).data.text;
    }));

    /* de‑dupe & only keep "username: message"‑looking lines */
    results.forEach(block =>
      block.split('\n').forEach(line => {
        const txt = line.trim();
        if (txt.includes(':') && !seen.has(txt)) {
          seen.add(txt);
          merged += txt + '\n';
        }
      })
    );
  }

  await worker.terminate();
  return merged.trim();
}

module.exports = { pickSource, startLiveCapture, stopLiveCapture };
