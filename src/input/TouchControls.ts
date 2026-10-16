import type { GameCommand } from '../core/engine.ts';

export type TouchAction = 'left' | 'right' | 'fire';
type Sink = (command:GameCommand)=>void;
/** Tracks simultaneous pointer IDs. Only sends the same legal 2D GameCommand used by keyboard. */
export class TouchControls {
  private readonly held=new Map<number,TouchAction>();
  private enabled=false;
  private lastDirection:-1|0|1=0;
  private fired=false;
  private readonly send:Sink;
  constructor(send:Sink){this.send=send;}
  setEnabled(enabled:boolean):void{
    if(this.enabled===enabled)return;
    this.releaseAll();
    this.enabled=enabled;
  }
  down(action:TouchAction,pointerId:number):void{
    if(!this.enabled||!Number.isSafeInteger(pointerId)||this.held.has(pointerId))return;
    this.held.set(pointerId,action);
    this.emit();
  }
  up(pointerId:number):void{
    if(this.held.delete(pointerId))this.emit();
  }
  private emit():void{
    if(!this.enabled)return;
    let left=false,right=false,fire=false;
    for(const action of this.held.values()){
      left ||= action==='left';
      right ||= action==='right';
      fire ||= action==='fire';
    }
    const direction:-1|0|1=left===right?0:left?-1:1;
    if(direction!==this.lastDirection){
      this.send({type:'SET_MOVEMENT',direction});
      this.lastDirection=direction;
    }
    if(fire!==this.fired){
      this.send({type:'SET_FIRING',active:fire});
      this.fired=fire;
    }
  }
  releaseAll():void{
    this.held.clear();
    if(this.enabled && this.lastDirection!==0)this.send({type:'SET_MOVEMENT',direction:0});
    if(this.enabled && this.fired)this.send({type:'SET_FIRING',active:false});
    this.lastDirection=0;this.fired=false;
  }
  get activeCount():number{return this.held.size;}
  get activeActions():string{return [...this.held.values()].join(',');}
  dispose():void{this.releaseAll();this.enabled=false;}
}
