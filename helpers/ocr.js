// helpers/ocr.js
const { createWorker } = require('tesseract.js');
async function ocrImage(pngPath) {
  const worker = await createWorker('eng');   // downloads traineddata on first run
  const { data: { text } } = await worker.recognize(pngPath);
  await worker.terminate();
  return text.trim();
}
module.exports = { ocrImage };
