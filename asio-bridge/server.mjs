import { WebSocketServer } from 'ws';
import { RtAudio, RtAudioApi, RtAudioFormat } from 'audify';

const PORT = Number(process.env.PORT ?? 4174);
const HOST = '127.0.0.1';

function apiEnum(name) {
  if (name === 'wasapi') return RtAudioApi.WINDOWS_WASAPI;
  return RtAudioApi.WINDOWS_ASIO;
}

function listInputDevices(apiName) {
  const rt = new RtAudio(apiEnum(apiName));
  return rt
    .getDevices()
    .filter((d) => d.inputChannels > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      inputChannels: d.inputChannels,
      sampleRates: d.sampleRates ?? [48000],
      preferredSampleRate: d.preferredSampleRate || 48000,
      isDefaultInput: !!d.isDefaultInput,
    }));
}

const wss = new WebSocketServer({ host: HOST, port: PORT });
console.log(`[GMA ASIO Bridge] Listening on ws://${HOST}:${PORT}`);

wss.on('connection', (ws) => {
  let rt = null;

  const stopStream = () => {
    if (!rt) return;
    try {
      if (rt.isStreamRunning()) rt.stop();
      if (rt.isStreamOpen()) rt.closeStream();
    } catch {
      // ignore
    }
    rt = null;
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === 'list') {
      try {
        const devices = listInputDevices(msg.api);
        ws.send(JSON.stringify({ type: 'devices', devices }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
      return;
    }

    if (msg.type === 'stop') {
      stopStream();
      return;
    }

    if (msg.type === 'start') {
      stopStream();
      try {
        rt = new RtAudio(apiEnum(msg.api));
        const devices = rt.getDevices().filter((d) => d.inputChannels > 0);
        const dev = devices.find((d) => d.id === msg.deviceId) ?? devices.find((d) => d.isDefaultInput) ?? devices[0];
        if (!dev) throw new Error('No audio input devices found for this driver API.');

        const sampleRate = dev.preferredSampleRate || 48000;
        const nChannels = Math.min(dev.inputChannels, Math.max(1, (msg.channel | 0) + 1));
        const targetCh = Math.max(0, Math.min(nChannels - 1, msg.channel | 0));

        // frameSize 0 lets the ASIO driver pick its native low-latency buffer (e.g. 64/128 samples).
        rt.openStream(
          null,
          { deviceId: dev.id, nChannels, firstChannel: 0 },
          RtAudioFormat.RTAUDIO_FLOAT32,
          sampleRate,
          0,
          'GMA-ASIO-Bridge',
          (pcmBuf) => {
            if (ws.readyState !== 1) return;
            const interleaved = new Float32Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.byteLength / 4);
            if (nChannels === 1) {
              ws.send(Buffer.from(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength));
              return;
            }
            const frames = Math.floor(interleaved.length / nChannels);
            const mono = new Float32Array(frames);
            for (let i = 0; i < frames; i++) mono[i] = interleaved[i * nChannels + targetCh];
            ws.send(Buffer.from(mono.buffer));
          },
          null,
        );
        rt.start();
        ws.send(JSON.stringify({ type: 'started', sampleRate, device: dev.name, channel: targetCh }));
        console.log(`[GMA ASIO Bridge] Streaming "${dev.name}" ch ${targetCh + 1} @ ${sampleRate} Hz (${msg.api})`);
      } catch (e) {
        stopStream();
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
    }
  });

  ws.on('close', stopStream);
});
