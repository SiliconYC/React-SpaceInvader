import { useEffect, useRef, useState } from 'react';
import { GameEngine, type GameCommand, type GameSnapshot } from './core/engine.ts';
import { BattlefieldRenderer } from './render/BattlefieldRenderer.ts';
import { KeyboardController } from './input/KeyboardController.ts';
import { loadLevel } from './levels/load.ts';
import { loadLevelCatalog, type LevelCatalog } from './levels/catalog.ts';

const GAME_SEED = 20261017;
const LABELS: Record<GameSnapshot['phase'], string> = {
  ready: '待启动', running: '运行中', paused: '已暂停', ended: '已结束',
  won: '胜利', lost: '失败',
};

interface Session { stop(): void }

export default function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<BattlefieldRenderer | null>(null);
  const keyboardRef = useRef<KeyboardController | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const [webgl, setWebgl] = useState<'ready' | 'error' | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [levelName, setLevelName] = useState('关卡加载中');
  const [catalog, setCatalog] = useState<LevelCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).has('debug'));
  const [state, setState] = useState<GameSnapshot>(() => new GameEngine(GAME_SEED).snapshot());

  // 列表也由同源 JSON 决定，不在组件中写死第二关文件名/显示文本。
  useEffect(() => {
    const abort = new AbortController();
    void loadLevelCatalog(abort.signal).then(list => {
      if (abort.signal.aborted) return;
      setCatalog(list);
      setSelectedId(list.levels[0].id);
    }).catch(error => {
      if (!abort.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : '关卡清单加载失败');
      }
    });
    return () => abort.abort();
  }, []);

  // 切换选项时先校验完整 JSON，成功后才替换引擎与 WebGL 会话。
  // 请求失败不清空正在显示的合法旧关卡；旧请求通过 AbortController 取消。
  useEffect(() => {
    const host = viewportRef.current;
    if (!selectedId || !host) return;
    const abort = new AbortController();
    setLoadError(null);
    void loadLevel(selectedId, abort.signal).then(level => {
      if (abort.signal.aborted) return;
      const engine = new GameEngine(GAME_SEED, level.world, level);
      sessionRef.current?.stop();
      const scene = new BattlefieldRenderer(host, engine.snapshot());
      scene.setDebugVisible(new URLSearchParams(window.location.search).has('debug'));
      const keyboard = new KeyboardController(command => { engine.dispatch(command); });
      engineRef.current = engine;
      rendererRef.current = scene;
      keyboardRef.current = keyboard;

      let raf = 0;
      let lastTime: number | null = null;
      let lastUi = 0;
      const onVisibility = () => { lastTime = null; };
      document.addEventListener('visibilitychange', onVisibility);
      const animate = (time: number) => {
        if (lastTime !== null) engine.advanceFrame(Math.min((time - lastTime) / 1000, 0.25));
        lastTime = time;
        keyboard.setEnabled(engine.snapshot().phase === 'running');
        scene.consumeEvents(engine.drainEvents());
        scene.render(engine.snapshot());
        if (time - lastUi >= 120) {
          setState(engine.snapshot());
          lastUi = time;
        }
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);
      sessionRef.current = {
        stop: () => {
          cancelAnimationFrame(raf);
          document.removeEventListener('visibilitychange', onVisibility);
          keyboard.dispose();
          scene.dispose();
          if (engineRef.current === engine) engineRef.current = null;
          if (rendererRef.current === scene) rendererRef.current = null;
          if (keyboardRef.current === keyboard) keyboardRef.current = null;
        },
      };
      setLevelName(level.metadata.name);
      setState(engine.snapshot());
      setWebgl('ready');
    }).catch(error => {
      if (abort.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : '关卡加载失败：未知错误');
      if (!sessionRef.current) setWebgl('error');
    });
    return () => abort.abort();
  }, [selectedId]);

  useEffect(() => () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
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
          {catalog && (
            <select data-testid="level-select" className="level-select" aria-label="选择关卡"
              value={selectedId ?? ''} disabled={state.phase === 'running' || state.phase === 'paused'}
              onChange={event => setSelectedId(event.target.value)}>
              {catalog.levels.map(entry => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
            </select>
          )}
          <span className="sr-only" data-testid="level-name">{levelName}</span>
        </div>
        <button className="debug-toggle" type="button" aria-pressed={debug}
          onClick={() => setDebug(value => !value)}>{debug ? '关闭调试' : '调试'}</button>
      </header>

      <div className="score-hud" aria-label="游戏成绩">
        <span data-testid="score">分数 <strong>{state.score}</strong></span>
        <span className="wave-hud" data-testid="wave-status">波次 {state.currentWave}/{state.totalWaves}</span>
        <span className="life-indicator" data-testid="lives">生命 <strong>{state.lives}</strong></span>
      </div>
      {state.phase === 'ready' && catalog && !loadError &&
        <p className="level-description" data-testid="level-description">
          {catalog.levels.find(entry => entry.id === selectedId)?.description}
        </p>}
      {loadError && <div role="alert" data-testid="level-error" className="level-error">{loadError}</div>}
      {state.waitingForWave && state.phase === 'running' &&
        <div className="wave-wait" data-testid="wave-wait">下一波即将抵达</div>}
      {(state.phase === 'won' || state.phase === 'lost') && (
        <div className="result-overlay" data-testid="game-result" role="status">
          <strong>{state.phase === 'won' ? '胜利' : '失败'}</strong>
          <span>{state.phase === 'won' ? '敌机已肃清' :
            state.outcome === 'line-breached' ? '防线失守' : '飞船已被击毁'}</span>
          <span>得分 {state.score}</span>
        </div>
      )}
      {state.phase === 'paused' && <span className="pause-overlay" data-testid="pause-message">已暂停</span>}
      <div className="control-hint">← → / A D <span>移动</span><span>空格 · 射击</span></div>
      <div className="play-actions" aria-label="引擎操作">
        {!loadError && webgl === 'ready' && state.phase === 'ready' &&
          <button type="button" onClick={() => send({ type: 'START' })}>开始</button>}
        {state.phase === 'running' && <button type="button" onClick={() => send({ type: 'PAUSE' })}>暂停</button>}
        {state.phase === 'paused' && <button type="button" onClick={() => send({ type: 'RESUME' })}>继续</button>}
        {(state.phase === 'ended' || state.phase === 'won' || state.phase === 'lost') &&
          <button type="button" onClick={() => { send({ type: 'RESET' }); send({ type: 'START' }); }}>重新开始</button>}
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
            <div><dt>敌弹</dt><dd>{state.enemyProjectiles.length}</dd></div>
            <div><dt>待生成波次</dt><dd>{state.pendingWaves}</dd></div>
            <div><dt>结果</dt><dd>{state.outcome ?? '—'}</dd></div>
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
