/** Plays one complete MP3 per assistant reply (no fragmented chunk glitches). */

let currentAudio: HTMLAudioElement | null = null;
let playing: Promise<void> = Promise.resolve();

function playOne(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(new Error("Could not play assistant audio"));
    };

    void audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    });
  });
}

export function enqueueMp3Buffer(buffer: ArrayBuffer): void {
  stopTts();
  playing = playOne(buffer);
}

export function whenTtsQueueIdle(): Promise<void> {
  return playing;
}

export function stopTts(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  playing = Promise.resolve();
}
