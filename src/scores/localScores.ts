export const SCORE_STORAGE_KEY = 'react-space-invader.scores.v1';
export const MAX_PER_LEVEL = 8;
export interface ScoreEntry {
  readonly id: string;
  readonly levelId: string;
  readonly score: number;
  readonly result: 'won' | 'lost';
  readonly completedWaves: number;
  readonly totalWaves: number;
  readonly ticks: number;
  readonly seed: number;
  readonly at: string;
}
const idOk = (s:unknown):s is string => typeof s === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(s);
export function isScoreEntry(value:unknown):value is ScoreEntry {
  if (!value || typeof value!=='object'||Array.isArray(value)) return false;
  const x=value as Record<string,unknown>;
  return Object.keys(x).sort().join(',') === 'at,completedWaves,id,levelId,result,score,seed,ticks,totalWaves' &&
    typeof x.id==='string' && x.id.length>=3 && x.id.length<=90 &&
    /^[a-zA-Z0-9_.:-]+$/.test(x.id) && idOk(x.levelId) &&
    Number.isSafeInteger(x.score) && (x.score as number)>=0 && (x.score as number)<=100_000_000 &&
    (x.result==='won'||x.result==='lost') &&
    Number.isSafeInteger(x.completedWaves) && (x.completedWaves as number)>=0 &&
    Number.isSafeInteger(x.totalWaves) && (x.totalWaves as number)>=1 &&
    (x.totalWaves as number)<=16 && (x.completedWaves as number)<=(x.totalWaves as number) &&
    Number.isSafeInteger(x.ticks) && (x.ticks as number)>=1 && (x.ticks as number)<=100_000_000 &&
    Number.isSafeInteger(x.seed) && (x.seed as number)>=0 && (x.seed as number)<=0xffffffff &&
    typeof x.at==='string' && /^20\d\d-\d\d-\d\dT/.test(x.at) &&
    Number.isFinite(Date.parse(x.at)) && Date.parse(x.at)<4102444800000;
}
export function rankScores(entries:readonly ScoreEntry[]): ScoreEntry[] {
  const seen=new Set<string>();
  const byLevel=new Map<string,ScoreEntry[]>();
  for (const e of entries) {
    if (!isScoreEntry(e)||seen.has(e.id)) continue;
    seen.add(e.id);
    const row=byLevel.get(e.levelId) ?? [];
    row.push(e);byLevel.set(e.levelId,row);
  }
  const ranked:ScoreEntry[]=[];
  for(const [level,records] of [...byLevel.entries()].sort(([a],[b])=>a.localeCompare(b))) {
    void level;
    records.sort((a,b)=>b.score-a.score ||
      Number(b.result==='won')-Number(a.result==='won') ||
      a.ticks-b.ticks || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    ranked.push(...records.slice(0,MAX_PER_LEVEL));
  }
  return ranked;
}
export function readScores(storage?:Pick<Storage,'getItem'>):ScoreEntry[] {
  try {
    const source=storage??window.localStorage;
    const raw=source.getItem(SCORE_STORAGE_KEY);
    if(!raw)return [];
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return [];
    const data=parsed as Record<string,unknown>;
    if(data.version!==1||!Array.isArray(data.entries))return [];
    return rankScores(data.entries.filter(isScoreEntry));
  }catch{return [];}
}
export function saveScores(entries:readonly ScoreEntry[],storage?:Pick<Storage,'setItem'>):void {
  try {(storage??window.localStorage).setItem(SCORE_STORAGE_KEY,
    JSON.stringify({version:1,entries:rankScores(entries)}));
  }catch{/* privacy mode / quota: browser still plays; memory state remains */ }
}
export function clearScores(storage?:Pick<Storage,'removeItem'>):void {
  try {(storage??window.localStorage).removeItem(SCORE_STORAGE_KEY);}catch{/* no storage */ }
}
export function appendScore(entries:readonly ScoreEntry[],result:ScoreEntry,
                            storage?:Pick<Storage,'setItem'>):ScoreEntry[] {
  if(!isScoreEntry(result)||entries.some(e=>e.id===result.id))return rankScores(entries);
  const next=rankScores([...entries,result]);saveScores(next,storage);return next;
}
export function scoresFor(entries:readonly ScoreEntry[],levelId:string):ScoreEntry[] {
  return rankScores(entries).filter(e=>e.levelId===levelId);
}
