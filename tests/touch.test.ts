import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchControls} from '../src/input/TouchControls.ts';
import type {GameCommand} from '../src/core/engine.ts';

test('两指左右+射击、双方向抵消和单指移除时恢复方向',()=>{
  const commands:GameCommand[]=[];
  const touch=new TouchControls(command=>commands.push(command));
  touch.setEnabled(true);
  touch.down('left',1);touch.down('fire',2);
  assert.deepEqual(commands,[{type:'SET_MOVEMENT',direction:-1},{type:'SET_FIRING',active:true}]);
  touch.down('right',3);
  assert.deepEqual(commands.at(-1),{type:'SET_MOVEMENT',direction:0});
  touch.up(3);
  assert.deepEqual(commands.at(-1),{type:'SET_MOVEMENT',direction:-1});
  touch.up(1);
  assert.deepEqual(commands.at(-1),{type:'SET_MOVEMENT',direction:0});
  touch.up(2);
  assert.deepEqual(commands.at(-1),{type:'SET_FIRING',active:false});
  touch.dispose();
  assert.equal(touch.activeCount,0);
});
test('暂停、失焦、取消、重复 pointer IDs、被禁用状态防粘键',()=>{
  const log:GameCommand[]=[];
  const touch=new TouchControls(x=>log.push(x));
  touch.down('left',1);assert.equal(log.length,0);
  touch.setEnabled(true);
  touch.down('left',1);touch.down('left',1);touch.down('fire',2);
  assert.equal(log.length,2);
  touch.releaseAll();
  assert.deepEqual(log.slice(-2),[{type:'SET_MOVEMENT',direction:0},{type:'SET_FIRING',active:false}]);
  touch.setEnabled(false);touch.down('right',3);assert.equal(touch.activeCount,0);
  touch.up(3);
  touch.setEnabled(true);touch.down('right',7);
  touch.setEnabled(false);
  assert.deepEqual(log.at(-1),{type:'SET_MOVEMENT',direction:0});
  touch.dispose();
});
