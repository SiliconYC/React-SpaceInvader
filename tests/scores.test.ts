import test from 'node:test';
import assert from 'node:assert/strict';
import {appendScore,clearScores,isScoreEntry,readScores,rankScores,scoresFor,MAX_PER_LEVEL} from '../src/scores/localScores.ts';
const make=(i:number,levelId='first-contact',score=100)=>({
  id:'session:'+i,levelId,score,result:'won' as const,
  completedWaves:1,totalWaves:1,ticks:120+i,seed:7,at:'2026-10-17T00:00:00.000Z'
});
test('本地成绩分关卡、并列判定按胜负/逻辑时长/时间与 ID 稳定排序，限制前 8',()=>{
 const input=[make(5,'first-contact',50),make(2),make(3),make(4,'crossfire',200),
  make(1),make(2)];
 const ordered=rankScores(input);
 assert.deepEqual(scoresFor(ordered,'first-contact').map(x=>x.id),['session:1','session:2','session:3','session:5']);
 assert.deepEqual(scoresFor(ordered,'crossfire').map(x=>x.id),['session:4']);
 assert.equal(rankScores(Array.from({length:19},(_,i)=>make(i+1))).length,MAX_PER_LEVEL);
});
test('无效版本、损坏 JSON、恶意字段、非有限积分等丢弃；Storage 拒绝不阻断',()=>{
 let value='';
 const store={
   getItem:()=>value,
   setItem:(_k:string,s:string)=>{value=s;},
   removeItem:()=>{value='';}
 };
 assert.deepEqual(readScores(store),[]);
 const source=make(1);
 assert.equal(isScoreEntry({...source,score:Infinity}),false);
 assert.equal(isScoreEntry({...source,score:-1}),false);
 assert.equal(isScoreEntry({...source,score:1e12}),false);
 assert.equal(isScoreEntry({...source,unexpected:true}),false);
 assert.equal(isScoreEntry({...source,ticks:0}),false);
 assert.equal(isScoreEntry({...source,at:'bad'}),false);
 for(const v of ['{bad','{"version":2,"entries":[]}','{"version":1,"entries":42}']){
   value=v;assert.deepEqual(readScores(store),[]);
 }
 const records=appendScore([],source,store);
 assert.equal(readScores(store).length,1);
 assert.equal(appendScore(records,source,store).length,1);
 value=JSON.stringify({version:1,entries:[source,{...source,score:-2},make(3)]});
 assert.equal(readScores(store).length,2);
 clearScores(store);assert.deepEqual(readScores(store),[]);
 assert.doesNotThrow(()=>appendScore([],source,{setItem:()=>{throw new Error('denied');}}));
 assert.deepEqual(readScores({getItem:()=>{throw new Error('denied');}}),[]);
});
