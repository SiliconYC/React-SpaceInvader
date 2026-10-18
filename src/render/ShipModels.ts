import * as THREE from 'three';
import type { EnemyKind } from '../core/level.ts';
import { createHullLoft, createWingAirfoil } from './P4PlayerGeometry.ts';
import { P3_COLORS } from './P3Palette.ts';

/**
 * #101: 小镇玩具美术语言移植到实时弹幕游戏。
 * 大形先行：胶囊船体 / 软圆短翼 / 独眼侦察员 / 双炮红甲 / 紫色厚盾。
 * 所有部件是真实三维体积；单位的 XY 根节点及碰撞数据不变。
 * 逐型号仅制作一份几何与材质；由渲染器 InstancedMesh 共享。
 */
export type GpuResource=THREE.BufferGeometry | THREE.Material;
export interface ShipTemplates {
  readonly player:THREE.Group;
  readonly enemies:Readonly<Record<EnemyKind,THREE.Group>>;
}
type Track=<T extends GpuResource>(value:T)=>T;

function finish(track:Track,color:number,roughness=.57,metalness=.03):THREE.MeshPhysicalMaterial {
  return track(new THREE.MeshPhysicalMaterial({
    color,roughness,metalness,clearcoat:.22,clearcoatRoughness:.46,
  }));
}
function enamel(track:Track,color:number):THREE.MeshPhysicalMaterial {
  return track(new THREE.MeshPhysicalMaterial({
    color,roughness:.30,metalness:.07,clearcoat:.84,clearcoatRoughness:.16,
  }));
}
function shine(track:Track,color:number,emissive:number):THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({
    color,roughness:.42,metalness:.02,emissive,emissiveIntensity:.52,
  }));
}
function part(g:THREE.Group,track:Track,geometry:THREE.BufferGeometry,
  mat:THREE.Material,name:string,x=0,y=0,z=0):THREE.Mesh {
  const mesh=new THREE.Mesh(track(geometry),mat);
  mesh.name=name;
  mesh.position.set(x,y,z);
  mesh.castShadow=false;mesh.receiveShadow=false;
  g.add(mesh);
  return mesh;
}
function pebble(g:THREE.Group,track:Track,mat:THREE.Material,name:string,
  xyz:[number,number,number],radii:[number,number,number],segments=24):THREE.Mesh {
  const mesh=part(g,track,new THREE.SphereGeometry(1,segments,16),mat,name,...xyz);
  mesh.scale.set(...radii);
  return mesh;
}
function hull(g:THREE.Group,track:Track,mat:THREE.Material,name:string,
  stations:Parameters<typeof createHullLoft>[0],x=0):THREE.Mesh {
  return part(g,track,createHullLoft(stations,24),mat,name,x);
}
function airfoil(g:THREE.Group,track:Track,mat:THREE.Material,
  name:string,stations:Parameters<typeof createWingAirfoil>[0],side:-1|1):THREE.Mesh {
  return part(g,track,createWingAirfoil(stations,side),mat,name);
}
function inset(g:THREE.Group,track:Track,mat:THREE.Material,name:string,
  outline:number[],z:number,depth=.07):THREE.Mesh {
  const shape=new THREE.Shape();
  shape.moveTo(outline[0],outline[1]);
  for(let i=2;i<outline.length;i+=2)shape.lineTo(outline[i],outline[i+1]);
  shape.closePath();
  return part(g,track,new THREE.ExtrudeGeometry(shape,{
    depth,steps:1,bevelEnabled:true,bevelSize:.045,bevelThickness:.04,bevelSegments:3,
  }),mat,name,0,0,z);
}
function seal(group:THREE.Group,kind:string,source:string):THREE.Group {
  group.userData.modelKind=kind;
  group.userData.assetSource='src/render/ShipModels.ts#'+source;
  group.userData.geometrySource='src/render/P4PlayerGeometry.ts';
  return group;
}

