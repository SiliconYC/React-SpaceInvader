import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CameraDirector} from '../src/render/CameraDirector.ts';
import type {GameSnapshot,GameEvent} from '../src/core/engine.ts';

const snap={world:{width:36,height:20},player:{position:{x:18,y:2}}} as GameSnapshot;
const opening:GameEvent={type:'phase-changed',from:'ready',to:'running',tick:0};
const wave:GameEvent={type:'wave-started',tick:120,wave:2,total:2,waveId:'wave-2'};
const victory:GameEvent={type:'game-finished',tick:150,phase:'won',outcome:'cleared'};
const defeat:GameEvent={type:'game-finished',tick:150,phase:'lost',outcome:'line-breached'};

test('P4 D2: opening dolly returns to exactly neutral camera without any rule time',()=>{
 const d=new CameraDirector();d.consume([opening],snap);
 const first=d.sample(0,'running',true,false);
 assert.equal(first.cue,'opening');assert.ok(first.zoom<1);
 assert.ok(d.sample(450,'running',true,false).zoom>first.zoom);
 const settled=d.sample(1200,'running',true,false);
 assert.deepEqual(settled,{cue:'idle',progress:1,x:0,y:0,zoom:1,roll:0});
});
test('P4 D2: wave accent is temporary and not equivalent to opening dolly',()=>{
 const d=new CameraDirector();d.consume([wave],snap);
 d.sample(100,'running',true,false);
 const accent=d.sample(435,'running',true,false);
 assert.equal(accent.cue,'wave');assert.ok(accent.zoom>1);assert.ok(accent.x>0);
 assert.equal(d.sample(980,'running',true,false).cue,'idle');
});
test('P4 D2: pause and hidden state never accumulate wall time; reset cancels',()=>{
 const d=new CameraDirector();d.consume([opening],snap);
 d.sample(100,'running',true,false);
 const first=d.sample(300,'running',true,false);
 assert.equal(d.sample(100000,'paused',true,false).progress,first.progress);
 assert.equal(d.sample(200000,'running',false,false).progress,first.progress);
 assert.equal(d.sample(300000,'running',true,false).progress,first.progress);
 assert.ok(d.sample(300050,'running',true,false).progress>first.progress);
 d.consume([{type:'game-reset',tick:0}],snap);
 assert.equal(d.sample(300100,'ready',true,false).cue,'idle');
});
test('P4 D2: distinct win / loss settles and remains stable until reset',()=>{
 const d=new CameraDirector();d.consume([victory],snap);
 d.sample(0,'won',true,false);
 const win=d.sample(1000,'won',true,false);
 assert.equal(win.cue,'victory');assert.ok(win.zoom>1);assert.ok(win.y<0);
 d.consume([defeat],snap);
 d.sample(2000,'lost',true,false);
 const lost=d.sample(3000,'lost',true,false);
 assert.equal(lost.cue,'defeat');assert.ok(lost.zoom<1);assert.ok(lost.y>0);
 assert.notDeepEqual(win,lost);
 d.reset();assert.equal(d.sample(3100,'ready',true,false).cue,'idle');
});
test('P4 D2: reduced motion eliminates every moving cue',()=>{
 const d=new CameraDirector();d.consume([opening,wave,victory],snap);
 assert.deepEqual(d.sample(10,'won',true,true),{cue:'idle',progress:1,x:0,y:0,zoom:1,roll:0});
});
