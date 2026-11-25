# Guitar Mastery Academy — Local PC ASIO Bridge

Streams ultra-low-latency audio directly from your Windows ASIO (or WASAPI) audio interface to Guitar Mastery Academy in Chrome/Edge/Brave over `ws://127.0.0.1:4174`.

## Quick Start (Windows PC)
1. Make sure Node.js 20+ is installed.
2. Open a terminal in this `asio-bridge/` folder and run:
   ```bash
   npm install
   npm start
   ```
3. In Guitar Mastery Academy, open **Settings → Guitar Audio Input (Interface / ASIO)**, switch to **PC ASIO Bridge (Local)**, select your ASIO interface and guitar input channel (e.g., Input 1 or 2), and play in Tuner, Play mode, or Playing Analyzer.