/** 玩家：类似小镇吉祥物，统一陶瓷主体、圆肩短翼和占视觉主导的座舱。 */
function makePlayer(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='q-player-pivot';
  const ivory=finish(track,P3_COLORS.ceramic,.48);
  const mint=finish(track,0x76d9db,.45);
  const teal=finish(track,0x238fa7,.51);
  const navy=finish(track,0x263f6a,.58);
  const visor=enamel(track,0x276c96);
  const beam=shine(track,0xc9fff1,0x55e5d7);

  // A rounded, inflated integral chassis. Its width and overall 2.4 wing span
  // continue to sit inside the original 2.5-unit player collision silhouette.
  hull(g,track,ivory,'continuous-ceramic-fuselage',[
    {y:-.70,radiusX:.09,centerZ:.10,radiusZ:.08},
    {y:-.52,radiusX:.34,centerZ:.11,radiusZ:.23},
    {y:-.23,radiusX:.43,centerZ:.13,radiusZ:.30},
    {y:.12,radiusX:.41,centerZ:.15,radiusZ:.32},
    {y:.43,radiusX:.26,centerZ:.17,radiusZ:.23},
    {y:.67,radiusX:.09,centerZ:.15,radiusZ:.10},
    {y:.75,radiusX:.012,centerZ:.13,radiusZ:.015},
  ]);
  const mainWing=[
    {x:.31,leadingY:.26,trailingY:-.46,z:.13,thickness:.23},
    {x:.66,leadingY:.15,trailingY:-.45,z:.11,thickness:.22},
    {x:.98,leadingY:-.10,trailingY:-.39,z:.09,thickness:.15},
    {x:1.17,leadingY:-.21,trailingY:-.37,z:.07,thickness:.06},
  ] as const;
  for(const side of [-1,1] as const) {
    airfoil(g,track,ivory,side<0?'left-main-airfoil':'right-main-airfoil',mainWing,side);
    airfoil(g,track,mint,side<0?'left-toy-wing-inlay':'right-toy-wing-inlay',[
      {x:.47,leadingY:.16,trailingY:-.04,z:.264,thickness:.025},
      {x:.77,leadingY:-.045,trailingY:-.23,z:.23,thickness:.022},
      {x:1.09,leadingY:-.20,trailingY:-.31,z:.161,thickness:.014},
    ],side);
    pebble(g,track,mint,'wing-root-cheek',[side*.40,-.09,.38],[.22,.34,.13]);
    hull(g,track,teal,'engine-pod',[
      {y:-.76,radiusX:.09,centerZ:.18,radiusZ:.09},
      {y:-.67,radiusX:.18,centerZ:.18,radiusZ:.18},
      {y:-.38,radiusX:.21,centerZ:.18,radiusZ:.20},
      {y:-.08,radiusX:.18,centerZ:.18,radiusZ:.17},
      {y:.07,radiusX:.07,centerZ:.18,radiusZ:.08},
    ],side*.64);
    pebble(g,track,navy,'rear-nozzle-rim',[side*.64,-.735,.19],[.155,.085,.16]);
    pebble(g,track,beam,'engine-core',[side*.64,-.79,.19],[.105,.065,.105]);
    pebble(g,track,ivory,'engine-shoulder',[side*.64,-.14,.24],[.17,.19,.15]);
  }
  // Seat frame and a broad, single, reflective canopy replace tiny hard-sci-fi hardware.
  pebble(g,track,navy,'raised-canopy-gasket',[0,.14,.43],[.345,.425,.17]);
  pebble(g,track,visor,'single-polished-raised-canopy',[0,.16,.53],[.29,.36,.21],32);
  pebble(g,track,mint,'canopy-catchlight',[-.10,.29,.725],[.07,.12,.027]);
  pebble(g,track,ivory,'forehead-ceramic',[0,.59,.32],[.19,.15,.12]);
  // A structural extruded tail, necessary for stable XY-scale silhouette.
  inset(g,track,teal,'single-chamfered-tail-plate',
    [-.28,-.39,-.22,-.57,0,-.61,.22,-.57,.28,-.39],-.02,.08);
  return seal(g,'player','q-player-pivot');
}

