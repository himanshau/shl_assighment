/** Captures microphone audio as 16-bit PCM at 16kHz for Deepgram streaming. */

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export type PcmRecorder = {
  stop: () => void;
};

export async function startPcmRecorder(
  onChunk: (buffer: ArrayBuffer) => void,
): Promise<PcmRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  // Do NOT route mic to speakers — that causes echo and phantom STT transcripts.
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    const pcm = floatTo16BitPCM(channel);
    const copy = new ArrayBuffer(pcm.byteLength);
    new Int16Array(copy).set(pcm);
    onChunk(copy);
  };

  return {
    stop: () => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    },
  };
}
