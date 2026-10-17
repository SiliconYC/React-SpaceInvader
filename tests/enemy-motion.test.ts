import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyPhase,enemyVisualPose,ZERO_ENEMY_POSE} from '../src/render/EnemyShipMotion.ts';

test('同种子同 ID/tick 悬停可复现，24 架相位稳定且不同',()=>{
  const ids=Array.from({length:24},(_,i)=>'scout-'+i);
  const a=ids.map(id=>enemyVisualPose('scout',id,120,1,'running'));
  const b=ids.map(id=>enemyVisualPose('scout',id,120,1,'running'));
  assert.deepEqual(a,b);
  assert.ok(new Set(ids.map(enemyPhase)).size>=22);
  assert.ok(new Set(a.map(x=>x.roll.toFixed(4))).size>12);
  assert.ok(a.every(p=>Math.abs(p.roll)<.11&&Math.abs(p.yaw)<.08&&Math.abs(p.lift)<.05));
});
test('三种敌机个性、折返方向与纯视觉边界不同',()=>{
  const scout=enemyVisualPose('scout','ship-one',93,1,'running');
  const raider=enemyVisualPose('raider','ship-one',93,1,'running');
  const guardian=enemyVisualPose('guardian','ship-one',93,1,'running');
  assert.notDeepEqual(scout,raider);
  assert.notDeepEqual(raider,guardian);
  assert.ok(Math.abs(guardian.lift)<Math.abs(scout.lift)+.05);
  assert.ok(Math.abs(guardian.roll)<.04);
  const opposite=enemyVisualPose('raider','ship-one',93,-1,'running');
  assert.ok(opposite.roll<raider.roll);
  assert.ok(opposite.yaw<raider.yaw);
});
test('暂停不继续更新、重置与减少动态效果统一归零',()=>{
  const pose=enemyVisualPose('raider','id',180,1,'running');
  assert.deepEqual(enemyVisualPose('raider','id',180,1,'paused'),pose);
  assert.deepEqual(enemyVisualPose('raider','id',0,1,'ready'),ZERO_ENEMY_POSE);
  assert.deepEqual(enemyVisualPose('raider','id',180,1,'running',true),ZERO_ENEMY_POSE);
  assert.deepEqual(enemyVisualPose('raider','id',180,1,'lost'),ZERO_ENEMY_POSE);
});
