// helpers/config.js
// --------------------------------------------
// Central place for user‑editable settings.
// Extend this JSON structure as you add UI.
// --------------------------------------------
const fs   = require('fs');
const path = require('path');
const cfgPath = path.join(__dirname, '../config.json');

const defaults = {
  prompt: 'Write concise, human‑sounding meeting notes.',
  keepRaw: false              // set true in Settings to keep WAV + PNGs
};

if (!fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, JSON.stringify(defaults, null, 2));
}

module.exports = JSON.parse(fs.readFileSync(cfgPath));
