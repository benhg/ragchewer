# CW Ragchewer

A cross-platform, browser-based HF CW ragchew simulator. Key with a straight key feel, hear sidetone (with QSB/QRM), decode in real time, and get human-like replies (local or LLM).

## Features

- Straight-key input via keyboard or mouse/touch
- Sidetone with adjustable tone, volume, envelope, key click, QSB/QRM
- Real-time Morse decode with adaptive timing and auto spacing
- Training mode (confirm before send) + practice prompts
- Optional LLM responses (client-side)
- Blurred received messages until you click to reveal
- Scratch pad for notes
- Farnsworth-style speed controls (character vs effective WPM)

## Quick start

```bash
npm install
npm run dev
```

Open the dev URL shown by Vite.

## Usage notes

- Default keying: Left Ctrl (change in the Key dropdown).
- Character speed controls element timing; effective speed controls spacing.
- Training mode disables auto-send and shows a Confirm Send button.
- Received messages are blurred until clicked.

## LLM setup (optional)

In the app, enable LLM responses and provide:

- Endpoint: `https://api.openai.com/v1/chat/completions`
- API key: your OpenAI key
- Model: defaults to `gpt-5-mini`

If the LLM is not configured or errors, the app falls back to local responses.

## Build

```bash
npm run build
npm run preview

## GitHub Pages

This app is fully client-side and can be hosted on GitHub Pages. After `npm run build`, deploy the `dist/` folder (e.g., with `gh-pages`). 
```

## License

MIT
