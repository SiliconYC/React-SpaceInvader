import * as THREE from 'three';
import type { EnemyKind } from '../core/level.ts';
import { P3_COLORS, P3_LIGHTING } from './P3Palette.ts';

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
    color, emissive: color, emissiveIntensity: luminous, metalness: P3_LIGHTING.armorMetalness, roughness: P3_LIGHTING.armorRoughness,
    flatShading: true,
  }));
  const gleam = (color: number) => track(new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: P3_LIGHTING.emissiveAccent, roughness: .35, metalness: .06,
  }));
  const dark = armor(0x243c56, 0.02);
  const scoutMetal = armor(P3_COLORS.scout, .08);
  const scoutGlow = gleam(0xffce92);
  const raiderMetal = armor(P3_COLORS.raider, .08);
  const raiderGlow = gleam(0xffb7a7);
  const guardianMetal = armor(P3_COLORS.guardian, .08);
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

  // P3/B1: 源码即正式模型资产。真实体积来自挤出翼板、多个低面数椭球和双推进舱，
  // 没有平面图片或外部 GLB。轮廓以约 2.34 × 1.43 单位落在原 2.5 × 1.4 的 XY hitbox 附近。
  const player = new THREE.Group();
  player.name='q-player-pivot';
  const ceramic = track(new THREE.MeshStandardMaterial({
    color:P3_COLORS.ceramic,metalness:.12,roughness:.62,flatShading:true,
  }));
  const blue = track(new THREE.MeshStandardMaterial({
    color:P3_COLORS.playerBlue,metalness:.14,roughness:.58,flatShading:true,
  }));
  const deepBlue = track(new THREE.MeshStandardMaterial({
    color:P3_COLORS.playerDeep,metalness:.2,roughness:.53,flatShading:true,
  }));
  const glass = track(new THREE.MeshStandardMaterial({
    color:P3_COLORS.canopy,metalness:.18,roughness:.28,flatShading:true,
  }));
  const thruster = track(new THREE.MeshStandardMaterial({
    color:P3_COLORS.thrust,emissive:P3_COLORS.thrust,emissiveIntensity:.92,metalness:0,roughness:.42,
  }));
  // 实体宽翼：双侧以不同受光面构成厚度，翼尖圆角靠离散倒角而非复杂贴图。
  hull(player,[
    0,.68,-.22,.29,-.43,.13,-1.13,-.30,-1.17,-.45,-.72,-.42,
    -.41,-.61,0,-.57,.41,-.61,.72,-.42,1.17,-.45,1.13,-.30,.43,.13,.22,.29,
  ],.23,ceramic,-.09);
  for(const side of [-1,1]){
    hull(player,[
      side*.37,.11,side*.61,-.01,side*1.05,-.32,side*1.08,-.39,
      side*.75,-.35,side*.42,-.25,
    ],.055,blue,.17);
    // 可辨认的外缘翼鳍、后掠双色装甲和两个分离的发动机。
    box(player,[.075,.27,.18],[side*1.01,-.34,.17],deepBlue,side*.15);
    dome(player,[.18,.37,.19],[side*.43,-.34,.14],ceramic);
    dome(player,[.14,.24,.14],[side*.43,-.50,.08],deepBlue);
    dome(player,[.115,.10,.12],[side*.43,-.61,.12],thruster);
    box(player,[.15,.06,.05],[side*.43,-.57,.28],blue);
  }
  // 大体量鼓起的机背与奶白色鼻锥；座舱明显高于翼板，旋转可观察厚度。
  dome(player,[.30,.57,.25],[0,.02,.28],ceramic);
  dome(player,[.19,.35,.17],[0,.07,.49],glass);
  dome(player,[.12,.13,.08],[0,.25,.60],blue);
  hull(player,[0,.73,-.16,.35,-.18,-.11,0,-.24,.18,-.11,.16,.35],
    .12,ceramic,.39);
  box(player,[.15,.21,.07],[0,-.39,.38],blue);
  player.userData.modelKind='player';
  player.userData.assetSource='src/render/ShipModels.ts#q-player-pivot';
  player.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=false;node.receiveShadow=false;}});

  // P3/B2: 三种原创 Q 版敌机均为可编辑真 3D Mesh，实例化仍按部件而非敌机分配。
  // 侦察机：纤长三叉/燕翼，单中央凸眼和高背甲壳。宽约 1.72 单位。
  const scout = new THREE.Group();
  const scoutPale=armor(P3_COLORS.scoutTrim,.04);
  hull(scout,[0,-.54,-.24,-.27,-.83,-.38,-.68,.06,-.32,.37,
    0,.28,.32,.37,.68,.06,.83,-.38,.24,-.27],.29,scoutMetal,-.07);
  for(const side of [-1,1]){
    hull(scout,[side*.20,-.21,side*.36,.23,side*.72,.03,
      side*.66,-.07,side*.39,-.26],.085,scoutPale,.19);
    box(scout,[.10,.23,.14],[side*.72,-.25,.23],scoutMetal,side*.16);
  }
  dome(scout,[.25,.34,.24],[0,-.06,.27],scoutMetal);
  dome(scout,[.17,.18,.18],[0,-.12,.47],dark);
  dome(scout,[.095,.10,.10],[0,-.14,.60],scoutGlow);
  box(scout,[.13,.08,.09],[0,.27,.32],scoutPale);

  // 袭击机：更宽的双钳翼、相互分离的炮舱和下压机鼻，明显不是 Scout 换色。
  const raider = new THREE.Group();
  const raiderPale=armor(P3_COLORS.raiderTrim,.04);
  hull(raider,[-.91,.36,-.48,.30,-.31,-.33,0,-.57,.31,-.33,
    .48,.30,.91,.36,1.05,-.23,.75,-.43,.35,-.41,0,-.58,
    -.35,-.41,-.75,-.43,-1.05,-.23],.34,raiderMetal,-.08);
  for(const side of [-1,1]){
    hull(raider,[side*.48,.23,side*.88,.23,side*.94,-.15,
      side*.70,-.31,side*.47,-.23],.10,raiderPale,.23);
    box(raider,[.25,.51,.32],[side*.72,-.20,.30],dark,side*.12);
    box(raider,[.14,.34,.20],[side*.72,-.43,.32],raiderMetal);
    dome(raider,[.12,.14,.095],[side*.72,-.59,.38],raiderGlow);
  }
  dome(raider,[.34,.44,.25],[0,-.02,.35],raiderMetal);
  dome(raider,[.22,.28,.20],[0,-.01,.57],dark);
  box(raider,[.23,.09,.10],[0,-.49,.36],raiderPale);

  // 守卫机：宽重盾形装甲、双侧厚护肩和高起的发光能量核心。
  const guardian = new THREE.Group();
  const guardianPale=armor(P3_COLORS.guardianTrim,.04);
  const guardianShadow=armor(0x655a9c,.02);
  const core = gleam(0x79e4ef);
  hull(guardian,[-1.07,.43,-1.17,-.12,-1.03,-.44,-.55,-.59,
    0,-.60,.55,-.59,1.03,-.44,1.17,-.12,1.07,.43,.57,.68,-.57,.68],
    .46,guardianMetal,-.10);
  for(const side of [-1,1]){
    hull(guardian,[side*.56,.54,side*1.05,.30,side*1.06,-.30,
      side*.75,-.42,side*.55,-.15],.16,guardianShadow,.38);
    hull(guardian,[side*.62,.40,side*.92,.26,side*.89,-.13,
      side*.61,-.19],.10,guardianPale,.57);
    box(guardian,[.19,.40,.28],[side*.84,-.18,.49],guardianMetal);
    dome(guardian,[.11,.14,.10],[side*.87,-.34,.65],guardianGlow);
  }
  hull(guardian,[-.41,.44,-.48,-.29,0,-.44,.48,-.29,.41,.44],
    .24,guardianPale,.44);
  dome(guardian,[.38,.37,.26],[0,.06,.66],guardianShadow);
  dome(guardian,[.25,.25,.23],[0,.02,.83],core);
  dome(guardian,[.13,.13,.105],[-.04,.08,1.03],guardianPale);

  for (const [kind, group] of Object.entries({scout,raider,guardian})) {
    group.userData.modelKind=kind;
    group.userData.assetSource='src/render/ShipModels.ts#'+kind;
    group.traverse(node => { if (node instanceof THREE.Mesh) {node.castShadow=false; node.receiveShadow=false;} });
  }
  return { player, enemies: {scout,raider,guardian} };
}
