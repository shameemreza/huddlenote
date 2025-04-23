// helpers/captureThread.js
const { desktopCapturer, BrowserWindow } = require('electron');
const { nativeImage } = require('electron');
const fs   = require('fs');
const path = require('path');

async function grabSlackPNG() {
  // Find a source whose name includes “Slack”
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  const slackWin = sources.find(s => s.name.toLowerCase().includes('slack'));
  if (!slackWin) throw new Error('Slack window not found; open it first.');

  // Convert the thumbnail to PNG buffer
  const pngBuf = slackWin.thumbnail.toPNG();
  const file   = path.join(__dirname, '../temp/slack-thread.png');
  fs.writeFileSync(file, pngBuf);
  return file;
}

module.exports = { grabSlackPNG };