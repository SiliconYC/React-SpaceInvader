import { useEffect, useRef, useState } from 'react';
import { GameEngine, type GameCommand, type GameSnapshot } from './core/engine.ts';
import { BattlefieldRenderer } from './render/BattlefieldRenderer.ts';
import { KeyboardController } from './input/KeyboardController.ts';
import { loadLevel } from './levels/load.ts';

const GAME_SEED = 20261017;
const LABELS: Record<GameSnapshot['phase'], string> = {
  ready: '待启动', running: '运行中', paused: '已暂停', ended: '已结束',
};

export default function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<BattlefieldRenderer | null>(null);
  const keyboardRef = useRef<KeyboardController | null>(null);
  const [webgl, setWebgl] = useState<'ready' | 'error' | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [levelName, setLevelName] = useState('关卡加载中');
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).has('debug'));
  const [state, setState] = useState<GameSnapshot>(() => new GameEngine(GAME_SEED).snapshot());

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;
    const abort = new AbortController();
    let disposed = false;
    let raf = 0;
    let lastTime: number | null = null;
    let lastUi = 0;
    let scene: BattlefieldRenderer | null = null;
    let keyboard: KeyboardController | null = null;

    // 缺失或无效关卡必须明确报错，不回退到硬编码敌阵。
    void loadLevel('first-contact', abort.signal).then(level => {
      if (disposed) return;
      const engine = new GameEngine(GAME_SEED, level.world, level);
      scene = new BattlefieldRenderer(host, engine.snapshot());
      engineRef.current = engine;
      rendererRef.current = scene;
      scene.setDebugVisible(new URLSearchParams(window.location.search).has('debug'));
      keyboard = new KeyboardController(command => { engine.dispatch(command); });
      keyboardRef.current = keyboard;
      setLevelName(level.metadata.name);
      setState(engine.snapshot());
      setWebgl('ready');

      const animate = (time: number) => {
        if (lastTime !== null) engine.advanceFrame(Math.min((time - lastTime) / 1000, 0.25));
        lastTime = time;
        keyboard?.setEnabled(engine.snapshot().phase === 'running');
        scene?.consumeEvents(engine.drainEvents());
        scene?.render(engine.snapshot());
        if (time - lastUi > 120) {
          setState(engine.snapshot());
          lastUi = time;
        }
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);
    }).catch(error => {
      if (disposed || abort.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : '关卡加载失败：未知错误');
    });

    const onVisibility = () => { lastTime = null; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      engineRef.current = null;
      rendererRef.current = null;
      keyboard?.dispose();
      keyboardRef.current = null;
      scene?.dispose();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setDebugVisible(debug);
  }, [debug]);

  const send = (command: GameCommand) => {
    const engine = engineRef.current;
    if (!engine) return;
    const result = engine.dispatch(command);
    if (result.accepted) {
      keyboardRef.current?.setEnabled(engine.snapshot().phase === 'running');
      setState(engine.snapshot());
    }
  };

  return (
    <main className="game-shell">
      <div ref={viewportRef} className="viewport" data-testid="battlefield"
        data-phase={state.phase} aria-label="二维规则战场，Three.js 三维渲染" role="img" />

      <header className="game-header">
        <div className="brand">
          <h1>侵略者</h1>
          <span className="preview-label" data-testid="level-name">{levelName}</span>
        </div>
        <button className="debug-toggle" type="button" aria-pressed={debug}
          onClick={() => setDebug(value => !value)}>{debug ? '关闭调试' : '调试'}</button>
      </header>

      <div className="score-hud" data-testid="score">分数 <strong>{state.score}</strong></div>
      {loadError && <div role="alert" data-testid="level-error" className="level-error">{loadError}</div>}
      <div className="control-hint">← → / A D <span>移动</span><span>空格 · 射击</span></div>
      <div className="play-actions" aria-label="引擎操作">
        {!loadError && webgl === 'ready' && state.phase === 'ready' && <button type="button" onClick={() => send({ type: 'START' })}>开始</button>}
        {state.phase === 'running' && <button type="button" onClick={() => send({ type: 'PAUSE' })}>暂停</button>}
        {state.phase === 'paused' && <button type="button" onClick={() => send({ type: 'RESUME' })}>继续</button>}
        {state.phase === 'ended' && <button type="button" onClick={() => { send({ type: 'RESET' }); send({ type: 'START' }); }}>重新开始</button>}
        {state.phase !== 'ready' && <button className="secondary" type="button" onClick={() => send({ type: 'RESET' })}>重置</button>}
      </div>

      {debug && (
        <aside className="debug-panel" data-testid="debug-panel" aria-label="调试信息">
          <dl>
            <div><dt>状态</dt><dd data-testid="game-phase">{LABELS[state.phase]}</dd></div>
            <div><dt>战场</dt><dd>{state.world.width} × {state.world.height}</dd></div>
            <div><dt>固定步进</dt><dd>60 Hz</dd></div>
            <div><dt>逻辑帧</dt><dd data-testid="tick">{state.tick}</dd></div>
            <div><dt>时间</dt><dd>{state.elapsedSeconds.toFixed(2)} s</dd></div>
            <div><dt>种子</dt><dd>{state.seed}</dd></div>
            <div><dt>子弹</dt><dd>{state.projectiles.length}</dd></div>
            <div><dt>敌机</dt><dd>{state.enemies.length}</dd></div>
          </dl>
          {(state.phase === 'running' || state.phase === 'paused') &&
            <button className="secondary" type="button" onClick={() => send({ type: 'END' })}>结束测试</button>}
        </aside>
      )}

      <span data-testid="webgl-status" className={webgl === 'error' ? 'render-error' : 'sr-only'} role="status">
        {webgl === 'ready' ? 'WebGL 正常' : webgl === 'error' ? 'WebGL 初始化失败' : '正在初始化 WebGL'}
      </span>
    </main>
  );
}
