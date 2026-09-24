// ── Global audio singleton with event emitter ─────────────────────────────────
// All BeatmapCard instances share this — only one preview plays at a time.

export interface TrackInfo {
  title: string;
  artist: string;
  beatmapsetId: string;
}

type Listener = (track: TrackInfo | null, playing: boolean) => void;

let _audio: HTMLAudioElement | null = null;
let _stopCb: (() => void) | null = null;
let _currentTrack: TrackInfo | null = null;
let _playing = false;
const _listeners = new Set<Listener>();

function _notify() {
  _listeners.forEach(fn => fn(_currentTrack, _playing));
}

export function subscribeAudio(fn: Listener): () => void {
  _listeners.add(fn);
  // immediately call with current state
  fn(_currentTrack, _playing);
  return () => _listeners.delete(fn);
}

export function playPreview(url: string, track: TrackInfo, onStop: () => void): () => void {
  // Stop previous, notify its card
  if (_audio) {
    _audio.pause();
    _audio.src = "";
    const prev = _stopCb;
    _audio = null;
    _stopCb = null;
    _playing = false;
    prev?.();
  }

  const audio = new Audio(url);
  audio.volume = 0.6;
  _audio = audio;
  _stopCb = onStop;
  _currentTrack = track;
  _playing = true;
  _notify();

  audio.play().catch(() => {});
  audio.addEventListener("ended", () => {
    if (_audio === audio) { _audio = null; _stopCb = null; _playing = false; _currentTrack = null; }
    _notify();
    onStop();
  });

  return () => {
    if (_audio === audio) {
      audio.pause();
      audio.src = "";
      _audio = null;
      _stopCb = null;
      _playing = false;
      _currentTrack = null;
      _notify();
    }
    onStop();
  };
}

export function stopAudio() {
  if (_audio) {
    _audio.pause();
    _audio.src = "";
    const prev = _stopCb;
    _audio = null;
    _stopCb = null;
    _playing = false;
    _currentTrack = null;
    _notify();
    prev?.();
  }
}

export function toggleAudio() {
  if (!_audio) return;
  if (_playing) {
    _audio.pause();
    _playing = false;
  } else {
    _audio.play().catch(() => {});
    _playing = true;
  }
  _notify();
}

export function isCurrentAudio(audio: HTMLAudioElement | null): boolean {
  return _audio === audio;
}