/** Scout: oversized single eye framed by a warm cream face; a friendly one-piece flying bean. */
function makeScout(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='scout-toy-bean';
  const orange=finish(track,P3_COLORS.scout,.55);
  const cream=finish(track,0xffecc6,.64);
  const brown=finish(track,0xb9694c,.65);
  const dark=enamel(track,0x263f56);
  const gold=shine(track,0xffe3a9,0xffb955);

  hull(g,track,orange,'scout-continuous-orange-shell',[
    {y:-.51,radiusX:.08,centerZ:.18,radiusZ:.09},
    {y:-.35,radiusX:.34,centerZ:.18,radiusZ:.21},
    {y:-.10,radiusX:.43,centerZ:.20,radiusZ:.23},
    {y:.17,radiusX:.38,centerZ:.20,radiusZ:.23},
    {y:.39,radiusX:.22,centerZ:.18,radiusZ:.16},
    {y:.47,radiusX:.04,centerZ:.16,radiusZ:.04},
  ]);
  for(const side of [-1,1] as const){
    airfoil(g,track,orange,side<0?'scout-port-airfoil':'scout-starboard-airfoil',[
      {x:.34,leadingY:.24,trailingY:-.29,z:.15,thickness:.24},
      {x:.61,leadingY:.24,trailingY:-.24,z:.12,thickness:.17},
      {x:.83,leadingY:.08,trailingY:-.24,z:.09,thickness:.11},
      {x:.99,leadingY:-.015,trailingY:-.17,z:.08,thickness:.055},
    ],side);
    pebble(g,track,cream,'scout-sugar-wingpad',[side*.65,.04,.235],[.23,.17,.095]);
    pebble(g,track,brown,'scout-rear-jet-housing',[side*.42,.37,.20],[.14,.13,.16]);
    pebble(g,track,gold,'scout-exhaust',[side*.42,.43,.24],[.075,.06,.08]);
  }
  // Almost half of the face is ONE eye; recognisable at 22 CSS pixels.
  pebble(g,track,cream,'scout-creamy-eye-surround',[0,-.105,.39],[.345,.32,.155],32);
  pebble(g,track,brown,'scout-optical-gasket',[0,-.12,.49],[.293,.275,.105]);
  pebble(g,track,dark,'scout-main-single-optic',[0,-.13,.56],[.255,.235,.16],32);
  pebble(g,track,gold,'scout-eye-catchlight',[-.092,-.045,.708],[.077,.07,.023]);
  pebble(g,track,cream,'scout-upper-brow',[0,.31,.345],[.27,.115,.10]);
  inset(g,track,cream,'scout-small-belly-keel',[-.18,-.35,0,-.53,.18,-.35],.24,.04);
  return seal(g,'scout','scout');
}

/** Raider: twin round cherry-red crab claws and two distinct large cannons. */
function makeRaider(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='raider-cherry-crab';
  const coral=finish(track,P3_COLORS.raider,.55);
  const pink=finish(track,0xffb0a0,.60);
  const dark=finish(track,0x623f66,.60);
  const lens=enamel(track,0x274463);
  const energy=shine(track,0xffd2a1,0xff8c6a);
  hull(g,track,coral,'raider-sculpted-chassis',[
    {y:-.62,radiusX:.06,centerZ:.16,radiusZ:.08},
    {y:-.37,radiusX:.27,centerZ:.17,radiusZ:.20},
    {y:-.04,radiusX:.36,centerZ:.19,radiusZ:.24},
    {y:.25,radiusX:.30,centerZ:.20,radiusZ:.23},
    {y:.49,radiusX:.12,centerZ:.18,radiusZ:.10},
  ]);
  for(const side of [-1,1] as const){
    airfoil(g,track,coral,side<0?'raider-left-pincer-airfoil':'raider-right-pincer-airfoil',[
      {x:.28,leadingY:.37,trailingY:-.37,z:.16,thickness:.23},
      {x:.57,leadingY:.43,trailingY:-.25,z:.15,thickness:.20},
      {x:.90,leadingY:.34,trailingY:-.27,z:.12,thickness:.15},
      {x:1.06,leadingY:.14,trailingY:-.22,z:.10,thickness:.09},
    ],side);
    pebble(g,track,pink,'raider-round-pincer-shoulder',[side*.61,.29,.28],[.26,.22,.13]);
    pebble(g,track,dark,'raider-independent-weapon-pod',[side*.76,-.29,.20],[.215,.35,.205]);
    pebble(g,track,pink,'raider-muzzle-housing',[side*.76,-.56,.22],[.16,.12,.16]);
    pebble(g,track,energy,'raider-muzzle-emitter',[side*.76,-.625,.25],[.095,.073,.10]);
    pebble(g,track,coral,'raider-swept-wingtip',[side*.98,.11,.20],[.10,.20,.13]);
  }
  pebble(g,track,dark,'raider-canopy-recess',[0,-.07,.42],[.27,.32,.17]);
  pebble(g,track,lens,'raider-dark-optical-canopy',[0,-.06,.52],[.224,.25,.15]);
  pebble(g,track,pink,'raider-visor-shine',[-.075,.055,.66],[.065,.085,.025]);
  return seal(g,'raider','raider');
}

