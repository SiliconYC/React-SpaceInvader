import * as THREE from 'three';
import type { EnemyKind } from '../core/level.ts';
import { P3_COLORS, P3_LIGHTING } from './P3Palette.ts';
import { createHullLoft, createWingAirfoil } from './P4PlayerGeometry.ts';

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

  // P4/A2: original parametric, closed airfoil surfaces, not an assembly of rectangular blocks.
  // Wing span 2.36 (< 2.5 rule hitbox width); the engine's coordinate root remains at (0,0).
  const player=new THREE.Group();
  player.name='q-player-pivot';
  const ceramic=track(new THREE.MeshPhysicalMaterial({
    color:0xf0f6ef,roughness:.42,metalness:.06,clearcoat:.32,clearcoatRoughness:.4,
  }));
  const blue=track(new THREE.MeshStandardMaterial({
    color:0x4daed1,roughness:.42,metalness:.13,side:THREE.DoubleSide,
  }));
  const deepBlue=track(new THREE.MeshStandardMaterial({
    color:0x265c80,roughness:.5,metalness:.19,side:THREE.DoubleSide,
  }));
  const glass=track(new THREE.MeshPhysicalMaterial({
    color:0x133a58,roughness:.14,metalness:.19,clearcoat:1,clearcoatRoughness:.1,
    emissive:0x0b3554,emissiveIntensity:.08,
  }));
  const metal=track(new THREE.MeshStandardMaterial({
    color:0x7d9bac,roughness:.35,metalness:.58,
  }));
  const engineLight=track(new THREE.MeshStandardMaterial({
    color:0x8ffcf2,emissive:0x33d6d1,emissiveIntensity:.88,
    roughness:.32,metalness:0,
  }));
  const place=(geometry:THREE.BufferGeometry,material:THREE.Material,
    name:string,x=0,y=0,z=0):THREE.Mesh=>{
    const part=new THREE.Mesh(track(geometry),material);
    part.name=name;part.position.set(x,y,z);player.add(part);return part;
  };
  // One sculpted structural body forms the real nose, shoulder, belly and tapered tail.
  place(createHullLoft([
    {y:-.68,radiusX:.12,centerZ:.07,radiusZ:.11},
    {y:-.46,radiusX:.28,centerZ:.11,radiusZ:.18},
    {y:-.13,radiusX:.32,centerZ:.14,radiusZ:.24},
    {y:.28,radiusX:.235,centerZ:.17,radiusZ:.20},
    {y:.59,radiusX:.105,centerZ:.16,radiusZ:.10},
    {y:.75,radiusX:.012,centerZ:.13,radiusZ:.018},
  ],20),ceramic,'continuous-ceramic-fuselage');
  // Wing cross sections have 6 bevel-edge vertices and top/bottom surfaces.
  const wingStations=[
    {x:.24,leadingY:.28,trailingY:-.42,z:.11,thickness:.17},
    {x:.51,leadingY:.10,trailingY:-.48,z:.08,thickness:.15},
    {x:.89,leadingY:-.16,trailingY:-.43,z:.04,thickness:.095},
    {x:1.17,leadingY:-.29,trailingY:-.40,z:.06,thickness:.045},
  ] as const;
  for(const side of [-1,1] as const){
    place(createWingAirfoil(wingStations,side),ceramic,
      side<0?'left-main-airfoil':'right-main-airfoil');
    // One deliberate blue inset, not a scatter of decorative machine blocks.
    place(createWingAirfoil([
      {x:.38,leadingY:.04,trailingY:-.17,z:.205,thickness:.025},
      {x:.78,leadingY:-.19,trailingY:-.31,z:.145,thickness:.023},
      {x:1.10,leadingY:-.31,trailingY:-.365,z:.109,thickness:.014},
    ],side),blue,side<0?'left-swept-inlay':'right-swept-inlay');
    const nacelle=place(createHullLoft([
      {y:-.70,radiusX:.085,centerZ:.105,radiusZ:.105},
      {y:-.58,radiusX:.16,centerZ:.12,radiusZ:.14},
      {y:-.23,radiusX:.17,centerZ:.135,radiusZ:.17},
      {y:.035,radiusX:.09,centerZ:.16,radiusZ:.11},
    ],14),deepBlue,'engine-pod',side*.45);
    nacelle.userData.engineSide=side;
    place(createHullLoft([
      {y:-.715,radiusX:.105,centerZ:.125,radiusZ:.103},
      {y:-.685,radiusX:.143,centerZ:.125,radiusZ:.135},
      {y:-.638,radiusX:.13,centerZ:.125,radiusZ:.12},
    ],14),metal,'rear-nozzle-rim',side*.45);
    const glow=new THREE.Mesh(track(new THREE.SphereGeometry(1,16,10)),engineLight);
    glow.name='engine-core';glow.scale.set(.105,.06,.09);
    glow.position.set(side*.45,-.702,.13);player.add(glow);
    const cheek=new THREE.Mesh(track(new THREE.SphereGeometry(1,12,10)),blue);
    cheek.name='wing-root-cheek';cheek.scale.set(.16,.31,.09);
    cheek.position.set(side*.29,-.19,.32);player.add(cheek);
  }
  const canopyFrame=new THREE.Mesh(track(new THREE.SphereGeometry(1,24,14)),deepBlue);
  canopyFrame.name='raised-canopy-gasket';
  canopyFrame.scale.set(.23,.37,.157);canopyFrame.position.set(0,.115,.375);
  player.add(canopyFrame);
  const canopy=new THREE.Mesh(track(new THREE.SphereGeometry(1,28,16)),glass);
  canopy.name='single-polished-raised-canopy';
  canopy.scale.set(.187,.317,.166);canopy.position.set(0,.13,.431);
  player.add(canopy);
  // Nose ridge and rear undertray keep a clean readable three-tone hierarchy.
  place(createHullLoft([
    {y:.29,radiusX:.105,centerZ:.336,radiusZ:.028},
    {y:.51,radiusX:.063,centerZ:.285,radiusZ:.034},
    {y:.73,radiusX:.008,centerZ:.168,radiusZ:.015},
  ],10),blue,'nose-spine');
  place(createHullLoft([
    {y:-.62,radiusX:.19,centerZ:-.09,radiusZ:.03},
    {y:-.40,radiusX:.23,centerZ:-.105,radiusZ:.045},
    {y:-.16,radiusX:.20,centerZ:-.10,radiusZ:.035},
  ],10),deepBlue,'undertray');
  // The single beveled extrusion is a structural tail plate, not the primary hull.
  hull(player,[-.22,-.40,-.15,-.60,0,-.54,.15,-.60,.22,-.40],
    .065,blue,.12);
  player.userData.modelKind='player';
  player.userData.assetSource='src/render/ShipModels.ts#q-player-pivot';
  player.userData.geometrySource='src/render/P4PlayerGeometry.ts';
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
