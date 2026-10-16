import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GameEngine, type GameCommand, type GameSnapshot } from './core/engine.ts';
import { BattlefieldRenderer } from './render/BattlefieldRenderer.ts';
import { KeyboardController } from './input/KeyboardController.ts';
import { TouchControls, type TouchAction } from './input/TouchControls.ts';
import { GameAudio, readAudioPrefs, type AudioPrefs } from './audio/GameAudio.ts';
import { appendScore,clearScores,readScores,scoresFor,type ScoreEntry } from './scores/localScores.ts';
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
  const touchRef = useRef<TouchControls | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [scoreRecords,setScoreRecords] = useState<ScoreEntry[]>(()=>readScores());
  const [scoresOpen,setScoresOpen] = useState(false);
  const scoreSessionRef = useRef(0);
  const recordedRef = useRef(false);
  const audioRef = useRef<GameAudio | null>(null);
  const [audioPrefs,setAudioPrefs] = useState<AudioPrefs>(() => readAudioPrefs());
  const [audioOpen,setAudioOpen] = useState(false);
  const getAudio = () => audioRef.current ?? (audioRef.current = new GameAudio(audioPrefs));
  const changeAudio = (next: AudioPrefs) => { setAudioPrefs(next); getAudio().setPrefs(next); };

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
      recordedRef.current = false;
      scoreSessionRef.current++;
      setScoresOpen(false);
      audioRef.current?.reset();
      audioRef.current?.setPhase('ready');
      const scene = new BattlefieldRenderer(host, engine.snapshot());
      scene.setDebugVisible(new URLSearchParams(window.location.search).has('debug'));
      const keyboard = new KeyboardController(command => { engine.dispatch(command); });
      const touch = new TouchControls(command=>{engine.dispatch(command);});
      touchRef.current = touch;
      engineRef.current = engine;
      rendererRef.current = scene;
      keyboardRef.current = keyboard;

      let raf = 0;
      let lastTime: number | null = null;
      let lastUi = 0;
      const onVisibility = () => { lastTime = null; if(document.hidden)touch.releaseAll(); audioRef.current?.setVisible(!document.hidden); };
      const onBlur=()=>touch.releaseAll();
      window.addEventListener('blur',onBlur);
      document.addEventListener('visibilitychange', onVisibility);
      const animate = (time: number) => {
        if (lastTime !== null) engine.advanceFrame(Math.min((time - lastTime) / 1000, 0.25));
        lastTime = time;
        keyboard.setEnabled(engine.snapshot().phase === 'running');
        touch.setEnabled(engine.snapshot().phase === 'running');
        host.dataset.touchHeld=String(touch.activeCount);
        const snapshot = engine.snapshot();
        const events = engine.drainEvents();
        audioRef.current?.setPhase(snapshot.phase);
        audioRef.current?.onEvents(events);
        const finished=events.find(e=>e.type==='game-finished');
        if(finished?.type==='game-finished' && !recordedRef.current && snapshot.levelId){
          recordedRef.current=true;
          const entry:ScoreEntry = {
            id:(window.crypto?.randomUUID?.() ?? (Date.now()+':'+scoreSessionRef.current)),
            levelId:snapshot.levelId,score:snapshot.score,result:finished.phase,
            completedWaves:finished.phase==='won'?snapshot.totalWaves:Math.max(0,snapshot.currentWave-1),
            totalWaves:snapshot.totalWaves,ticks:Math.max(1,snapshot.tick),
            seed:snapshot.seed,at:new Date().toISOString(),
          };
          setScoreRecords(previous=>appendScore(previous,entry));
        }
        scene.consumeEvents(events,snapshot);
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
          window.removeEventListener('blur',onBlur);
          keyboard.dispose();
          touch.dispose();
          scene.dispose();
          if (engineRef.current === engine) engineRef.current = null;
          if (rendererRef.current === scene) rendererRef.current = null;
          if (keyboardRef.current === keyboard) keyboardRef.current = null;
          if (touchRef.current === touch) touchRef.current = null;
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
    audioRef.current?.dispose();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    rendererRef.current?.setDebugVisible(debug);
  }, [debug]);

  const send = (command: GameCommand) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (command.type === 'START' || command.type === 'RESUME') getAudio().unlock();
    const result = engine.dispatch(command);
    if (result.accepted) {
      if (command.type === 'RESET' || command.type === 'START') {
        recordedRef.current = false;
        scoreSessionRef.current++;
        setScoresOpen(false);
      }
      if (command.type === 'RESET') audioRef.current?.reset();
      audioRef.current?.setPhase(engine.snapshot().phase);
      keyboardRef.current?.setEnabled(engine.snapshot().phase === 'running');
      touchRef.current?.setEnabled(engine.snapshot().phase === 'running');
      setState(engine.snapshot());
    }
  };

  const touchDown=(action:TouchAction,event:ReactPointerEvent<HTMLButtonElement>)=>{
    event.preventDefault();
    try {event.currentTarget.setPointerCapture(event.pointerId);} catch {/* unsupported */}
    touchRef.current?.down(action,event.pointerId);
  };
  const touchUp=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    touchRef.current?.up(event.pointerId);
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
        <div className="header-tools">
          <button type="button" className="debug-toggle" aria-expanded={scoresOpen}
            disabled={state.phase==='running'||state.phase==='paused'} aria-controls="score-board"
            onClick={() => setScoresOpen(v=>!v)}>成绩</button>
          <button type="button" className="debug-toggle" aria-expanded={audioOpen}
            aria-controls="audio-settings" onClick={() => setAudioOpen(v => !v)}>音频</button>
          <button className="debug-toggle" type="button" aria-pressed={debug}
          onClick={() => setDebug(value => !value)}>{debug ? '关闭调试' : '调试'}</button>
        </div>
      </header>
      {scoresOpen && state.phase!=='running' && state.phase!=='paused' &&
        <section id="score-board" className="score-board" aria-label="本机排行榜">
          <h2>本机成绩 · {catalog?.levels.find(l=>l.id===selectedId)?.name ?? levelName}</h2>
          <ol data-testid="score-list">
            {scoresFor(scoreRecords,selectedId??'').map(entry=><li key={entry.id}>
              <strong>{entry.score}</strong><span>{entry.result==='won'?'通关':'失败'} · {entry.completedWaves}/{entry.totalWaves} 波 · {(entry.ticks/60).toFixed(1)} 秒</span>
            </li>)}
          </ol>
          {!scoresFor(scoreRecords,selectedId??'').length && <p>暂无成绩</p>}
          <button type="button" className="clear-scores" onClick={()=>{
            if(window.confirm('确认清空所有关卡的本机成绩？此操作不可撤销。')){
              clearScores();setScoreRecords([]);
            }
          }}>清空本机成绩</button>
        </section>}
      {audioOpen && <section id="audio-settings" className="audio-settings" aria-label="音频设置">
        <label><input type="checkbox" checked={audioPrefs.effects}
          onChange={e => changeAudio({...audioPrefs,effects:e.target.checked})}/> 音效</label>
        <label><input type="checkbox" checked={audioPrefs.music}
          onChange={e => changeAudio({...audioPrefs,music:e.target.checked})}/> 背景音乐</label>
        <label>音量 <input type="range" min="0" max="1" step="0.05" value={audioPrefs.volume}
          aria-label="音量" onChange={e => changeAudio({...audioPrefs,volume:Number(e.target.value)})}/></label>
        <span className="sr-only" data-testid="audio-status">{audioRef.current?.status ?? 'locked'}</span>
      </section>}

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
          <span data-testid="local-best">本关最高 {Math.max(state.score, scoresFor(scoreRecords,selectedId??'')[0]?.score??0)}</span>
        </div>
      )}
      {state.phase === 'paused' && <span className="pause-overlay" data-testid="pause-message">已暂停</span>}
      <div className="control-hint">← → / A D <span>移动</span><span>空格 · 射击</span></div>
      <nav className="touch-controls" aria-label="触屏战斗控制">
        <div className="touch-movement">
          {(['left','right'] as const).map(action=>
            <button key={action} type="button" disabled={state.phase!=='running'}
              className="touch-key" data-testid={'touch-'+action}
              aria-label={action==='left'?'向左移动':'向右移动'}
              onPointerDown={e=>touchDown(action,e)} onPointerUp={touchUp}
              onPointerCancel={touchUp} onLostPointerCapture={touchUp}>
              {action==='left'?'◀':'▶'}
            </button>)}
        </div>
        <button type="button" className="touch-key touch-fire" data-testid="touch-fire"
          disabled={state.phase!=='running'} aria-label="持续射击"
          onPointerDown={e=>touchDown('fire',e)} onPointerUp={touchUp}
          onPointerCancel={touchUp} onLostPointerCapture={touchUp}>射击</button>
      </nav>
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
