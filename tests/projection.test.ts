import test from 'node:test';
import assert from 'node:assert/strict';
import { combatProjection, projectBattlePoint, compositionFromSearch } from '../src/render/CombatProjection.ts';

const world = { width: 36, height: 24 };
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('同一 XY 战斗平面在所有视口具有均匀的像素刻度', () => {
  for (const [w,h,coarse] of [[1440,900,false],[800,600,false],[390,844,true],[844,390,true],[320,700,true]] as const) {
    const layout = combatProjection(world,w,h,coarse);
    const a = projectBattlePoint({x:0,y:0},world,layout,w,h);
    const b = projectBattlePoint({x:12,y:12},world,layout,w,h);
    const c = projectBattlePoint({x:24,y:24},world,layout,w,h);
    close(b.x-a.x,c.x-b.x); close(a.y-b.y,b.y-c.y);
    close(b.x-a.x,(12*h/layout.spanY));
    close(a.y-b.y,(12*h/layout.spanY));
    assert.ok(layout.spanX >= world.width + 2.2 - 1e-9);
    assert.ok(layout.spanY >= world.height + (coarse ? 7 : 2.2));
    close(2*Math.atan(layout.spanY/(2*layout.cameraDistance))*180/Math.PI,layout.fovDegrees);
  }
});
test('中心视轴始终垂直 XY，透视与正交共用零视差坐标公式', () => {
  const l = combatProjection(world,1200,800,false);
  const p = projectBattlePoint({x:18,y:12},world,l,1200,800);
  close(p.x,600); close(p.y,400);
  const left = projectBattlePoint({x:1.25,y:2},world,l,1200,800);
  const right = projectBattlePoint({x:34.75,y:2},world,l,1200,800);
  close((left.x+right.x)/2,600);
  close(left.y,right.y);
});
test('非法尺寸必须拒绝，不能传播 NaN 到摄影机', () => {
  assert.throws(()=>combatProjection(world,0,200,false),RangeError);
  assert.throws(()=>combatProjection(world,200,0,false),RangeError);
});

test('P4/A1 两种构图严格保持 XY 等比例和安全边界',()=>{
  assert.equal(compositionFromSearch('?composition=breathing'),'breathing');
  assert.equal(compositionFromSearch(''),'stage');
  for(const [width,height,coarse] of [[1920,1080,false],[390,844,true],[844,390,true]] as const){
    const stage=combatProjection(world,width,height,coarse,'stage');
    const airy=combatProjection(world,width,height,coarse,'breathing');
    assert.ok(airy.spanY>stage.spanY);
    for(const layout of [stage,airy]){
      const left=projectBattlePoint({x:0,y:2},world,layout,width,height);
      const right=projectBattlePoint({x:36,y:2},world,layout,width,height);
      assert.ok(left.x>0&&right.x<width);
      close(right.x-left.x,world.width*height/layout.spanY);
    }
  }
});
