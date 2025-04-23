# Huddle Note

**AI-powered meeting assistant for macOS**  
Capture audio and screen from any window (Slack huddle, Zoom, Meet, etc). Summarize key points, decisions, and action items in seconds.

## Features

- Record system audio (even with headphones)
- Capture screenshots of the huddle thread
- Transcribe using OpenAI Whisper
- Chunk + summarize long meetings using GPT
- Custom summary prompt support
- Settings UI for models, snapshots, and preferences
- Auto-cleanup of temp files
- Built with Electron + Node.js

## Setup

**1. Install dependencies** `npm install`

**2. Add your OpenAI API key** Create a `.env` file in the project root: `OPENAI_API_KEY=your_api_key_here`

**3. Install FFmpeg** `brew install ffmpeg`

**4. Install BlackHole for audio routing** `brew install blackhole-2ch`

**5. Run locally** `npm start`

## Project Structure

```
├── main.js           # Electron main process
├── preload.js        # Secure preload bridge
├── renderer.js       # Frontend logic
├── helpers/          # Capture, OCR, summary, audio, config, etc
├── temp/             # Auto-cleaned after each run
├── .env              # OpenAI API key (ignored in git)
└── index.html        # App UI
```
## License
MIT - Do whatever you want, just don't blame me if it breaks.
