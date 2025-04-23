// helpers/recordAudio.js
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let recorder = null;
const audioFilePath = path.join(__dirname, '../temp/huddle-audio.wav');

function startRecording() {
  console.log('🔴 Starting audio recording...');

  recorder = spawn('ffmpeg', [
    '-y',
    '-f', 'avfoundation',
    '-i', ':0',          // 0 = "Huddle Input" aggregate
    '-filter:a', 'volume=1.5',   // 1.0 = original, 1.5 = +3‑4 dB
    '-ac', '2',
    '-ar', '48000',
    audioFilePath
  ]);

  recorder.stderr.on('data', (data) => {
    console.log('[FFMPEG]', data.toString());
  });

  recorder.on('error', (err) => {
    console.error('FFmpeg error:', err);
  });

  recorder.on('close', (code) => {
    console.log(`🔚 FFMPEG stopped with code ${code}`);
  });
}

function stopRecording() {
  return new Promise((resolve) => {
    console.log('🛑 Stopping recorder...');

    if (recorder) {
      recorder.once('close', () => {
        console.log('📁 Checking file:', audioFilePath);
        if (fs.existsSync(audioFilePath)) {
          console.log('✅ File saved');
          resolve(audioFilePath);
        } else {
          console.warn('⚠️ File not found');
          resolve(null);
        }
      });

      recorder.kill('SIGINT');
    } else {
      resolve(null);
    }
  });
}

module.exports = { startRecording, stopRecording };
