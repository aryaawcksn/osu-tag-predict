// ── Global audio singleton with event emitter ─────────────────────────────────

export interface TrackInfo {
  title: string;
  artist: string;
  beatmapsetId: string;
}

type Listener = (track: TrackInfo | null, playing: boolean) => void;

let _audio: HTMLAudioElement | null = null;
let _onCardStop: (() => void) | null = null; // notifies the card that owns this audio
let _currentTrack: TrackInfo | null = null;
let _playing = false;
const _listeners = new Set<Listener>();

function _notify() {
  _listeners.forEach(fn => fn(_currentTrack, _playing));
}

export function subscribeAudio(fn: Listener): () => void {
  _listeners.add(fn);
  fn(_currentTrack, _playing);
  return () => _listeners.delete(fn);
}

/**
 * Start playing a new preview. Returns a "detach" function the card stores in
 * stopRef — calling it removes the card's ownership without stopping audio.
 */
export function playPreview(url: string, track: TrackInfo, onCardStop: () => void): () => void {
  // Stop previous track and notify its card
  if (_audio) {
    _audio.pause();
    _audio.src = "";
    const prev = _onCardStop;
    _audio = null;
    _onCardStop = null;
    _playing = false;
    prev?.();
  }

  const audio = new Audio(url);
  audio.volume = 0.6;
  _audio = audio;
  _onCardStop = onCardStop;
  _currentTrack = track;
  _playing = true;
  _notify();

  audio.play().catch(() => {});
  audio.addEventListener("ended", () => {
    if (_audio === audio) {
      _audio = null;
      _onCardStop = null;
      _playing = false;
      // Keep _currentTrack so overlay can still show title during hide delay
      _notify();
      onCardStop();
    }
  });

  // Return detach fn — card calls this on unmount, does NOT stop audio
  return () => {
    if (_onCardStop === onCardStop) _onCardStop = null;
  };
}

/** Pause / resume the current audio (does not destroy it) */
export function pauseAudio() {
  if (!_audio || !_playing) return;
  _audio.pause();
  _playing = false;
  _notify();
}

export function resumeAudio() {
  if (!_audio || _playing) return;
  _audio.play().catch(() => {});
  _playing = true;
  _notify();
}

/** Toggle pause/resume */
export function toggleAudio() {
  if (!_audio) return;
  if (_playing) pauseAudio();
  else resumeAudio();
}

/** Fully stop and clear current audio */
export function stopAudio() {
  if (!_audio) return;
  _audio.pause();
  _audio.src = "";
  const prev = _onCardStop;
  _audio = null;
  _onCardStop = null;
  _playing = false;
  _currentTrack = null;
  _notify();
  prev?.();
}

export function isPlaying(): boolean { return _playing; }
export function hasAudio(): boolean { return _audio !== null; }
