import * as THREE from 'three';
import type {GameEvent,GameSnapshot} from '../core/engine.ts';
import type {World2,Point2} from '../core/world.ts';

type Kind='muzzle'|'enemy-muzzle'|'burst'|'damage'|'armor'|'wave'|'finish'|'defeat';
const KINDS:readonly Kind[]=['muzzle','enemy-muzzle','burst','damage','armor','wave','finish','defeat'];
interface Particle {
  readonly slot:number; readonly kind:Kind; readonly born:number; readonly life:number;
  readonly x:number; readonly y:number; readonly vx:number; readonly vy:number;
  readonly spin:number; readonly size:number; readonly rotation:number;
}
/** One real Three.js instanced batch per event vocabulary, regardless of kill streak. */
export class CombatFX {
  readonly maxParticles=72;
  private readonly activeParticles:Particle[]=[];
  private readonly spare:number[]=[];
  private allocated=0;
  private readonly seen=new Set<string>();
  private readonly keys:string[]=[];
  private readonly geometries:THREE.BufferGeometry[];
  private readonly materials:Readonly<Record<Kind,THREE.MeshBasicMaterial>>;
  private readonly batches:Readonly<Record<Kind,THREE.InstancedMesh>>;
  private readonly matrix=new THREE.Matrix4();
  private readonly rotation=new THREE.Euler();
  private readonly quaternion=new THREE.Quaternion();
  private readonly scale=new THREE.Vector3();
  private readonly center=new THREE.Vector3();
  private emitted=0;
  private armorEmitted=0;
  private lastKind='';

  constructor(private readonly scene:THREE.Group,private readonly world:World2){
    // Authored geometry vocabulary: compact flashes, directionally launched hull chips and
    // *thin* local rings; never large opaque quads, smoke, postprocessing or camera shake.
    const spark=new THREE.OctahedronGeometry(.105,0);
    const chip=new THREE.TetrahedronGeometry(.16,0);
    const shield=new THREE.RingGeometry(.17,.225,20);
    const expanding=new THREE.RingGeometry(.20,.25,24);
    this.geometries=[spark,chip,shield,expanding];
    const material=(color:number,opacity:number)=>new THREE.MeshBasicMaterial({
      color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    });
    this.materials={
      muzzle:material(0x9cecff,.92),
      'enemy-muzzle':material(0xff9b69,.90),
      burst:material(0xffc18d,.86),
      damage:material(0xff718b,.88),
      armor:material(0xffdfac,.80),
      wave:material(0x80cae6,.38),
      finish:material(0xc4e7e8,.65),
      defeat:material(0xe58296,.58),
    };
    const batch=(kind:Kind,geometry:THREE.BufferGeometry)=>{
      const mesh=new THREE.InstancedMesh(geometry,this.materials[kind],this.maxParticles);
      mesh.name='p4-fx-'+kind;
      mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=5;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      return mesh;
    };
    this.batches={
      muzzle:batch('muzzle',spark),
      'enemy-muzzle':batch('enemy-muzzle',spark),
      burst:batch('burst',chip),
      damage:batch('damage',chip),
      armor:batch('armor',shield),
      wave:batch('wave',expanding),
      finish:batch('finish',expanding),
      defeat:batch('defeat',expanding),
    };
  }

  /** A bounded visual burst keyed by authoritative event, not independent gameplay. */
  private emit(kind:Kind,position:Point2,count:number,tick:number,seed:number):void{
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    const time=performance.now();
    const life=reduced?110:kind==='finish'||kind==='defeat'?650:
      kind==='wave'?390:kind==='burst'?340:kind==='damage'?300:
      kind==='armor'?230:150;
    const limit=reduced?1:count;
    for(let i=0;i<limit;i++){
      if(this.activeParticles.length>=this.maxParticles){
        const oldest=this.activeParticles.shift();
        if(oldest)this.spare.push(oldest.slot);
      }
      const slot=this.spare.pop()??this.allocated++;
      const theta=i*2.399963+seed*.43+tick*.17;
      const isShard=kind==='burst'||kind==='damage';
      const velocity=reduced?0:kind==='burst'?1.25:kind==='damage'?.83:
        kind==='muzzle'||kind==='enemy-muzzle'?.28:.07;
      const vx=isShard?Math.cos(theta)*velocity:Math.sin(theta)*velocity*.30;
      const vy=isShard?Math.sin(theta)*velocity:
        kind==='muzzle'?velocity:kind==='enemy-muzzle'?-velocity:0;
      this.activeParticles.push({
        slot,kind,born:time,life,
        x:position.x-this.world.width/2,
        y:position.y-this.world.height/2,
        vx,vy,spin:(i%2?1:-1)*.6,size:kind==='wave'?1.6:kind==='finish'||kind==='defeat'?2:
          kind==='burst'?.92:kind==='armor'?1.4:1,
        rotation:theta,
      });
    }
    this.emitted++;
    if(kind==='armor')this.armorEmitted++;
    this.lastKind=kind;
  }

