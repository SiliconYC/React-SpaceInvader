import type { GameEvent, GamePhase } from '../core/engine.ts';

/** 仅设备本地音频偏好；任何 Storage 拒绝都绝不能妨碍游戏。 */
export interface AudioPrefs { readonly effects: boolean; readonly music: boolean; readonly volume: number }
export const AUDIO_PREFS_KEY = 'react-space-invader.audio.v1';
export const DEFAULT_AUDIO_PREFS: AudioPrefs = Object.freeze({ effects: true, music: true, volume: 0.32 });
export function readAudioPrefs(storage?: Pick<Storage, 'getItem'>): AudioPrefs {
  try {
    const source = storage ?? window.localStorage;
    const raw = source.getItem(AUDIO_PREFS_KEY);
    if (!raw) return DEFAULT_AUDIO_PREFS;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return DEFAULT_AUDIO_PREFS;
    const x = data as Record<string, unknown>;
    return x.version === 1 && typeof x.effects === 'boolean' &&
      typeof x.music === 'boolean' && typeof x.volume === 'number' &&
      Number.isFinite(x.volume) && x.volume >= 0 && x.volume <= 1
      ? { effects: x.effects, music: x.music, volume: x.volume }
      : DEFAULT_AUDIO_PREFS;
  } catch { return DEFAULT_AUDIO_PREFS; }
}
export function persistAudioPrefs(prefs: AudioPrefs, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? window.localStorage).setItem(AUDIO_PREFS_KEY, JSON.stringify({version: 1, ...prefs})); }
  catch { /* storage may be blocked or full: preferences remain in memory */ }
}

/** 原创 Web Audio 合成音，不请求第三方资源；音频完全不进入二维游戏规则。 */
export type AudioEvent = 'shot' | 'kill' | 'damage' | 'hurt' | 'wave' | 'win' | 'lose';
export function toAudioEvent(event: GameEvent): AudioEvent | null {
  switch (event.type) {
    case 'shot-fired': return 'shot';
    case 'enemy-hit': return 'kill';
    case 'enemy-damaged': return 'damage';
    case 'player-hit': return 'hurt';
    case 'wave-started': return 'wave';
    case 'game-finished': return event.phase === 'won' ? 'win' : 'lose';
    default: return null;
  }
}
const TONES: Readonly<Record<AudioEvent, readonly [number, number, number, OscillatorType]>> = {
  shot: [610, 260, .070, 'triangle'],
  kill: [170, 64, .21, 'sawtooth'],
  damage: [430, 220, .1, 'square'],
  hurt: [180, 64, .27, 'sawtooth'],
  wave: [320, 510, .28, 'sine'],
  win: [520, 780, .48, 'sine'],
  lose: [240, 86, .48, 'triangle'],
};
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private music: OscillatorNode[] = [];
  private pending = new Set<OscillatorNode>();
  private armed = false;
  private active = false;
  private visible = true;
  private phase: GamePhase = 'ready';
  private lastTickIds = new Set<string>();
  private readonly recent: string[] = [];
  private played = 0;
  private available = typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  constructor(private prefs: AudioPrefs = readAudioPrefs()) {}
  get status(): 'locked' | 'unavailable' | 'ready' {
    return !this.available ? 'unavailable' : this.armed ? 'ready' : 'locked';
  }
  get totalSounds(): number { return this.played; }
  get activeVoices(): number { return this.pending.size + this.music.length; }
  get settings(): AudioPrefs { return this.prefs; }
  /** Must be called synchronously in an explicit user click/touch handler. */
  unlock(): void {
    if (!this.available) return;
    try {
      if (!this.ctx) {
        this.ctx = new window.AudioContext();
        this.master = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.master.gain.value = this.prefs.volume;
        this.musicGain.gain.value = .065;
        this.musicGain.connect(this.master);
        this.master.connect(this.ctx.destination);
      }
      this.armed = true;
      void this.ctx.resume().then(() => this.refresh()).catch(() => { /* browser denies unlock */ });
      this.refresh();
    } catch { this.available = false; this.armed = false; }
  }
  setPrefs(prefs: AudioPrefs): void {
    this.prefs = prefs;
    persistAudioPrefs(prefs);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(prefs.volume,this.ctx.currentTime,.018);
    this.refresh();
  }
  onEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      const type = toAudioEvent(event);
      if (!type) { if (event.type === 'game-reset') this.reset(); continue; }
      const key = event.type + ':' + event.tick +
        (('bulletId' in event) ? ':' + event.bulletId : '') +
        (('enemyId' in event) ? ':' + event.enemyId : '') +
        (('wave' in event) ? ':' + event.wave : '');
      if (this.lastTickIds.has(key)) continue;
      this.lastTickIds.add(key); this.recent.push(key);
      if (this.recent.length > 384) this.lastTickIds.delete(this.recent.shift()!);
      if (!this.armed || !this.prefs.effects || !this.visible) continue;
      // A phase transition may already be reflected in snapshot: allow short ending cues.
      if (!this.active && type !== 'win' && type !== 'lose') continue;
      this.play(type);
    }
  }
  setPhase(phase: GamePhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.active = phase === 'running';
    this.refresh();
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.stopMusic();
    else this.refresh();
  }
  reset(): void {
    this.stopMusic();
    for (const node of this.pending) { try { node.stop(); } catch { /* already ended */ } }
    this.pending.clear();
    this.lastTickIds.clear(); this.recent.length = 0;
    this.refresh();
  }
  private play(type: AudioEvent): void {
    const ctx = this.ctx, out = this.master;
    if (!ctx || !out || ctx.state !== 'running' || this.pending.size >= 12) return;
    const [start,end,duration,shape] = TONES[type];
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = shape;
      osc.frequency.setValueAtTime(start, now);
      osc.frequency.exponentialRampToValueAtTime(end,now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(type === 'shot' ? .14 : .21, now + .009);
      gain.gain.exponentialRampToValueAtTime(.0001,now + duration);
      osc.connect(gain).connect(out);
      this.pending.add(osc);
      osc.onended = () => { osc.disconnect();gain.disconnect();this.pending.delete(osc); };
      osc.start(now); osc.stop(now + duration + .008);
      this.played++;
    } catch { /* audio never blocks gameplay */ }
  }
  private refresh(): void {
    const ctx=this.ctx;
    const should = this.armed && this.active && this.visible && this.prefs.music &&
      this.prefs.volume > 0 && ctx?.state === 'running';
    if (!should) { this.stopMusic(); return; }
    if (!ctx || !this.musicGain || this.music.length) return;
    // Two quiet original continuous drones beat slowly; zero timers, looping files, or network.
    try {
      for (const hz of [82.4069, 123.4708]) {
        const oscillator = ctx.createOscillator();
        oscillator.type='sine'; oscillator.frequency.value=hz;
        oscillator.connect(this.musicGain);
        oscillator.start();
        this.music.push(oscillator);
      }
    } catch { this.stopMusic(); }
  }
  private stopMusic(): void {
    for (const oscillator of this.music) {
      try { oscillator.stop(); oscillator.disconnect(); } catch { /* already stopped */ }
    }
    this.music.length=0;
  }
  dispose(): void {
    this.active=false;this.reset();this.armed=false;
    this.musicGain?.disconnect();this.master?.disconnect();
    if (this.ctx) void this.ctx.close().catch(()=>{});
    this.ctx=null;this.master=null;this.musicGain=null;
  }
}
