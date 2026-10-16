import type { GameCommand } from '../core/engine.ts';

type CommandSink = (command: GameCommand) => void;
/** 浏览器事件只翻译为二维移动命令；不计算位移，也不直接操作渲染模型。 */
export class KeyboardController {
  private readonly held = new Set<'left' | 'right'>();
  private enabled = false;
  private lastDirection: -1 | 0 | 1 = 0;
  private heldFire = false;

  constructor(private readonly send: CommandSink) {
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.visibility);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.releaseAll();
    this.enabled = enabled;
  }

  private direction(): -1 | 0 | 1 {
    return this.held.has('left') === this.held.has('right') ? 0 : this.held.has('left') ? -1 : 1;
  }
  private sendDirection(): void {
    if (!this.enabled) return;
    const direction = this.direction();
    if (this.lastDirection !== direction) {
      this.send({ type: 'SET_MOVEMENT', direction });
      this.lastDirection = direction;
    }
  }
  private mapKey(key: string): 'left' | 'right' | null {
    const value = key.toLowerCase();
    if (value === 'arrowleft' || value === 'a') return 'left';
    if (value === 'arrowright' || value === 'd') return 'right';
    return null;
  }
  private keydown = (event: KeyboardEvent): void => {
    if (!this.enabled || event.ctrlKey || event.altKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault(); // 阻止 Space 意外再次触发已获焦点的「开始/暂停」按钮
      if (!event.repeat && !this.heldFire) {
        this.heldFire = true;
        this.send({ type: 'SET_FIRING', active: true });
      }
      return;
    }
    const direction = this.mapKey(event.key);
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat) {
      this.held.add(direction);
      this.sendDirection();
    }
  };
  private keyup = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.key === ' ') {
      if (this.enabled) event.preventDefault();
      if (this.heldFire) {
        this.heldFire = false;
        if (this.enabled) this.send({ type: 'SET_FIRING', active: false });
      }
      return;
    }
    const direction = this.mapKey(event.key);
    if (!direction) return;
    if (this.enabled) event.preventDefault();
    this.held.delete(direction);
    this.sendDirection();
  };
  private releaseAll = (): void => {
    this.held.clear();
    if (this.heldFire && this.enabled) this.send({ type: 'SET_FIRING', active: false });
    this.heldFire = false;
    if (this.enabled && this.lastDirection !== 0) this.send({ type: 'SET_MOVEMENT', direction: 0 });
    this.lastDirection = 0;
  };
  private visibility = (): void => {
    if (document.hidden) this.releaseAll();
  };
  dispose(): void {
    this.releaseAll();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
