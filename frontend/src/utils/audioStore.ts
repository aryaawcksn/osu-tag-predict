// ── Global audio singleton with event emitter ─────────────────────────────────

export interface TrackInfo {
  title: string;
  artist: string;
  beatmapsetId: string;
  previewUrl?: string; // filled by playPreview internally
}

type Listener = (track: TrackInfo | null, playing: boolean) => void;

let _audio: HTMLAudioElement | null = null;
let _onCardStop: (() => void) | null = null;
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

export function playPreview(url: string, track: TrackInfo, onCardStop: () => void): () => void {
  // Stop previous and notify its card
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
  _currentTrack = { ...track, previewUrl: url };
  _playing = true;
  _notify();

  audio.play().catch(() => {});
  audio.addEventListener("ended", () => {
    if (_audio === audio) {
      _audio = null;
      _onCardStop = null;
      _playing = false;
      // Keep _currentTrack for overlay display + replay
      _notify();
      onCardStop();
    }
  });

  // Detach fn — does NOT stop audio, just removes card ownership
  return () => {
    if (_onCardStop === onCardStop) _onCardStop = null;
  };
}

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

/** Toggle: pause if playing, resume if paused, replay from start if ended */
export function toggleAudio() {
  if (_playing) {
    pauseAudio();
  } else if (_audio) {
    resumeAudio();
  } else if (_currentTrack) {
    // Song ended — replay from start
    const track = _currentTrack;
    const audio = new Audio(track.previewUrl);
    audio.volume = 0.6;
    _audio = audio;
    _playing = true;
    _notify();
    audio.play().catch(() => {});
    audio.addEventListener("ended", () => {
      if (_audio === audio) {
        _audio = null;
        _playing = false;
        _notify();
      }
    });
  }
}

export function stopAudio() {
  if (_audio) {
    _audio.pause();
    _audio.src = "";
    const prev = _onCardStop;
    _audio = null;
    _onCardStop = null;
    prev?.();
  }
  _playing = false;
  _currentTrack = null;
  _notify();
}

export function isPlaying(): boolean { return _playing; }
