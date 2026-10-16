import { useEffect, useRef, useState } from 'react';
import { GameEngine, type GameCommand, type GameSnapshot } from './core/engine.ts';
import { BattlefieldRenderer } from './render/BattlefieldRenderer.ts';

const GAME_SEED = 20261017;
const LABELS: Record<GameSnapshot['phase'], string> = {
  ready: '待启动', running: '运行中', paused: '已暂停', ended: '已结束',
};

export default function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [webgl, setWebgl] = useState<'ready' | 'error' | 'loading'>('loading');
  const [state, setState] = useState<GameSnapshot>(() => new GameEngine(GAME_SEED).snapshot());

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;
    const engine = new GameEngine(GAME_SEED);
    engineRef.current = engine;
    let scene: BattlefieldRenderer;
    try {
      scene = new BattlefieldRenderer(host, engine.snapshot());
    } catch (error) {
      console.error('Three.js 初始化失败', error);
      setWebgl('error');
      engineRef.current = null;
      return;
    }
    setWebgl('ready');
    let raf = 0;
    let lastTime: number | null = null;
    let lastUi = 0;
    const animate = (time: number) => {
      if (lastTime !== null) {
        engine.advanceFrame(Math.min((time - lastTime) / 1000, 0.25));
      }
      lastTime = time;
      scene.render(engine.snapshot());
      if (time - lastUi > 120) {
        setState(engine.snapshot());
        lastUi = time;
      }
      raf = requestAnimationFrame(animate);
    };
    const onVisibility = () => { lastTime = null; };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      engineRef.current = null;
      scene.dispose();
    };
  }, []);

  const send = (command: GameCommand) => {
    const engine = engineRef.current;
    if (!engine) return;
    const result = engine.dispatch(command);
    if (result.accepted) setState(engine.snapshot());
  };

  return (
    <main className="page">
      <header className="top">
        <div className="eyebrow">REACT / THREE.JS / 二维规则核心</div>
        <h1>侵略者 <span className="version">P1 · 基础战场</span></h1>
        <p>经典二维玩法，三维战场呈现。此阶段仅验证规则引擎与渲染分离。</p>
      </header>

      <section className="battle-panel" aria-label="二维战场预览">
        <div className="battle-toolbar">
          <span className="status-dot" aria-hidden="true" />
          <strong>战斗区域</strong>
          <span>宽 {state.world.width} × 高 {state.world.height} 逻辑单位</span>
          <span className="phase" data-testid="game-phase">{LABELS[state.phase]}</span>
        </div>
        <div ref={viewportRef} className="viewport" data-testid="battlefield"
          data-phase={state.phase} aria-label="Three.js 二维战场的三维可视化" role="img" />
        <div className="coordinates">
          <span>左下角 (0,0)</span>
          <span>单位和弹道都将在此二维平面内运行</span>
          <span>右上角 ({state.world.width},{state.world.height})</span>
        </div>
      </section>

      <section className="controls" aria-label="引擎状态测试">
        <div className="metrics">
          <div><small>固定更新频率</small><strong>60 Hz</strong></div>
          <div><small>逻辑步数</small><strong data-testid="tick">{state.tick}</strong></div>
          <div><small>游戏时间</small><strong>{state.elapsedSeconds.toFixed(2)} s</strong></div>
          <div><small>随机种子</small><strong>{state.seed}</strong></div>
        </div>
        <div className="actions">
          {state.phase === 'ready' && <button type="button" onClick={() => send({ type: 'START' })}>启动时钟</button>}
          {state.phase === 'running' && <button type="button" onClick={() => send({ type: 'PAUSE' })}>暂停</button>}
          {state.phase === 'paused' && <button type="button" onClick={() => send({ type: 'RESUME' })}>继续</button>}
          {(state.phase === 'running' || state.phase === 'paused') &&
            <button type="button" className="secondary" onClick={() => send({ type: 'END' })}>结束测试</button>}
          <button type="button" className="secondary" onClick={() => send({ type: 'RESET' })}>重置</button>
        </div>
      </section>

      <footer className="footer">
        <span className={webgl === 'error' ? 'error' : 'ok'} data-testid="webgl-status">
          {webgl === 'ready' ? '● Three.js / WebGL 正常' : webgl === 'error' ? '● 浏览器未能初始化 WebGL' : '● 正在初始化三维场景'}
        </span>
        <span>仅有战场网格与边界；飞船、敌机、射击将在后续 Issue 实现</span>
      </footer>
    </main>
  );
}
