// renderer/renderer.js  ── runs in BrowserWindow
// Drives the UI and calls the IPC pipeline
// ───────────────────────────────────────────────
const startBtn   = document.getElementById('start-btn');
const stopBtn    = document.getElementById('stop-btn');
const summaryBox = document.getElementById('summary-box');

// helper to update the status label in one place
const step = txt => (summaryBox.innerText = txt);

/* ---------- START capture ---------- */
startBtn.onclick = async () => {
  const res = await window.electronAPI.invoke('start-recording');

  if (res.status === 'cancelled') {
    step("⚠️  Capture cancelled.");
    return;
  }
  step("🎧 Recording started…");
  startBtn.disabled = true;
  stopBtn.disabled  = false;
};

/* ---------- STOP  → transcribe → summarise ---------- */
stopBtn.onclick = async () => {
  step("⏳ Finishing recording…");
  startBtn.disabled = false;
  stopBtn.disabled  = true;

  /* 1 — stop audio + get chat text */
  const rec = await window.electronAPI.invoke('stop-recording');
  if (!rec.file) { step("⚠️ Recording failed."); return; }

  /* 2 — transcribe */
  step("📝 Transcribing audio…");
  const tr = await window.electronAPI.invoke('transcribe-audio', rec.file);
  if (!tr.ok) {
    step(`❌ Transcription error: ${tr.error || 'unknown'}`);
    return;
  }

  /* 3 — decide which summariser to call
         super‑rough: 1 token ≈ 4 chars                      */
  const approxTokens =
        Math.round((tr.text.length + rec.threadText.length) / 4);

  const IPC   = approxTokens > 20_000 ? 'gpt-summary-large'
                                      : 'gpt-summary';
  const note  = approxTokens > 20_000
      ? "🤖 Summarising large meeting… this might take a minute…"
      : "🤖 Summarising... Please wait!!";
  step(note);

  const finalText = await window.electronAPI.invoke(IPC, {
    transcript : tr.text,
    thread     : rec.threadText
  });

  /* 4 — display notes */
  step("✅ Meeting Notes:\n\n" + finalText);
};
