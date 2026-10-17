import * as THREE from 'three';
import type { GameSnapshot, GameEvent } from '../core/engine.ts';
import type { EnemyKind, EnemyState } from '../core/level.ts';
import type { Point2, World2 } from '../core/world.ts';
import { createShipTemplates } from './ShipModels.ts';
import { CombatFX } from './CombatFX.ts';
import { combatProjection } from './CombatProjection.ts';
import { CombatSceneLayers, SCENE_LAYER_ORDER } from './CombatSceneLayers.ts';

/** 世界坐标在二维，z 仅为渲染层深度，不参与任何游戏规则。 */
export function toDisplayXY(point: Point2, world: World2): THREE.Vector3 {
  return new THREE.Vector3(point.x - world.width / 2, point.y - world.height / 2, 0);
}

export class BattlefieldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly layers = new CombatSceneLayers(this.scene);
  private readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private readonly world: Readonly<World2>;
  private readonly resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  private readonly grid: THREE.LineSegments;
  private readonly playerMesh: THREE.Group;
  /** Each distinct ship-part geometry is drawn once per kind, regardless of enemy count. */
  private readonly enemyBatches: Record<EnemyKind, Array<{
    readonly mesh: THREE.InstancedMesh; readonly localMatrix: THREE.Matrix4
  }>> = {scout:[],raider:[],guardian:[]};
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly projectileMeshes = new Map<number, THREE.Mesh>();
  private readonly enemyProjectileMeshes = new Map<number, THREE.Mesh>();
  private readonly enemyBulletMaterial: THREE.MeshStandardMaterial;
  private readonly bulletGeometry: THREE.BufferGeometry;
  private readonly bulletMaterial: THREE.MeshStandardMaterial;
  private readonly effects: CombatFX;
  private readonly observer: ResizeObserver;
  private contextLost=false;
  private readonly lostHandler=(event:Event)=>{
    event.preventDefault();this.contextLost=true;
    this.host.dataset.webglContext='lost';this.onContext?.(true);
  };
  private readonly restoreHandler=()=>{
    this.contextLost=false;this.host.dataset.webglContext='ready';
    this.resize();this.onContext?.(false);
  };
  get isContextLost():boolean{return this.contextLost;}

  constructor(private readonly host: HTMLDivElement, snapshot: GameSnapshot,
    private readonly onContext?: (lost:boolean)=>void) {
    this.world = snapshot.world;
    // ?projection=ortho is an opt-in visual comparison, not a gameplay setting.
    this.camera = new URLSearchParams(window.location.search).get('projection') === 'ortho'
      ? new THREE.OrthographicCamera() : new THREE.PerspectiveCamera();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    const coarse=window.matchMedia?.('(pointer:coarse)').matches ?? false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    host.dataset.pixelRatio=this.renderer.getPixelRatio().toFixed(2);
    host.dataset.webglContext='ready';
    this.renderer.domElement.addEventListener('webglcontextlost',this.lostHandler);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.restoreHandler);
    this.renderer.setClearColor(0x050913, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.dataset.renderer = 'threejs';
    host.appendChild(this.renderer.domElement);

    // 镜头只根据视口改变投影尺寸，不改动逻辑世界的宽高或比例。
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0x9ebad6, 1));
    const key = new THREE.DirectionalLight(0x8baeca, 1.3);
    key.position.set(-8, 12, 16);
    this.scene.add(key);

    // Full-viewport sky, no box backboard, marker corners or engineering frame.
    this.scene.background = new THREE.Color(0x07152b);
    const halfW = this.world.width / 2;
    const halfH = this.world.height / 2;

    // 网格只供主动打开调试模式时核对二维位置。
    const gridPoints: THREE.Vector3[] = [];
    for (let x = 0; x <= this.world.width; x += 2) {
      const px = x - halfW;
      gridPoints.push(new THREE.Vector3(px, -halfH, 0.015), new THREE.Vector3(px, halfH, 0.015));
    }
    for (let y = 0; y <= this.world.height; y += 2) {
      const py = y - halfH;
      gridPoints.push(new THREE.Vector3(-halfW, py, 0.015), new THREE.Vector3(halfW, py, 0.015));
    }
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints);
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x365c78, transparent: true, opacity: 0.4,
    });
    this.resources.push(gridGeometry, gridMaterial);
    this.grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    this.grid.visible = false;
    this.layers.combat.add(this.grid);

    // 原创 3D 舰船与三种不同体积和轮廓的敌机；同型号克隆共享 GPU 资源。
    const templates = createShipTemplates(this.resources);
    this.playerMesh = templates.player;
    this.layers.combat.add(this.playerMesh);
    // Three meshes are static assets; InstancedMesh allows 24 scouts (and more)
    // to share the same few GPU draw calls, independent of total alive instances.
    for(const kind of ['scout','raider','guardian'] as const){
      const prototype=templates.enemies[kind];
      for(const part of prototype.children){
        if(!(part instanceof THREE.Mesh))continue;
        part.updateMatrix();
        const instances=new THREE.InstancedMesh(part.geometry,part.material,256);
        instances.count=0;
        instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instances.frustumCulled=false;
        this.enemyBatches[kind].push({mesh:instances,localMatrix:part.matrix.clone()});
        this.layers.combat.add(instances);
      }
    }
    this.scene.add(new THREE.HemisphereLight(0xb5d9ef, 0x10192a, .55));
    const rim = new THREE.DirectionalLight(0x82d8ef, .75);
    rim.position.set(8,-5,11);
    this.scene.add(rim);

    // 少量低对比空间尘点；不产生网格感，也不覆盖战斗或改变相机。
    const points: number[] = [];
    for (let i = 0; i < 72; i++) {
      const h1 = ((i*701+173) % 997)/997;
      const h2 = ((i*479+67) % 991)/991;
      points.push((h1-.5)*this.world.width, (h2-.5)*this.world.height, -12);
    }
    const dust = new THREE.BufferGeometry();
    dust.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const dustMat = new THREE.PointsMaterial({color:0x365672,size:.055,transparent:true,opacity:.3,
      sizeAttenuation:true,depthWrite:false});
    this.resources.push(dust,dustMat);
    this.layers.starfield.add(new THREE.Points(dust,dustMat));

    this.bulletGeometry = new THREE.CapsuleGeometry(0.10, 0.35, 4, 8);
    this.bulletMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8f9ff, emissive: 0x51cfff, emissiveIntensity: 1.9,
      metalness: 0.1, roughness: 0.2,
    });
    this.enemyBulletMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb6a0, emissive: 0xef553f, emissiveIntensity: 1.25,
      metalness: 0.08, roughness: 0.3,
    });
    this.resources.push(this.bulletGeometry, this.bulletMaterial, this.enemyBulletMaterial);
    this.effects = new CombatFX(this.layers.combat,this.world);

    // 模型类型可调整外观，但队列数量、坐标和种类只来自纯逻辑快照.
    this.syncEnemies(snapshot);

    this.host.dataset.worldWidth = String(this.world.width);
    this.host.dataset.worldHeight = String(this.world.height);
    this.host.dataset.debugGrid = 'off';
    this.host.dataset.sceneLayers = SCENE_LAYER_ORDER.join(',');
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host);
    this.resize();
    this.render(snapshot);
  }

  setDebugVisible(enabled: boolean): void {
    this.grid.visible = enabled;
    this.host.dataset.debugGrid = enabled ? 'on' : 'off';
  }

  resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const coarse = window.matchMedia?.('(pointer:coarse)').matches ?? false;
    const layout = combatProjection(this.world, width, height, coarse);
    const isPerspective = this.camera instanceof THREE.PerspectiveCamera;
    const distance = isPerspective ? layout.cameraDistance : 50;
    this.camera.position.set(0, layout.centerY, distance);
    this.camera.lookAt(0, layout.centerY, 0);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = layout.fovDegrees;
      this.camera.aspect = width / height;
    } else {
      this.camera.left = -layout.spanX / 2;
      this.camera.right = layout.spanX / 2;
      this.camera.top = layout.spanY / 2;
      this.camera.bottom = -layout.spanY / 2;
    }
    this.camera.near = .1;
    this.camera.far = Math.max(distance + 150, 200);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    if (!this.contextLost) this.renderer.setSize(width, height, false);
    this.host.dataset.cameraProjection = isPerspective ? 'perspective' : 'orthographic';
    this.host.dataset.cameraFov = isPerspective ? String(layout.fovDegrees) : '0';
    this.host.dataset.cameraDistance = distance.toFixed(3);
    this.host.dataset.cameraSpanX = layout.spanX.toFixed(3);
    this.host.dataset.cameraSpanY = layout.spanY.toFixed(3);
    this.host.dataset.cameraCenterY = layout.centerY.toFixed(3);
    this.layers.refresh(this.world,this.camera,width,height,coarse);
  }

  render(state: GameSnapshot): void {
    if(this.contextLost)return;
    if (state.world.width !== this.world.width || state.world.height !== this.world.height) {
      throw new Error('渲染器不能修改二维世界的规则尺寸');
    }
    const point = toDisplayXY(state.player.position, state.world);
    this.playerMesh.position.copy(point);
    // Project with the actual Three.js camera, rather than an unrelated CSS approximation.
    const projected = point.clone().project(this.camera);
    this.host.dataset.playerScreenX = ((projected.x + 1) * .5 * this.host.clientWidth).toFixed(3);
    this.host.dataset.playerScreenY = ((1 - projected.y) * .5 * this.host.clientHeight).toFixed(3);
    this.host.dataset.playerX = state.player.position.x.toFixed(4);
    this.host.dataset.playerY = state.player.position.y.toFixed(4);
    this.syncEnemies(state);
    this.syncProjectiles(state);
    this.syncEnemyProjectiles(state);
    // Display-only damage feedback driven by fixed rule ticks, not a damage decision.
    this.playerMesh.visible = state.phase !== 'lost' &&
      !(state.invulnerableUntilTick > state.tick && Math.floor(state.tick / 6) % 2 === 0);
    this.host.dataset.lives = String(state.lives);
    this.host.dataset.gamePhase = state.phase;
    this.host.dataset.outcome = state.outcome ?? '';
    this.effects.update(state.phase,this.camera);
    this.layers.refresh(this.world,this.camera,this.host.clientWidth,this.host.clientHeight,
      window.matchMedia?.('(pointer:coarse)').matches ?? false);
    this.host.dataset.foregroundCount=String(this.layers.foregroundCount);
    this.host.dataset.foregroundVisible=String(this.layers.visibleForegroundCount);
    this.host.dataset.fxActive = String(this.effects.active);
    this.host.dataset.fxEmitted = String(this.effects.events);
    this.host.dataset.fxArmorEvents=String(this.effects.armorEvents);
    this.host.dataset.fxKind = this.effects.kind;
    this.host.dataset.wave = String(state.currentWave);
    this.host.dataset.totalWaves = String(state.totalWaves);
    this.host.dataset.pendingWaves = String(state.pendingWaves);
    this.host.dataset.waitingForWave = String(state.waitingForWave);
    this.host.dataset.score = String(state.score);
    this.renderer.render(this.scene, this.camera);
    this.host.dataset.drawCalls=String(this.renderer.info.render.calls);
    this.host.dataset.gpuGeometries=String(this.renderer.info.memory.geometries);
    this.host.dataset.gpuTextures=String(this.renderer.info.memory.textures);
  }

  /** All feedback is initiated only by unique authoritative GameEvent records. */
  consumeEvents(events: readonly GameEvent[],state?:GameSnapshot):void {
    if(state)this.effects.consume(events,state);
  }

  private syncProjectiles(state: GameSnapshot): void {
    const ids = new Set(state.projectiles.map(projectile => projectile.id));
    for (const [id, mesh] of this.projectileMeshes) {
      if (!ids.has(id)) {
        this.layers.combat.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }
    for (const projectile of state.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
        this.layers.combat.add(mesh);
        this.projectileMeshes.set(projectile.id, mesh);
      }
      mesh.position.copy(toDisplayXY(projectile.position, this.world));
      mesh.position.z = 0.48;
    }
    this.host.dataset.bulletCount = String(this.projectileMeshes.size);
  }

  private syncEnemyProjectiles(state: GameSnapshot): void {
    const ids = new Set(state.enemyProjectiles.map(bullet => bullet.id));
    for (const [id, mesh] of this.enemyProjectileMeshes) {
      if (!ids.has(id)) {
        this.layers.combat.remove(mesh);
        this.enemyProjectileMeshes.delete(id);
      }
    }
    for (const bullet of state.enemyProjectiles) {
      let mesh = this.enemyProjectileMeshes.get(bullet.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.bulletGeometry, this.enemyBulletMaterial);
        this.layers.combat.add(mesh);
        this.enemyProjectileMeshes.set(bullet.id, mesh);
      }
      mesh.position.copy(toDisplayXY(bullet.position, this.world));
      mesh.position.z = 0.48;
    }
    this.host.dataset.enemyBulletCount = String(this.enemyProjectileMeshes.size);
  }

  /** 每帧读取逻辑快照，渲染器不计算位移/速度/折返。 */
  /** No per-enemy Mesh allocations or draw calls. XY logic remains entirely in GameSnapshot. */
  private syncEnemies(state: GameSnapshot): void {
    const active:Record<EnemyKind,EnemyState[]>={scout:[],raider:[],guardian:[]};
    for(const enemy of state.enemies)active[enemy.type].push(enemy);
    for(const kind of ['scout','raider','guardian'] as const){
      const enemies=active[kind];
      for(const part of this.enemyBatches[kind]){
        const instances=part.mesh;
        instances.count=enemies.length;
        for(let index=0;index<enemies.length;index++){
          const {x,y}=enemies[index].position;
          this.tempMatrix.makeTranslation(x-state.world.width/2,y-state.world.height/2,0);
          this.tempMatrix.multiply(part.localMatrix);
          instances.setMatrixAt(index,this.tempMatrix);
        }
        if(enemies.length>0)instances.instanceMatrix.needsUpdate=true;
      }
    }
    this.host.dataset.enemyCount = String(state.enemies.length);
    this.host.dataset.enemyHp = String(state.enemies[0]?.hp ?? '');
    this.host.dataset.enemyMaxHp = String(state.enemies[0]?.maxHp ?? '');
    this.host.dataset.enemyKinds = [...new Set(state.enemies.map(e => e.type))].sort().join(',');
    this.host.dataset.gpuAssets = String(this.resources.length);
    this.host.dataset.enemyFirstX = state.enemies[0]?.position.x.toFixed(4) ?? '';
    this.host.dataset.enemyFirstY = state.enemies[0]?.position.y.toFixed(4) ?? '';
    this.host.dataset.enemyDirection = String(state.formationDirection);
    this.host.dataset.enemyTurns = String(state.formationTurns);
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.lostHandler);
    this.renderer.domElement.removeEventListener('webglcontextrestored',this.restoreHandler);
    for (const kind of ['scout','raider','guardian'] as const){
      for(const part of this.enemyBatches[kind]){
        this.layers.combat.remove(part.mesh);
        part.mesh.dispose(); // instance buffers only; shared materials/geometries disposed below
      }
    }
    this.projectileMeshes.clear();
    this.enemyProjectileMeshes.clear();
    this.effects.dispose();
    this.layers.dispose();
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
