import * as THREE from 'three';
import {createHullLoft,createWingAirfoil} from './P4PlayerGeometry.ts';
import {P3_COLORS} from './P3Palette.ts';

/**
 * P4/B1 原创敌机的可编辑造型源。每个零件只在模板创建时生成一次。
 * 运行时仍由 BattlefieldRenderer InstancedMesh 批量复制，不改变 XY 命中盒。
 */
type Asset=THREE.BufferGeometry|THREE.Material;
type Track=<T extends Asset>(asset:T)=>T;

function surface(track:Track,color:number,metalness=.16,roughness=.43):THREE.MeshPhysicalMaterial{
  return track(new THREE.MeshPhysicalMaterial({
    color,metalness,roughness,clearcoat:.32,clearcoatRoughness:.31,
  }));
}
function light(track:Track,color:number,glow:number):THREE.MeshPhysicalMaterial{
  return track(new THREE.MeshPhysicalMaterial({
    color,emissive:glow,emissiveIntensity:.48,roughness:.32,
    metalness:.12,clearcoat:.66,clearcoatRoughness:.18,
  }));
}
function install(group:THREE.Group,track:Track,geo:THREE.BufferGeometry,material:THREE.Material,
  name:string,x=0,y=0,z=0):THREE.Mesh{
  const mesh=new THREE.Mesh(track(geo),material);
  mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=false;mesh.receiveShadow=false;
  group.add(mesh);return mesh;
}
/** Beveled structural plates have real edges, not fake painted stripes. */
function plate(group:THREE.Group,track:Track,coords:readonly number[],depth:number,
  mat:THREE.Material,name:string,z:number):THREE.Mesh{
  const shape=new THREE.Shape();
  shape.moveTo(coords[0],coords[1]);
  for(let i=2;i<coords.length;i+=2)shape.lineTo(coords[i],coords[i+1]);
  shape.closePath();
  return install(group,track,new THREE.ExtrudeGeometry(shape,{
    depth,steps:1,bevelEnabled:true,bevelSegments:2,
    bevelSize:.025,bevelThickness:.027,curveSegments:4,
  }),mat,name,0,0,z);
}
function loft(group:THREE.Group,track:Track,stations:Parameters<typeof createHullLoft>[0],
  mat:THREE.Material,name:string,x=0,sides=16):THREE.Mesh{
  return install(group,track,createHullLoft(stations,sides),mat,name,x);
}
function eye(group:THREE.Group,track:Track,mat:THREE.Material,name:string,
  pos:[number,number,number],scale:[number,number,number]):THREE.Mesh{
  const mesh=install(group,track,new THREE.SphereGeometry(1,18,12),mat,name,...pos);
  mesh.scale.set(...scale);return mesh;
}

/**
 * Raider: forward-pointing scarab silhouette; slim pinched fuselage, swept two-piece
 * armored pincers, floating paired gun nacelles and a distinct central red canopy.
 */
export function sculptRaider(track:Track):THREE.Group{
  const g=new THREE.Group();g.name='raider-p4-scarab';
  const shell=surface(track,P3_COLORS.raider);
  const pale=surface(track,0xffc3a1,.10,.46);
  const edge=surface(track,0xb94e5e,.28,.39);
  const graphite=surface(track,0x29394e,.30,.45);
  const lens=surface(track,0x172f49,.20,.30);
  const muzzle=light(track,0xffcc9a,0xff805e);

  loft(g,track,[
    {y:-.64,radiusX:.014,centerZ:.08,radiusZ:.016},
    {y:-.44,radiusX:.18,centerZ:.10,radiusZ:.14},
    {y:-.14,radiusX:.29,centerZ:.12,radiusZ:.20},
    {y:.21,radiusX:.245,centerZ:.13,radiusZ:.18},
    {y:.48,radiusX:.10,centerZ:.12,radiusZ:.085},
  ],shell,'raider-sculpted-chassis');
  loft(g,track,[
    {y:-.46,radiusX:.018,centerZ:.28,radiusZ:.014},
    {y:-.23,radiusX:.105,centerZ:.28,radiusZ:.07},
    {y:.13,radiusX:.11,centerZ:.31,radiusZ:.06},
    {y:.32,radiusX:.016,centerZ:.23,radiusZ:.015},
  ],pale,'raider-nose-armor-spine',0,14);
  // Distinct deep notch between the outer claw wing and the lower forward gun pod.
  const wing=[
    {x:.22,leadingY:.30,trailingY:-.36,z:.09,thickness:.20},
    {x:.53,leadingY:.40,trailingY:-.22,z:.07,thickness:.17},
    {x:.84,leadingY:.19,trailingY:-.27,z:.045,thickness:.105},
    {x:1.04,leadingY:-.21,trailingY:-.48,z:.025,thickness:.046},
  ] as const;
  for(const side of [-1,1] as const){
    install(g,track,createWingAirfoil(wing,side),shell,
      side<0?'raider-left-pincer-airfoil':'raider-right-pincer-airfoil');
    install(g,track,createWingAirfoil([
      {x:.39,leadingY:.30,trailingY:.105,z:.186,thickness:.029},
      {x:.68,leadingY:.22,trailingY:-.015,z:.146,thickness:.023},
      {x:.94,leadingY:-.16,trailingY:-.36,z:.088,thickness:.012},
    ],side),pale,'raider-tapered-wing-ceramic');
    // Guns are clearly separate suspended mechanical pods; they are not square blocks.
    loft(g,track,[
      {y:-.62,radiusX:.072,centerZ:.025,radiusZ:.077},
      {y:-.53,radiusX:.126,centerZ:.045,radiusZ:.13},
      {y:-.19,radiusX:.15,centerZ:.075,radiusZ:.16},
      {y:.17,radiusX:.10,centerZ:.08,radiusZ:.10},
    ],graphite,'raider-independent-weapon-pod',side*.67,14);
    loft(g,track,[
      {y:-.67,radiusX:.086,centerZ:.042,radiusZ:.080},
      {y:-.62,radiusX:.092,centerZ:.045,radiusZ:.093},
      {y:-.575,radiusX:.07,centerZ:.045,radiusZ:.07},
    ],pale,'raider-weapon-muzzle-bezel',side*.67,12);
    eye(g,track,muzzle,'raider-muzzle-emitter',[side*.67,-.665,.044],[.060,.045,.059]);
    eye(g,track,edge,'raider-armored-wing-joint',[side*.39,.13,.215],[.16,.18,.085]);
  }
  eye(g,track,graphite,'raider-canopy-recess',[0,-.045,.330],[.225,.28,.092]);
  eye(g,track,lens,'raider-dark-optical-canopy',[0,-.085,.389],[.171,.214,.104]);
  eye(g,track,muzzle,'raider-small-weapon-targeting-sensor',[0,-.18,.483],[.062,.080,.030]);
  g.userData.geometrySource='src/render/P4EnemyGeometry.ts#sculptRaider';
  return g;
}

