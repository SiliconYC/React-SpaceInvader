import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatFX} from '../src/render/CombatFX.ts';
import type {GameEvent,GameSnapshot} from '../src/core/engine.ts';

const sample=()=>({
  world:{width:36,height:22},
  player:{position:{x:18,y:2}},
  projectiles:[{id:1,position:{x:18,y:4}}],
  enemies:[{id:'g',position:{x:18,y:11}}],
}) as GameSnapshot;

test('P4/C3：真实 3D 特效复用常量 GPU 批次，连击不累积 draw calls',()=>{
  const scene=new THREE.Group(),state=sample();
  const fx=new CombatFX(scene,state.world);
  assert.equal(scene.children.length,fx.batchCount);
  const kills:Array<GameEvent>=Array.from({length:28},(_,i)=>({
    type:'enemy-hit',tick:120+i,bulletId:101+i,enemyId:'e'+i,
    position:{x:18+i%5,y:12},points:10,
  }));
  fx.consume(kills,state);
  assert.equal(fx.events,28);
  assert.equal(fx.batchCount,8);
  assert.equal(scene.children.length,8);
  assert.equal(fx.active,fx.maxParticles);
  assert.equal(fx.allocatedMeshes,72);
  fx.update('running',new THREE.OrthographicCamera());
  fx.update('paused',new THREE.OrthographicCamera());
  assert.equal(fx.active,0);
  assert.equal(fx.reusableMeshes,72);
  fx.consume(kills,state); // duplicate authoritative events never emit twice
  assert.equal(fx.events,28);
  fx.dispose();
  assert.equal(scene.children.length,0);
});
test('P4/C3：开火、装甲、玩家受伤、敌弹与终局各有事件响应，重置不残留',()=>{
  const scene=new THREE.Group(),state=sample();
  const fx=new CombatFX(scene,state.world);
  const events:GameEvent[]=[
    {type:'shot-fired',bulletId:1,tick:10},
    {type:'enemy-shot-fired',enemyId:'g',bulletId:100,tick:11},
    {type:'enemy-damaged',enemyId:'g',bulletId:1,tick:12,hp:2,maxHp:3,position:{x:18,y:11}},
    {type:'player-hit',bulletId:100,tick:13,lives:2,position:{x:18,y:2}},
    {type:'game-finished',tick:14,phase:'won',outcome:'cleared'},
  ];
  fx.consume(events,state);
  assert.equal(fx.events,5);
  assert.equal(fx.armorEvents,1);
  assert.equal(fx.kind,'finish');
  fx.consume([{type:'game-reset',tick:0}],state);
  assert.equal(fx.active,0);
  assert.equal(fx.events,0);
  assert.equal(fx.armorEvents,0);
  fx.consume([{type:'game-finished',tick:20,phase:'lost',outcome:'lives-exhausted'}],state);
  assert.equal(fx.kind,'defeat');
  fx.dispose();
});
