import test from 'node:test';
import assert from 'node:assert/strict';
import { readAudioPrefs,persistAudioPrefs,toAudioEvent,AUDIO_PREFS_KEY } from '../src/audio/GameAudio.ts';

test('音效映射仅依赖引擎权威事件，不会根据渲染帧生成',()=>{
  const events=[
    {type:'shot-fired',tick:1,bulletId:1},
    {type:'enemy-hit',tick:3,bulletId:1,enemyId:'x',points:10,position:{x:1,y:1}},
    {type:'enemy-damaged',tick:2,bulletId:1,enemyId:'x',hp:1,maxHp:2,position:{x:1,y:1}},
    {type:'player-hit',tick:4,bulletId:2,lives:2,position:{x:1,y:1}},
    {type:'wave-started',tick:0,wave:1,total:2,waveId:'a'},
    {type:'game-finished',tick:6,phase:'won',outcome:'cleared'},
    {type:'game-finished',tick:6,phase:'lost',outcome:'lives-exhausted'},
    {type:'game-reset',tick:0},
  ] as const;
  assert.deepEqual(events.map(e=>toAudioEvent(e)),['shot','kill','damage','hurt','wave','win','lose',null]);
});
test('音频偏好本地版本验证和禁用 Storage 均静默容错',()=>{
  let value='';
  const store={getItem:(_k:string)=>value,setItem:(k:string,v:string)=>{assert.equal(k,AUDIO_PREFS_KEY);value=v;}};
  assert.equal(readAudioPrefs(store).volume,.32);
  persistAudioPrefs({effects:false,music:true,volume:.15},store);
  assert.deepEqual(readAudioPrefs(store),{effects:false,music:true,volume:.15});
  for (const bad of ['{','{"version":2}','{"version":1,"effects":true,"music":true,"volume":3}']) {
    value=bad;assert.equal(readAudioPrefs(store).volume,.32);
  }
  assert.doesNotThrow(()=>persistAudioPrefs({effects:false,music:false,volume:0},
    {setItem:()=>{throw new Error('denied');}}));
  assert.deepEqual(readAudioPrefs({getItem:()=>{throw new Error('denied');}}),
    {effects:true,music:true,volume:.32});
});
