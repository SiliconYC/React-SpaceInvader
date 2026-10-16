import * as THREE from 'three';
import type { GameSnapshot } from '../core/engine.ts';
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
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    for (const resource of this.resources) resource.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