/** Guardian: bulky shield-like lavender marshmallow armor and an inset turquoise eye. */
function makeGuardian(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='guardian-lavender-shield';
  const violet=finish(track,P3_COLORS.guardian,.62);
  const lilac=finish(track,0xe0d5ff,.61);
  const indigo=finish(track,0x585581,.58);
  const lens=enamel(track,0x315f89);
  const pulse=shine(track,0xc5ffea,0x68e3dc);
  // Deep solid three-dimensional shell: depth deliberately exceeds Raider.
  hull(g,track,violet,'guardian-deep-monocoque',[
    {y:-.71,radiusX:.10,centerZ:.13,radiusZ:.12},
    {y:-.57,radiusX:.48,centerZ:.17,radiusZ:.32},
    {y:-.25,radiusX:.76,centerZ:.20,radiusZ:.41},
    {y:.17,radiusX:.76,centerZ:.21,radiusZ:.40},
    {y:.54,radiusX:.45,centerZ:.19,radiusZ:.27},
    {y:.70,radiusX:.10,centerZ:.17,radiusZ:.10},
  ]);
  for(const side of [-1,1] as const) {
    pebble(g,track,violet,'guardian-big-shoulder',[side*.83,.13,.27],[.32,.50,.32]);
    pebble(g,track,lilac,'guardian-soft-shoulder-plate',[side*.90,.20,.49],[.23,.33,.15]);
    pebble(g,track,indigo,'guardian-shield-pylon',[side*.84,-.42,.25],[.16,.23,.20]);
    pebble(g,track,pulse,'guardian-side-indicator',[side*.82,-.51,.43],[.085,.085,.055]);
  }
  pebble(g,track,lilac,'guardian-raised-breastplate',[0,.22,.48],[.57,.37,.19]);
  pebble(g,track,indigo,'guardian-dark-core-recess',[0,-.13,.56],[.39,.38,.18]);
  pebble(g,track,lilac,'guardian-core-ceramic-ring',[0,-.13,.64],[.33,.33,.13]);
  pebble(g,track,lens,'guardian-dark-optic',[0,-.13,.73],[.27,.26,.14]);
  pebble(g,track,pulse,'guardian-three-dimensional-energy-lens',[0,-.17,.82],[.19,.18,.10]);
  pebble(g,track,lilac,'guardian-brow-glint',[-.10,.03,.84],[.075,.04,.018]);
  inset(g,track,indigo,'guardian-lower-keel',[-.32,-.45,0,-.70,.32,-.45],.30,.10);
  return seal(g,'guardian','guardian');
}

export function createShipTemplates(resources:GpuResource[]):ShipTemplates {
  const track:Track=<T extends GpuResource>(value:T):T=>{resources.push(value);return value;};
  const player=makePlayer(track);
  const scout=makeScout(track);
  const raider=makeRaider(track);
  const guardian=makeGuardian(track);
  return {player,enemies:{scout,raider,guardian}};
}
