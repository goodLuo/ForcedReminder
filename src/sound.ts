// Web Audio API — pleasant alarm sound generator
// Supports multiple ringtone styles

export type RingtoneType = 'marimba' | 'piano' | 'digital' | 'birds' | 'gentle';

let audioContext: AudioContext | null = null;
let isPlaying = false;
let timeoutIds: ReturnType<typeof setTimeout>[] = [];
let loopTimeout: ReturnType<typeof setTimeout> | null = null;
let currentRingtone: RingtoneType = 'marimba';

export function setRingtone(type: RingtoneType) {
  currentRingtone = type;
}

export function getRingtone(): RingtoneType {
  return currentRingtone;
}

// ─── helpers ───────────────────────────────────────

function ctx(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

/** Play a single note with nice decay */
function playNote(
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  pan = 0,
) {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  // Smooth envelope: quick attack, natural decay
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  // Optional stereo panning for richness
  if (ac.createStereoPanner) {
    const panner = ac.createStereoPanner();
    panner.pan.setValueAtTime(pan, startTime);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ac.destination);
  } else {
    osc.connect(gain);
    gain.connect(ac.destination);
  }

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/** Play a chord (multiple notes at once) */
function playChord(
  freqs: number[],
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  freqs.forEach((f, i) => {
    const pan = freqs.length > 1 ? -0.5 + (i / (freqs.length - 1)) : 0;
    playNote(f, startTime, duration, volume / freqs.length, type, pan);
  });
}

// ─── Ringtone patterns ────────────────────────────

/** 🎵 Marimba — 清脆木琴音色，像 iPhone 默认铃声 */
function playMarimba() {
  const ac = ctx();
  const t = ac.currentTime;

  // Pentatonic scale melody: C5, E5, G5, A5, C6
  const notes = [523, 659, 784, 880, 1047];
  // Pattern: short melodic phrase
  const pattern = [
    { note: 0, time: 0.0 },
    { note: 2, time: 0.15 },
    { note: 4, time: 0.30 },
    { note: 3, time: 0.50 },
    { note: 2, time: 0.65 },
    // pause
    { note: 0, time: 1.1 },
    { note: 2, time: 1.25 },
    { note: 4, time: 1.40 },
    { note: 3, time: 1.60 },
    { note: 4, time: 1.75 },
  ];

  pattern.forEach(({ note, time }) => {
    // Marimba: use triangle wave for mellow wooden tone
    playNote(notes[note], t + time, 0.35, 0.18, 'triangle');
    // Add a quiet octave-up harmonic for sparkle
    playNote(notes[note] * 2, t + time, 0.15, 0.04, 'sine');
  });

  return 2.4; // total duration of one loop
}

/** 🎹 Piano — 柔和钢琴和弦，温馨不刺耳 */
function playPiano() {
  const ac = ctx();
  const t = ac.currentTime;

  // C major → F major → G major → C major (arpeggiated)
  const chords = [
    [262, 330, 392],       // C major
    [349, 440, 523],       // F major
    [392, 494, 587],       // G major
    [523, 659, 784],       // C major (octave up)
  ];

  chords.forEach((chord, i) => {
    const startTime = t + i * 0.8;
    // Arpeggiate each chord
    chord.forEach((note, j) => {
      playNote(note, startTime + j * 0.08, 0.7, 0.12, 'sine');
    });
  });

  return 3.8;
}

/** 🔔 Digital — 轻快电子提示音 */
function playDigital() {
  const ac = ctx();
  const t = ac.currentTime;

  // Two-tone chime pattern (like a doorbell / notification)
  const pattern = [
    { freqs: [698, 880], time: 0.0, dur: 0.25 },
    { freqs: [880, 1047], time: 0.3, dur: 0.25 },
    { freqs: [1047, 1319], time: 0.6, dur: 0.4 },
    // Second phrase
    { freqs: [698, 880], time: 1.4, dur: 0.25 },
    { freqs: [880, 1047], time: 1.7, dur: 0.25 },
    { freqs: [1319, 1568], time: 2.0, dur: 0.5 },
  ];

  pattern.forEach(({ freqs, time, dur }) => {
    playChord(freqs, t + time, dur, 0.14, 'sine');
  });

  return 3.0;
}

/** 🐦 Birds — 模拟鸟鸣，自然清新 */
function playBirds() {
  const ac = ctx();
  const t = ac.currentTime;

  // Bird chirp: fast frequency sweep upward
  const chirp = (startTime: number, baseFreq: number, pan: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, startTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, startTime + 0.12);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

    if (ac.createStereoPanner) {
      const panner = ac.createStereoPanner();
      panner.pan.setValueAtTime(pan, startTime);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ac.destination);
    } else {
      osc.connect(gain);
      gain.connect(ac.destination);
    }

    osc.start(startTime);
    osc.stop(startTime + 0.25);
  };

  // Multiple chirps at different pitches & positions
  chirp(t + 0.0, 2200, -0.5);
  chirp(t + 0.15, 2600, 0.3);
  chirp(t + 0.35, 2400, -0.2);

  chirp(t + 0.8, 1800, 0.5);
  chirp(t + 0.95, 2200, -0.4);
  chirp(t + 1.15, 2800, 0.1);

  chirp(t + 1.7, 2000, 0.0);
  chirp(t + 1.85, 2600, 0.5);
  chirp(t + 2.05, 3000, -0.3);

  return 3.0;
}

/** 🌊 Gentle — 超柔和渐进音，像冥想音 */
function playGentle() {
  const ac = ctx();
  const t = ac.currentTime;

  // Soft evolving pad with overtones
  const fundamentals = [262, 330, 392, 523]; // C E G C'

  fundamentals.forEach((freq, i) => {
    const start = t + i * 1.0;

    // Main tone with very slow attack
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.4);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + 1.3);

    // Soft fifth harmonic
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.5, start);

    gain2.gain.setValueAtTime(0, start);
    gain2.gain.linearRampToValueAtTime(0.03, start + 0.5);
    gain2.gain.exponentialRampToValueAtTime(0.001, start + 1.0);

    osc2.connect(gain2);
    gain2.connect(ac.destination);
    osc2.start(start);
    osc2.stop(start + 1.1);
  });

  return 5.0;
}

// ─── Public API ───────────────────────────────────

const ringtoneMap: Record<RingtoneType, () => number> = {
  marimba: playMarimba,
  piano: playPiano,
  digital: playDigital,
  birds: playBirds,
  gentle: playGentle,
};

export function playAlarmSound(type?: RingtoneType) {
  if (isPlaying) return;
  isPlaying = true;

  const ringtone = type || currentRingtone;

  try {
    const playFn = ringtoneMap[ringtone];
    const duration = playFn();

    // Loop: replay after duration + small pause
    const scheduleLoop = () => {
      if (!isPlaying) return;
      const dur = playFn();
      loopTimeout = setTimeout(scheduleLoop, dur * 1000 + 400);
    };

    loopTimeout = setTimeout(scheduleLoop, duration * 1000 + 400);
  } catch (e) {
    console.warn('Could not play alarm sound:', e);
  }
}

/** Play a single preview (no loop) */
export function previewRingtone(type: RingtoneType) {
  stopAlarmSound();
  try {
    // Reset context for clean preview
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    const playFn = ringtoneMap[type];
    playFn();
  } catch (e) {
    console.warn('Could not preview sound:', e);
  }
}

export function stopAlarmSound() {
  isPlaying = false;
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
  timeoutIds.forEach((id) => clearTimeout(id));
  timeoutIds = [];
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}
