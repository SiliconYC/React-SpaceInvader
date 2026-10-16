import * as THREE from 'three';
import type { GameSnapshot } from '../core/engine.ts';
import type { EnemyKind, EnemyState } from '../core/level.ts';
import type { Point2, World2 } from '../core/world.ts';

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
  private readonly enemyMeshes = new Map<string, THREE.Mesh>();
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

    // 独立三维显示对象：飞船坐标只能来自 GameSnapshot 的二维位置。
    this.playerMesh = new THREE.Group();
    const silhouette = new THREE.Shape();
    silhouette.moveTo(0, 0.68);
    silhouette.lineTo(-0.26, 0.22);
    silhouette.lineTo(-1.2, -0.44);
    silhouette.lineTo(-0.78, -0.65);
    silhouette.lineTo(0, -0.32);
    silhouette.lineTo(0.78, -0.65);
    silhouette.lineTo(1.2, -0.44);
    silhouette.lineTo(0.26, 0.22);
    silhouette.closePath();
    const hull = new THREE.ExtrudeGeometry(silhouette, {
      depth: 0.32, bevelEnabled: true, bevelSegments: 1, steps: 1,
      bevelSize: 0.065, bevelThickness: 0.07,
    });
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x60d5e4, emissive: 0x14546b, emissiveIntensity: 0.48,
      metalness: 0.65, roughness: 0.28,
    });
    this.resources.push(hull, hullMaterial);
    this.playerMesh.add(new THREE.Mesh(hull, hullMaterial));
    const cockpitGeometry = new THREE.SphereGeometry(0.23, 12, 8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0xe4f9ff, emissive: 0x3b9ac2, emissiveIntensity: 0.4,
      metalness: 0.15, roughness: 0.27,
    });
    this.resources.push(cockpitGeometry, cockpitMaterial);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.03, 0.42);
    cockpit.scale.set(0.75, 1.15, 0.55);
    this.playerMesh.add(cockpit);
    this.scene.add(this.playerMesh);

    // 模型类型可调整外观，但队列数量、坐标和种类只来自纯逻辑快照。
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
    this.renderer.render(this.scene, this.camera);
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
    this.host.dataset.enemyFirstX = state.enemies[0]?.position.x.toFixed(4) ?? '';
    this.host.dataset.enemyFirstY = state.enemies[0]?.position.y.toFixed(4) ?? '';
    this.host.dataset.enemyDirection = String(state.formationDirection);
    this.host.dataset.enemyTurns = String(state.formationTurns);
  }

  private createEnemyMesh(enemy: EnemyState): THREE.Mesh {
    const type: EnemyKind = enemy.type;
    const width = enemy.width;
    const height = enemy.height;
    const outline = new THREE.Shape();
    // 原创简洁轮廓，保留 3D 厚度与光照而不引入额外维度玩法。
    if (type === 'scout') {
      outline.moveTo(-width * 0.46, height * 0.18);
      outline.lineTo(-width * 0.25, -height * 0.4);
      outline.lineTo(0, -height * 0.2);
      outline.lineTo(width * 0.25, -height * 0.4);
      outline.lineTo(width * 0.46, height * 0.18);
      outline.lineTo(0, height * 0.42);
    } else if (type === 'raider') {
      outline.moveTo(-width * 0.5, 0);
      outline.lineTo(-width * 0.27, -height * 0.44);
      outline.lineTo(width * 0.27, -height * 0.44);
      outline.lineTo(width * 0.5, 0);
      outline.lineTo(width * 0.27, height * 0.44);
      outline.lineTo(-width * 0.27, height * 0.44);
    } else {
      outline.moveTo(-width * 0.44, height * 0.33);
      outline.lineTo(-width * 0.48, -height * 0.32);
      outline.lineTo(width * 0.48, -height * 0.32);
      outline.lineTo(width * 0.44, height * 0.33);
    }
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.23, bevelEnabled: true, bevelSegments: 1, steps: 1,
      bevelSize: 0.045, bevelThickness: 0.055,
    });
    const color = type === 'scout' ? 0xe3a16d : type === 'raider' ? 0xdd719c : 0xa591db;
    const material = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.13,
      metalness: 0.36, roughness: 0.45,
    });
    this.resources.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.enemyId = enemy.id;
    return mesh;
  }

  dispose(): void {
    this.observer.disconnect();
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
