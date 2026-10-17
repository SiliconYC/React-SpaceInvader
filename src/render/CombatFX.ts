import * as THREE from 'three';
import type { GameEvent, GameSnapshot } from '../core/engine.ts';
import type { World2, Point2 } from '../core/world.ts';


type Kind = 'muzzle' | 'burst' | 'damage' | 'armor' | 'wave' | 'finish';
interface Particle {
  readonly mesh: THREE.Mesh;
  readonly born: number;
  readonly life: number;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
  readonly kind: Kind;
}
/** Purely visual pool. No independent timers or physics; all objects live inside the renderer session. */
export class CombatFX {
  readonly maxParticles = 72;
  private readonly pool: Particle[] = [];
  private readonly seen = new Set<string>();
  private readonly keys: string[] = [];
  private readonly geometries: readonly THREE.BufferGeometry[];
  private readonly materials: Readonly<Record<Kind, THREE.MeshBasicMaterial>>;
  private wavePulseUntil = 0;
  private readonly reduceMotion: boolean;
  private emitted = 0;
  private armorEmitted = 0;
  private lastKinds = '';

  constructor(private readonly scene: THREE.Group, private readonly world: World2) {
    this.geometries = [new THREE.IcosahedronGeometry(.13,0),new THREE.RingGeometry(.32,.4,12)];
    const material = (color:number,opacity:number) => new THREE.MeshBasicMaterial({
      color, transparent:true, opacity, depthWrite:false, side:THREE.DoubleSide,
      toneMapped:false,
    });
    this.materials = {
      muzzle:material(0x85eaff,.88),
      burst:material(0xffbf83,.88),
      damage:material(0xff6675,.9),
      armor:material(0xffe19a,.86),
      wave:material(0x72d5f2,.58),
      finish:material(0xe5f4ff,.78),
    };
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Deterministic sequence based on event ID; display variations never consume GameEngine RNG. */
  private emit(kind: Kind, pos: Point2, count: number, tick: number, seed: number): void {
    const center = new THREE.Vector3(pos.x-this.world.width/2,pos.y-this.world.height/2,0);
    const now = performance.now();
    const limit = this.reduceMotion ? 1 : count;
    const duration = this.reduceMotion ? 140 : kind === 'wave' ? 650 : kind === 'finish' ? 800 : 280;
    for(let i=0;i<limit;i++){
      if(this.pool.length>=this.maxParticles){
        const old=this.pool.shift();
        if(old) this.scene.remove(old.mesh);
      }
      const angle=(i * 2.39996 + seed * .37 + tick * .13);
      const radius=kind==='wave' ? .14 : .07;
      const drift=kind==='muzzle' ? .13 : kind==='wave' ? .9 : .4;
      const mesh=new THREE.Mesh(this.geometries[kind==='wave'||kind==='finish'?1:0],this.materials[kind]);
      mesh.position.set(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius,.86);
      this.scene.add(mesh);
      this.pool.push({
        mesh,born:now,life:duration,x:mesh.position.x,y:mesh.position.y,
        dx:Math.cos(angle)*drift,dy:Math.sin(angle)*drift,scale:kind==='wave'?2:kind==='finish'?2.6:1,
        kind,
      });
    }
    this.emitted++;
    if(kind==='armor')this.armorEmitted++;
    this.lastKinds=kind;
  }

  consume(events:readonly GameEvent[],state:GameSnapshot):void {
    for(const event of events){
      if(event.type==='game-reset'){
        this.clear();
        this.seen.clear();this.keys.length=0;this.emitted=0;this.armorEmitted=0;
        continue;
      }
      if(event.type==='phase-changed'&&event.to==='paused'){
        this.clear();
        continue;
      }
      let id='';
      if(event.type==='shot-fired') id='shot:'+event.tick+':'+event.bulletId;
      else if(event.type==='enemy-hit') id='kill:'+event.tick+':'+event.bulletId+':'+event.enemyId;
      else if(event.type==='enemy-damaged') id='armor:'+event.tick+':'+event.bulletId+':'+event.enemyId;
      else if(event.type==='player-hit') id='hurt:'+event.tick+':'+event.bulletId;
      else if(event.type==='wave-started') id='wave:'+event.wave+':'+event.tick;
      else if(event.type==='game-finished') id='finish:'+event.tick;
      if(!id||this.seen.has(id))continue;
      this.seen.add(id); this.keys.push(id);
      if(this.keys.length>512) this.seen.delete(this.keys.shift()!);
      if(event.type==='shot-fired'){
        this.emit('muzzle',state.projectiles.find(b=>b.id===event.bulletId)?.position ??
          {x:state.player.position.x,y:state.player.position.y+.8},2,event.tick,event.bulletId);
      }else if(event.type==='enemy-hit'){
        this.emit('burst',event.position,7,event.tick,event.bulletId);
      }else if(event.type==='enemy-damaged'){
        this.emit('armor',event.position,3,event.tick,event.bulletId);
      }else if(event.type==='player-hit'){
        this.emit('damage',event.position,6,event.tick,event.bulletId);
      }else if(event.type==='wave-started'){
        this.emit('wave',{x:this.world.width/2,y:this.world.height*.72},5,event.tick,event.wave);
        this.wavePulseUntil=performance.now()+550;
      }else if(event.type==='game-finished'){
        this.emit('finish',{x:this.world.width/2,y:this.world.height/2},5,event.tick,
          event.phase==='won'?1:2);
      }
    }
  }
  /** Called in existing render() only. Pausing drops effects rather than leaving ghosts. */
  update(phase:GameSnapshot['phase'],camera:THREE.OrthographicCamera | THREE.PerspectiveCamera):void{
    const now=performance.now();
    if(phase==='paused')this.clear();
    for(let i=this.pool.length-1;i>=0;i--){
      const p=this.pool[i];
      const t=(now-p.born)/p.life;
      if(t>=1){
        this.scene.remove(p.mesh);this.pool.splice(i,1);continue;
      }
      p.mesh.position.x=p.x+p.dx*t;
      p.mesh.position.y=p.y+p.dy*t;
      p.mesh.scale.setScalar(p.scale*(p.kind==='wave'||p.kind==='finish'?1+.8*t:1-t*.6));
    }
    const pulse = !this.reduceMotion && now<this.wavePulseUntil ?
      Math.sin((1-(this.wavePulseUntil-now)/550)*Math.PI)*.012 : 0;
    const target=1+pulse;
    if(Math.abs(camera.zoom-target)>1e-7){camera.zoom=target;camera.updateProjectionMatrix();}
  }
  get active():number{return this.pool.length;}
  get armorEvents():number{return this.armorEmitted;}
  get events():number{return this.emitted;}
  get kind():string{return this.lastKinds;}
  clear():void{
    for(const p of this.pool)this.scene.remove(p.mesh);
    this.pool.length=0;this.wavePulseUntil=0;
  }
  dispose():void{
    this.clear();this.keys.length=0;this.seen.clear();
    for(const g of this.geometries)g.dispose();
    for(const m of Object.values(this.materials))m.dispose();
  }
}