/**
 * Guardian: shield/fortress rather than swept fighter. Strong lateral shoulders,
 * a stepped real-thickness frontal armor glacis and a recessed raised energy lens.
 */
export function sculptGuardian(track:Track):THREE.Group{
  const g=new THREE.Group();g.name='guardian-p4-fortress';
  const body=surface(track,P3_COLORS.guardian,.20,.42);
  const polished=surface(track,0xb7b3e0,.11,.39);
  const shadow=surface(track,0x4b4d85,.23,.51);
  const steel=surface(track,0x34475f,.36,.47);
  const energy=light(track,0x9de6fa,0x5ccef2);
  // Widened structural shield body is visibly much deeper than Raider.
  plate(g,track,[
    -.52,.67,-1.11,.42,-1.14,-.20,-.95,-.47,-.48,-.61,
    0,-.66,.48,-.61,.95,-.47,1.14,-.20,1.11,.42,.52,.67,
  ],.45,body,'guardian-monolithic-shield',-.20);
  plate(g,track,[
    -.49,.45,-.65,.19,-.62,-.32,-.38,-.44,
    0,-.53,.38,-.44,.62,-.32,.65,.19,.49,.45,
  ],.16,polished,'guardian-stepped-inner-armor',.28);
  for(const side of [-1,1] as const){
    plate(g,track,[
      side*.60,.51,side*1.12,.34,side*1.14,-.11,
      side*1.0,-.34,side*.78,-.41,side*.57,-.12,
    ],.19,shadow,'guardian-sculpted-shoulder',.23);
    plate(g,track,[
      side*.69,.39,side*1.04,.28,side*1.04,-.06,
      side*.91,-.23,side*.71,-.14,
    ],.12,polished,'guardian-raised-shoulder-chevron',.47);
    loft(g,track,[
      {y:-.53,radiusX:.045,centerZ:.18,radiusZ:.055},
      {y:-.39,radiusX:.13,centerZ:.23,radiusZ:.14},
      {y:.13,radiusX:.14,centerZ:.22,radiusZ:.15},
      {y:.37,radiusX:.055,centerZ:.20,radiusZ:.065},
    ],steel,'guardian-paired-shield-pylon',side*.88,12);
    eye(g,track,energy,'guardian-pylon-status-lamp',[side*.90,-.34,.40],[.080,.095,.052]);
  }
  // Framed energy module appears inset into a real thick armor housing.
  eye(g,track,steel,'guardian-energy-recess',[0,-.01,.485],[.402,.408,.17]);
  eye(g,track,polished,'guardian-raised-metal-bezel',[0,-.015,.560],[.315,.315,.125]);
  eye(g,track,shadow,'guardian-core-dark-aperture',[0,-.03,.625],[.258,.258,.089]);
  eye(g,track,energy,'guardian-three-dimensional-energy-lens',[0,-.045,.681],[.197,.194,.125]);
  eye(g,track,polished,'guardian-lens-specular-pin',[-.065,.015,.795],[.045,.054,.022]);
  plate(g,track,[-.29,-.43,0,-.57,.29,-.43,.19,-.35,-.19,-.35],
    .105,shadow,'guardian-lower-shield-keel',.36);
  g.userData.geometrySource='src/render/P4EnemyGeometry.ts#sculptGuardian';
  return g;
}
