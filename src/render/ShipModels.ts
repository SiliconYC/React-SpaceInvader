import * as THREE from 'three';
import type { EnemyKind } from '../core/level.ts';

/** 造型素材均为原创参数化网格，单位皆位于 XY 逻辑平面，厚度只占显示用 z。 */
export type GpuResource = THREE.BufferGeometry | THREE.Material;
export interface ShipTemplates {
  readonly player: THREE.Group;
  readonly enemies: Readonly<Record<EnemyKind, THREE.Group>>;
}
/** 在整个 WebGL 会话只构造一次所有几何与材质；各敌机使用共享引用克隆。 */
export function createShipTemplates(resources: GpuResource[]): ShipTemplates {
  const track = <T extends GpuResource>(resource: T): T => { resources.push(resource); return resource; };
  const armor = (color: number, luminous = 0.08) => track(new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: luminous, metalness: .54, roughness: .35,
    flatShading: false,
  }));
  const gleam = (color: number) => track(new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: .95, roughness: .2, metalness: .18,
  }));
  const dark = armor(0x243c56, 0.02);
  const playerMetal = armor(0x6fc8dc, .12);
  const playerRim = armor(0xe8f8fa, .08);
  const playerGlow = gleam(0x37e8fa);
  const scoutMetal = armor(0xf0ae77, .12);
  const scoutGlow = gleam(0xffce92);
  const raiderMetal = armor(0xd97baa, .12);
  const raiderGlow = gleam(0xff8cbd);
  const guardianMetal = armor(0xb5a3e7, .08);
  const guardianGlow = gleam(0xaa9aff);

  function hull(group: THREE.Group, points: number[], depth: number, material: THREE.Material, z = 0): void {
    const shape = new THREE.Shape();
    shape.moveTo(points[0], points[1]);
    for (let i=2; i<points.length; i+=2) shape.lineTo(points[i], points[i+1]);
    shape.closePath();
    const geometry = track(new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: .045, bevelSize: .038,
      bevelSegments: 1, steps: 1, curveSegments: 3,
    }));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    group.add(mesh);
  }
  function box(group: THREE.Group, size: [number,number,number], position: [number,number,number],
               mat: THREE.Material, angle = 0): void {
    const geometry = track(new THREE.BoxGeometry(...size));
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.rotation.z = angle;
    group.add(mesh);
  }
  function dome(group: THREE.Group, radii: [number,number,number], position: [number,number,number],
                mat: THREE.Material): void {
    const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(1, 12, 8)), mat);
    mesh.scale.set(...radii);
    mesh.position.set(...position);
    group.add(mesh);
  }

  // 玩家：细长中央机鼻 + 独立掠翼 + 双引擎喷口；尖端朝上，三维驾驶舱凸出。
  const player = new THREE.Group();
  hull(player, [0,.71,-.17,.29,-.39,.08,-1.17,-.39,-.99,-.62,-.33,-.42,0,-.54,
                .33,-.42,.99,-.62,1.17,-.39,.39,.08,.17,.29], .32, playerMetal);
  hull(player, [0,.58,-.18,.06,-.25,-.42,.25,-.42,.18,.06], .41, playerRim, .19);
  dome(player, [.19,.29,.23], [0,-.05,.62], dark);
  box(player,[.28,.19,.17],[-.47,-.47,.19],playerGlow);
  box(player,[.28,.19,.17],[.47,-.47,.19],playerGlow);

  // 侦察机：尖锐三叉翼、单个探测圆顶，识别轮廓：轻、窄、尖。
  const scout = new THREE.Group();
  hull(scout, [0,-.53,-.25,-.18,-.87,-.41,-.63,.21,-.25,.47,0,.25,
               .25,.47,.63,.21,.87,-.41,.25,-.18], .24, scoutMetal);
  hull(scout, [0,.39,-.15,-.14,.15,-.14], .33, dark, .21);
  dome(scout,[.17,.18,.13],[0,.04,.51],scoutGlow);

  // 袭击机：宽型后掠双翼、两侧突出攻击舱；与 scout 的细尖外形完全不同。
  const raider = new THREE.Group();
  hull(raider, [-.91,.38,-.45,.22,-.27,-.38,0,-.6,.27,-.38,.45,.22,
                .91,.38,.96,-.23,.55,-.48,-.55,-.48,-.96,-.23], .32, raiderMetal);
  box(raider,[.27,.64,.31],[-.65,-.22,.30],dark,-.12);
  box(raider,[.27,.64,.31],[.65,-.22,.30],dark,.12);
  dome(raider,[.28,.20,.18],[0,.07,.54],raiderGlow);

  // 守卫机：宽重装甲六边形、中部高起的堡垒 + 双侧护盾与两个发光侧灯。
  const guardian = new THREE.Group();
  hull(guardian, [-1.02,.43,-1.15,-.18,-.7,-.62,.7,-.62,1.15,-.18,
                  1.02,.43,.48,.68,-.48,.68], .43, guardianMetal);
  hull(guardian, [-.46,.44,-.59,-.18,-.25,-.39,.25,-.39,.59,-.18,.46,.44],
       .31,dark,.44);
  box(guardian,[.23,.71,.32],[-.91,-.08,.51],guardianMetal);
  box(guardian,[.23,.71,.32],[.91,-.08,.51],guardianMetal);
  dome(guardian,[.18,.18,.13],[-.58,.22,.79],guardianGlow);
  dome(guardian,[.18,.18,.13],[.58,.22,.79],guardianGlow);

  for (const [kind, group] of Object.entries({scout,raider,guardian})) {
    group.userData.modelKind=kind;
    group.traverse(node => { if (node instanceof THREE.Mesh) {node.castShadow=false; node.receiveShadow=false;} });
  }
  return { player, enemies: {scout,raider,guardian} };
}
