export interface AudioRecordResult {
  blob: Blob;
  url: string;
  duration: number; // in seconds
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

export function createDemoAudioVoice(seconds: number = 3): Promise<AudioRecordResult> {
  try {
    const sampleRate = 44100;
    const numFrames = Math.max(1, Math.round(sampleRate * seconds));
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

    if (!AudioCtx || !OfflineCtx) {
      const dummy = new Blob([], { type: 'audio/wav' });
      return Promise.resolve({
        blob: dummy,
        url: 'https://actions.google.com/sounds/v1/communication/incoming_call.ogg',
        duration: seconds
      });
    }

    const offlineCtx = new OfflineCtx(1, numFrames, sampleRate);
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, 0);
    osc.frequency.exponentialRampToValueAtTime(480, 0.5);
    osc.frequency.exponentialRampToValueAtTime(540, 1.2);
    osc.frequency.exponentialRampToValueAtTime(640, 2.0);

    gain.gain.setValueAtTime(0.25, 0);
    gain.gain.exponentialRampToValueAtTime(0.01, seconds);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start(0);
    osc.stop(seconds);

    return offlineCtx.startRendering().then(renderedBuffer => {
      const blob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(blob);
      return { blob, url, duration: seconds };
    });
  } catch {
    const dummy = new Blob([], { type: 'audio/wav' });
    return Promise.resolve({
      blob: dummy,
      url: 'https://actions.google.com/sounds/v1/communication/incoming_call.ogg',
      duration: seconds
    });
  }
}

class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;

  public async startRecording(): Promise<void> {
    this.cleanup();

    let stream: MediaStream | null = null;

    // Cross-browser getUserMedia support
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (err: unknown) {
        // Fallback with basic audio constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          throw err;
        }
      }
    } else {
      const legacyGetUserMedia =
        (navigator as unknown as { getUserMedia?: (c: unknown, s: (stream: MediaStream) => void, e: (err: unknown) => void) => void }).getUserMedia ||
        (navigator as unknown as { webkitGetUserMedia?: (c: unknown, s: (stream: MediaStream) => void, e: (err: unknown) => void) => void }).webkitGetUserMedia ||
        (navigator as unknown as { mozGetUserMedia?: (c: unknown, s: (stream: MediaStream) => void, e: (err: unknown) => void) => void }).mozGetUserMedia;

      if (legacyGetUserMedia) {
        stream = await new Promise<MediaStream>((resolve, reject) => {
          legacyGetUserMedia.call(navigator, { audio: true }, resolve, reject);
        });
      } else {
        throw new Error('Microphone recording is not supported in this browser. Please use Chrome, Edge, Safari, or Firefox.');
      }
    }

    if (!stream) {
      throw new Error('Could not access microphone.');
    }

    this.stream = stream;
    this.audioChunks = [];
    this.startTime = Date.now();

    // Determine supported audio mime type
    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
      ''
    ];

    let chosenMime = '';
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (const m of mimeCandidates) {
        if (!m || MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }
    }

    try {
      this.mediaRecorder = chosenMime
        ? new MediaRecorder(this.stream, { mimeType: chosenMime })
        : new MediaRecorder(this.stream);
    } catch {
      // Fallback without options
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100);
  }

  public stopRecording(): Promise<AudioRecordResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recorder is not active'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mime });
        const url = URL.createObjectURL(blob);

        this.cleanup();
        resolve({ blob, url, duration });
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => {
          track.stop();
        });
      } catch {
        // ignore
      }
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export const audioRecorder = new AudioRecorderService();
