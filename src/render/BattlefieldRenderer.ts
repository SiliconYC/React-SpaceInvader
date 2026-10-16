import * as THREE from 'three';
import type { GameSnapshot } from '../core/engine.ts';
import type { Point2, World2 } from '../core/world.ts';

/** 此映射仅供显示；z 为固定 0，不写回任何游戏状态或参与碰撞。 */
export function toDisplayXY(point: Point2, world: World2): THREE.Vector3 {
  return new THREE.Vector3(point.x - world.width / 2, point.y - world.height / 2, 0);
}

export class BattlefieldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly world: Readonly<World2>;
  private readonly resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  private readonly border: THREE.MeshStandardMaterial;
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLDivElement, snapshot: GameSnapshot) {
    this.world = snapshot.world;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x060c19);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.renderer.domElement.dataset.renderer = 'threejs';
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, -0.8, 45);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0x99cbef, 1.2));
    const key = new THREE.DirectionalLight(0x63c7ff, 2.6);
    key.position.set(-9, 12, 20);
    this.scene.add(key);
    const fill = new THREE.PointLight(0x1ee4c7, 55);
    fill.position.set(this.world.width / 2, -this.world.height / 3, 7);
    this.scene.add(fill);

    const boardGeometry = new THREE.BoxGeometry(this.world.width, this.world.height, 0.6);
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c2136, metalness: 0.48, roughness: 0.44,
    });
    this.resources.push(boardGeometry, boardMaterial);
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.z = -0.42;
    this.scene.add(board);

    const gridVertices: THREE.Vector3[] = [];
    for (let x = 0; x <= this.world.width + 1e-6; x += 2) {
      const px = x - this.world.width / 2;
      gridVertices.push(new THREE.Vector3(px, -this.world.height / 2, 0), new THREE.Vector3(px, this.world.height / 2, 0));
    }
    for (let y = 0; y <= this.world.height + 1e-6; y += 2) {
      const py = y - this.world.height / 2;
      gridVertices.push(new THREE.Vector3(-this.world.width / 2, py, 0), new THREE.Vector3(this.world.width / 2, py, 0));
    }
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridVertices);
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x24536a, transparent: true, opacity: 0.67 });
    this.resources.push(gridGeometry, gridMaterial);
    this.scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

    this.border = new THREE.MeshStandardMaterial({
      color: 0x35bde3, emissive: 0x0b6083, emissiveIntensity: 1.1,
      metalness: 0.38, roughness: 0.3,
    });
    this.resources.push(this.border);
    const thickness = 0.16;
    for (const [width, height, x, y] of [
      [this.world.width + thickness * 2, thickness, 0, -this.world.height / 2],
      [this.world.width + thickness * 2, thickness, 0, this.world.height / 2],
      [thickness, this.world.height, -this.world.width / 2, 0],
      [thickness, this.world.height, this.world.width / 2, 0],
    ]) {
      const geometry = new THREE.BoxGeometry(width, height, 0.44);
      this.resources.push(geometry);
      const edge = new THREE.Mesh(geometry, this.border);
      edge.position.set(x, y, 0.17);
      this.scene.add(edge);
    }

    // 装饰层位于战斗平面后方；不影响二维规则或边界。
    const dots: THREE.Vector3[] = [];
    for (let i = 0; i < 120; i++) {
      const x = Math.sin(i * 127.1) * 438.5453;
      const y = Math.sin(i * 311.7 + 2) * 963.122;
      const px = (x - Math.floor(x) - 0.5) * (this.world.width + 16);
      const py = (y - Math.floor(y) - 0.5) * (this.world.height + 16);
      dots.push(new THREE.Vector3(px, py, -3));
    }
    const dotsGeometry = new THREE.BufferGeometry().setFromPoints(dots);
    const dotsMaterial = new THREE.PointsMaterial({ color: 0x77b3d0, size: 0.11, transparent: true, opacity: 0.7, sizeAttenuation: true });
    this.resources.push(dotsGeometry, dotsMaterial);
    this.scene.add(new THREE.Points(dotsGeometry, dotsMaterial));

    this.host.dataset.worldWidth = String(this.world.width);
    this.host.dataset.worldHeight = String(this.world.height);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host);
    this.resize();
    this.render(snapshot);
  }

  resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const aspect = width / height;
    const viewHeight = Math.max(this.world.height + 4, (this.world.width + 4) / aspect);
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
      throw new Error('战场尺寸只能从游戏状态初始化，不可由渲染器修改');
    }
    this.border.emissiveIntensity = state.phase === 'running' ? 1.5 : 1.0;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
