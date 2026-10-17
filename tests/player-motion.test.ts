import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerShipMotion} from '../src/render/PlayerShipMotion.ts';

test('玩家倾斜方向/偏航/高度都只来自显示状态，不改变 XY 输入',()=>{
  const motion=new PlayerShipMotion();
  const x=18;
  motion.update(x,1,'running',1000);
  const right=motion.update(x+.20,2,'running',1020);
  assert.ok(right.roll<-.01 && right.yaw>0 && right.pitch>0);
  assert.ok(Math.abs(right.roll)<=.21);
  assert.ok(Math.abs(right.yaw)<=.09);
  assert.ok(Math.abs(right.offsetY)<.04);
  assert.ok(Math.abs(right.offsetZ)<.05);
  const left=motion.update(x-.20,3,'running',1040);
  assert.ok(left.roll>right.roll);
});
test('暂停完全冻结姿态和后坐，恢复平滑回正且重置无漂移',()=>{
  const m=new PlayerShipMotion();
  m.update(18,1,'running',100);
  m.update(18.2,2,'running',120);
  m.shot();
  const prev=m.update(18.2,3,'running',140);
  assert.ok(prev.recoil>0);
  const frozen=m.update(18.2,3,'paused',9000);
  assert.deepEqual(frozen,prev);
  const idle=m.update(18.2,4,'running',9020);
  assert.ok(Math.abs(idle.roll)<Math.abs(prev.roll));
  const rest=m.update(18.2,0,'ready',9050);
  assert.deepEqual(rest,{roll:0,yaw:0,pitch:0,offsetY:0,offsetZ:0,recoil:0});
  m.update(18,1,'running',9100);
  assert.deepEqual(m.update(18.3,2,'running',9120,true),rest);
});
