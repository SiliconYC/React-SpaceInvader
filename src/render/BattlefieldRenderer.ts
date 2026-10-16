import * as THREE from 'three';
import type { GameSnapshot, GameEvent } from '../core/engine.ts';
import type { EnemyKind, EnemyState } from '../core/level.ts';
import type { Point2, World2 } from '../core/world.ts';
import { createShipTemplates } from './ShipModels.ts';
import { CombatFX } from './CombatFX.ts';

/** 世界坐标在二维，z 仅为渲染层深度，不参与任何游戏规则。 */
export function toDisplayXY(point: Point2, world: World2): THREE.Vector3 {
  return new THREE.Vector3(point.x - world.width / 2, point.y - world.height / 2, 0);
}

export class BattlefieldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly world: Readonly<World2>;
  private readonly resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  private readonly grid: THREE.LineSegments;
  private readonly playerMesh: THREE.Group;
  private readonly enemyMeshes = new Map<string, THREE.Group>();
  private readonly enemyTemplates: Readonly<Record<EnemyKind, THREE.Group>>;
  private readonly projectileMeshes = new Map<number, THREE.Mesh>();
  private readonly enemyProjectileMeshes = new Map<number, THREE.Mesh>();
  private readonly enemyBulletMaterial: THREE.MeshStandardMaterial;
  private readonly bulletGeometry: THREE.BufferGeometry;
  private readonly bulletMaterial: THREE.MeshStandardMaterial;
  private readonly effects: CombatFX;
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLDivElement, snapshot: GameSnapshot) {
    this.world = snapshot.world;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

    const boardGeometry = new THREE.BoxGeometry(this.world.width, this.world.height, 0.4);
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1928, metalness: 0.12, roughness: 0.86,
    });
    this.resources.push(boardGeometry, boardMaterial);
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.z = -0.35;
    this.scene.add(board);

    // 默认仅用几处低对比角标提示边界，不使用高亮外框。
    const halfW = this.world.width / 2;
    const halfH = this.world.height / 2;
    const corner = Math.min(this.world.width, this.world.height) * 0.055;
    const corners: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = sx * halfW;
        const y = sy * halfH;
        corners.push(
          new THREE.Vector3(x - sx * corner, y, 0.02),
          new THREE.Vector3(x, y, 0.02),
          new THREE.Vector3(x, y, 0.02),
          new THREE.Vector3(x, y - sy * corner, 0.02),
        );
      }
    }
    const markerGeometry = new THREE.BufferGeometry().setFromPoints(corners);
    const markerMaterial = new THREE.LineBasicMaterial({
      color: 0x638097, transparent: true, opacity: 0.36,
    });
    this.resources.push(markerGeometry, markerMaterial);
    this.scene.add(new THREE.LineSegments(markerGeometry, markerMaterial));

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
    this.scene.add(this.grid);

    // 原创 3D 舰船与三种不同体积和轮廓的敌机；同型号克隆共享 GPU 资源。
    const templates = createShipTemplates(this.resources);
    this.playerMesh = templates.player;
    this.enemyTemplates = templates.enemies;
    this.scene.add(this.playerMesh);
    this.scene.add(new THREE.HemisphereLight(0xb5d9ef, 0x10192a, .55));
    const rim = new THREE.DirectionalLight(0x82d8ef, .75);
    rim.position.set(8,-5,11);
    this.scene.add(rim);

    // 少量低对比空间尘点；不产生网格感，也不覆盖战斗或改变相机。
    const points: number[] = [];
    for (let i = 0; i < 72; i++) {
      const h1 = ((i*701+173) % 997)/997;
      const h2 = ((i*479+67) % 991)/991;
      points.push((h1-.5)*this.world.width, (h2-.5)*this.world.height, -.05);
    }
    const dust = new THREE.BufferGeometry();
    dust.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const dustMat = new THREE.PointsMaterial({color:0x365672,size:.055,transparent:true,opacity:.3,
      sizeAttenuation:true,depthWrite:false});
    this.resources.push(dust,dustMat);
    this.scene.add(new THREE.Points(dust,dustMat));

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
    this.effects = new CombatFX(this.scene,this.world);

    // 模型类型可调整外观，但队列数量、坐标和种类只来自纯逻辑快照.
    this.syncEnemies(snapshot);

    this.host.dataset.worldWidth = String(this.world.width);
    this.host.dataset.worldHeight = String(this.world.height);
    this.host.dataset.debugGrid = 'off';
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
    const aspect = width / height;
    const viewHeight = Math.max(this.world.height + 2.2, (this.world.width + 2.2) / aspect);
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.host.dataset.cameraSpanX = viewWidth.toFixed(3);
    this.host.dataset.cameraSpanY = viewHeight.toFixed(3);
  }

  render(state: GameSnapshot): void {
    if (state.world.width !== this.world.width || state.world.height !== this.world.height) {
      throw new Error('渲染器不能修改二维世界的规则尺寸');
    }
    const point = toDisplayXY(state.player.position, state.world);
    this.playerMesh.position.copy(point);
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
    this.host.dataset.fxActive = String(this.effects.active);
    this.host.dataset.fxEmitted = String(this.effects.events);
    this.host.dataset.fxKind = this.effects.kind;
    this.host.dataset.wave = String(state.currentWave);
    this.host.dataset.totalWaves = String(state.totalWaves);
    this.host.dataset.pendingWaves = String(state.pendingWaves);
    this.host.dataset.waitingForWave = String(state.waitingForWave);
    this.host.dataset.score = String(state.score);
    this.renderer.render(this.scene, this.camera);
  }

  /** All feedback is initiated only by unique authoritative GameEvent records. */
  consumeEvents(events: readonly GameEvent[],state?:GameSnapshot):void {
    if(state)this.effects.consume(events,state);
  }

  private syncProjectiles(state: GameSnapshot): void {
    const ids = new Set(state.projectiles.map(projectile => projectile.id));
    for (const [id, mesh] of this.projectileMeshes) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }
    for (const projectile of state.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
        this.scene.add(mesh);
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
        this.scene.remove(mesh);
        this.enemyProjectileMeshes.delete(id);
      }
    }
    for (const bullet of state.enemyProjectiles) {
      let mesh = this.enemyProjectileMeshes.get(bullet.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.bulletGeometry, this.enemyBulletMaterial);
        this.scene.add(mesh);
        this.enemyProjectileMeshes.set(bullet.id, mesh);
      }
      mesh.position.copy(toDisplayXY(bullet.position, this.world));
      mesh.position.z = 0.48;
    }
    this.host.dataset.enemyBulletCount = String(this.enemyProjectileMeshes.size);
  }

  /** 每帧读取逻辑快照，渲染器不计算位移/速度/折返。 */
  private syncEnemies(state: GameSnapshot): void {
    const active = new Set(state.enemies.map(enemy => enemy.id));
    for (const [id, mesh] of this.enemyMeshes) {
      if (!active.has(id)) {
        this.scene.remove(mesh);
        this.enemyMeshes.delete(id);
      }
    }
    for (const enemy of state.enemies) {
      let mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) {
        mesh = this.createEnemyMesh(enemy);
        this.enemyMeshes.set(enemy.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.copy(toDisplayXY(enemy.position, state.world));
    }
    this.host.dataset.enemyCount = String(this.enemyMeshes.size);
    this.host.dataset.enemyKinds = [...new Set(state.enemies.map(e => e.type))].sort().join(',');
    this.host.dataset.gpuAssets = String(this.resources.length);
    this.host.dataset.enemyFirstX = state.enemies[0]?.position.x.toFixed(4) ?? '';
    this.host.dataset.enemyFirstY = state.enemies[0]?.position.y.toFixed(4) ?? '';
    this.host.dataset.enemyDirection = String(state.formationDirection);
    this.host.dataset.enemyTurns = String(state.formationTurns);
  }

  private createEnemyMesh(enemy: EnemyState): THREE.Group {
    // clone() 按引用共享 BufferGeometry/Material；逐个销毁敌机仅需 scene.remove。
    const model = this.enemyTemplates[enemy.type].clone(true);
    model.userData.enemyId = enemy.id;
    model.userData.modelKind = enemy.type;
    return model;
  }

  dispose(): void {
    this.observer.disconnect();
    for (const mesh of this.enemyMeshes.values()) this.scene.remove(mesh);
    this.enemyMeshes.clear();
    this.projectileMeshes.clear();
    this.enemyProjectileMeshes.clear();
    this.effects.dispose();
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