  consume(events:readonly GameEvent[],state:GameSnapshot):void{
    for(const event of events){
      if(event.type==='game-reset'){
        this.clear();this.seen.clear();this.keys.length=0;
        this.emitted=0;this.armorEmitted=0;this.lastKind='';
        continue;
      }
      if(event.type==='phase-changed'&&event.to==='paused'){
        this.clear();continue;
      }
      let id='';
      if(event.type==='shot-fired')id='shot:'+event.tick+':'+event.bulletId;
      else if(event.type==='enemy-shot-fired')id='enemy-shot:'+event.tick+':'+event.bulletId;
      else if(event.type==='enemy-hit')id='kill:'+event.tick+':'+event.bulletId+':'+event.enemyId;
      else if(event.type==='enemy-damaged')id='armor:'+event.tick+':'+event.bulletId+':'+event.enemyId;
      else if(event.type==='player-hit')id='hurt:'+event.tick+':'+event.bulletId;
      else if(event.type==='wave-started')id='wave:'+event.wave+':'+event.tick;
      else if(event.type==='game-finished')id='finish:'+event.tick;
      if(!id||this.seen.has(id))continue;
      this.seen.add(id);this.keys.push(id);
      if(this.keys.length>512)this.seen.delete(this.keys.shift()!);
      if(event.type==='shot-fired'){
        const pos=state.projectiles.find(b=>b.id===event.bulletId)?.position ??
          {x:state.player.position.x,y:state.player.position.y+.8};
        this.emit('muzzle',pos,2,event.tick,event.bulletId);
      }else if(event.type==='enemy-shot-fired'){
        const enemy=state.enemies.find(e=>e.id===event.enemyId);
        if(enemy)this.emit('enemy-muzzle',{x:enemy.position.x,y:enemy.position.y-.5},
          2,event.tick,event.bulletId);
      }else if(event.type==='enemy-hit'){
        this.emit('burst',event.position,6,event.tick,event.bulletId);
      }else if(event.type==='enemy-damaged'){
        this.emit('armor',event.position,2,event.tick,event.bulletId);
      }else if(event.type==='player-hit'){
        this.emit('damage',event.position,5,event.tick,event.bulletId);
      }else if(event.type==='wave-started'){
        this.emit('wave',{x:this.world.width/2,y:this.world.height*.72},1,event.tick,event.wave);
      }else if(event.type==='game-finished'){
        this.emit(event.phase==='won'?'finish':'defeat',
          {x:this.world.width/2,y:this.world.height/2},2,event.tick,
          event.phase==='won'?1:2);
      }
    }
  }

  /** Called only by the established render loop; visual envelopes are not game clocks. */
  update(phase:GameSnapshot['phase'],_camera:THREE.OrthographicCamera|THREE.PerspectiveCamera):void{
    if(phase==='paused'||phase==='ready')this.clear();
    const now=performance.now();
    const counts:Record<Kind,number>={
      muzzle:0,'enemy-muzzle':0,burst:0,damage:0,armor:0,wave:0,finish:0,defeat:0,
    };
    for(let i=this.activeParticles.length-1;i>=0;i--){
      const p=this.activeParticles[i];
      const f=(now-p.born)/p.life;
      if(f>=1){
        this.activeParticles.splice(i,1);this.spare.push(p.slot);continue;
      }
      const drift=(1-Math.exp(-3*f))*.48;
      const outward=p.kind==='wave'||p.kind==='finish'||p.kind==='defeat'||p.kind==='armor';
      const fade=Math.max(.015,(1-f)*(1-f));
      const grow=outward?(.35+f*1.5):(.42+.58*fade);
      this.center.set(p.x+p.vx*drift,p.y+p.vy*drift,.73);
      this.rotation.set(f*p.spin*.28,f*p.spin*.22,p.rotation+(outward?0:f*p.spin));
      this.quaternion.setFromEuler(this.rotation);
      this.scale.setScalar(p.size*grow*Math.max(.12,fade));
      this.matrix.compose(this.center,this.quaternion,this.scale);
      const batch=this.batches[p.kind],index=counts[p.kind]++;
      batch.setMatrixAt(index,this.matrix);
    }
    for(const kind of KINDS){
      const batch=this.batches[kind];
      batch.count=counts[kind];
      if(batch.count)batch.instanceMatrix.needsUpdate=true;
    }
  }
  get active():number{return this.activeParticles.length;}
  get allocatedMeshes():number{return this.allocated;}
  get reusableMeshes():number{return this.spare.length;}
  get armorEvents():number{return this.armorEmitted;}
  get events():number{return this.emitted;}
  get kind():string{return this.lastKind;}
  get batchCount():number{return KINDS.length;}
  private clear():void{
    for(const p of this.activeParticles)this.spare.push(p.slot);
    this.activeParticles.length=0;
    for(const kind of KINDS)this.batches[kind].count=0;
  }
  dispose():void{
    this.clear();this.keys.length=0;this.seen.clear();
    this.spare.length=0;this.allocated=0;
    for(const kind of KINDS){
      this.scene.remove(this.batches[kind]);
      this.batches[kind].dispose();
      this.materials[kind].dispose();
    }
    for(const geo of this.geometries)geo.dispose();
  }
}
