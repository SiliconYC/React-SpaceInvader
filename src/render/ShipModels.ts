import * as THREE from 'three';
import { createHullLoft } from './P4PlayerGeometry.ts';
import { P3_COLORS } from './P3Palette.ts';
import { SHIP_OCCLUSION } from './ShipOcclusion.ts';

/** Editable original toy sculpts. XY roots stay authoritative; every surface,
 * bevel, eye socket and engine bell below is a real lit three-dimensional mesh. */
export type GpuResource=THREE.BufferGeometry | THREE.Material;
export interface ShipTemplates {
  readonly player:THREE.Group;
  readonly enemies:Readonly<Record<'scout'|'raider'|'guardian',THREE.Group>>;
}
type Track=<T extends GpuResource>(value:T)=>T;
type XYZ=[number,number,number];
function plastic(track:Track,color:number,roughness=.48):THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({color,roughness,metalness:.02,
    vertexColors:true,envMapIntensity:.55}));
}
function glass(track:Track,color:number):THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.22,
    vertexColors:true,envMapIntensity:1.2}));
}
function luminous(track:Track,color:number):THREE.MeshStandardMaterial {
  return track(new THREE.MeshStandardMaterial({color,roughness:.38,
    vertexColors:true,emissive:color,emissiveIntensity:.42}));
}
function mesh(g:THREE.Group,track:Track,geometry:THREE.BufferGeometry,material:THREE.Material,
  name:string,position:XYZ=[0,0,0]):THREE.Mesh {
  const m=new THREE.Mesh(track(geometry),material);m.name=name;
  m.position.set(...position);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function egg(g:THREE.Group,track:Track,mat:THREE.Material,name:string,pos:XYZ,r:XYZ):THREE.Mesh {
  const m=mesh(g,track,new THREE.SphereGeometry(1,24,16),mat,name,pos);m.scale.set(...r);return m;
}
/** A rounded planform with an actual deep side wall. Broad bevels survive at
 * normal battle scale; the top is cambered rather than a flat polygon decal. */
function plate(g:THREE.Group,track:Track,mat:THREE.Material,name:string,
  points:readonly (readonly [number,number])[],depth:number,z:number,bevel=.065,side=1):THREE.Mesh {
  const s=new THREE.Shape();
  const first=points[0],last=points[points.length-1];
  s.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  for(let i=0;i<points.length;i++){
    const p=points[i],n=points[(i+1)%points.length];
    s.quadraticCurveTo(p[0],p[1],(p[0]+n[0])/2,(p[1]+n[1])/2);
  }
  const geo=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:bevel,
    bevelThickness:bevel,bevelSegments:3,steps:1,curveSegments:6});
  if(side<0){geo.scale(-1,1,1); // Reflection reverses winding; swap each triangle.
    const p=geo.getAttribute('position'),n=geo.getAttribute('normal');
    for(let i=0;i<p.count;i+=3)for(const attr of [p,n]){
      const x=attr.getX(i),y=attr.getY(i),z0=attr.getZ(i);
      attr.setXYZ(i,attr.getX(i+2),attr.getY(i+2),attr.getZ(i+2));attr.setXYZ(i+2,x,y,z0);
    }
  }
  const p=geo.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.07*Math.cos(p.getX(i)*1.8));
  geo.computeVertexNormals();
  return mesh(g,track,geo,mat,name,[0,0,z]);
}
function body(g:THREE.Group,track:Track,mat:THREE.Material,name:string,
  stations:Parameters<typeof createHullLoft>[0]):THREE.Mesh {
  // Interpolate the editable cross-sections. A smooth continuous pressure hull
  // replaces the old seven-station angular kite silhouette.
  const curve=new THREE.CatmullRomCurve3(stations.map(s=>new THREE.Vector3(s.radiusX,s.y,s.radiusZ)),false,'centripetal');
  const centers=new THREE.CatmullRomCurve3(stations.map(s=>new THREE.Vector3(0,s.y,s.centerZ)),false,'centripetal');
  const samples=Array.from({length:25},(_,i)=>{
    const v=curve.getPoint(i/24),c=centers.getPoint(i/24);
    return {y:v.y,radiusX:Math.max(.006,v.x),centerZ:c.z,radiusZ:Math.max(.006,v.z)};
  });
  return mesh(g,track,createHullLoft(samples,24),mat,name);
}
/** Bell mouths are open hollow rings, not coloured spheres on top of plates. */
function bell(g:THREE.Group,track:Track,mat:THREE.Material,name:string,pos:XYZ,r:number):THREE.Mesh {
  const m=mesh(g,track,new THREE.TorusGeometry(r,.042,8,24),mat,name,pos);
  m.rotation.x=Math.PI*.35;return m;
}
function seal(g:THREE.Group,kind:string,source:string,tilt:number):THREE.Group {
  // Tilt only the authored object, never the plane/camera. This exposes the
  // thick shell side even when the motion setting is reduced or game is ready.
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,-.075,0));
  for(const p of g.children){
    if(kind==='raider'){p.position.z*=1.15;p.scale.z*=1.15;}
    p.position.applyQuaternion(q);p.quaternion.premultiply(q);
  }
  for(const [index,part] of g.children.entries()){
    const m=part as THREE.Mesh;
    const baked=SHIP_OCCLUSION[kind+'/'+index];
    const count=m.geometry.getAttribute('position').count;
    const data=baked?Uint8Array.from(atob(baked),c=>c.charCodeAt(0)):null;
    const colors=new Uint8Array(count*3).fill(255);
    // A source edit remains previewable before rebaking; the hash regression
    // test prevents stale baked data from being shipped.
    if(data?.length===count)for(let i=0;i<count;i++)colors.fill(data[i],i*3,i*3+3);
    m.geometry.setAttribute('color',new THREE.Uint8BufferAttribute(colors,3,true));
  }
  g.userData.modelKind=kind;g.userData.assetSource='src/render/ShipModels.ts#'+source;
  g.userData.geometrySource='src/render/ShipModels.ts';return g;
}
function makePlayer(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='q-player-pivot';
  const white=plastic(track,P3_COLORS.ceramic),blue=plastic(track,0x429cba),
    navy=plastic(track,0x193e54,.56),mint=plastic(track,0x88e0d5),
    cockpit=glass(track,0x153a57),thrust=luminous(track,0x9affec);
  body(g,track,white,'continuous-ceramic-fuselage',[
    {y:-.63,radiusX:.07,centerZ:.06,radiusZ:.07},
    {y:-.45,radiusX:.35,centerZ:.09,radiusZ:.27},
    {y:-.12,radiusX:.46,centerZ:.12,radiusZ:.33},
    {y:.28,radiusX:.37,centerZ:.12,radiusZ:.30},
    {y:.56,radiusX:.22,centerZ:.08,radiusZ:.19},
    {y:.68,radiusX:.015,centerZ:.06,radiusZ:.025},
  ]);
  for(const side of [-1,1]){
    plate(g,track,white,side<0?'left-main-airfoil':'right-main-airfoil',
      [[.25,.26],[.70,.27],[1.13,.035],[1.13,-.23],[.62,-.41],[.29,-.35]],.15,-.10,.085,side);
    plate(g,track,blue,side<0?'left-toy-wing-inlay':'right-toy-wing-inlay',
      [[.67,.19],[.91,.13],[1.08,.015],[1.04,-.17],[.79,-.25],[.62,-.10]],.035,.145,.025,side);
    egg(g,track,navy,'engine-undercarriage',[side*.71,-.26,-.055],[.245,.40,.19]);
    egg(g,track,blue,'engine-pod',[side*.71,-.24,.12],[.22,.40,.255]);
    egg(g,track,white,'engine-shoulder',[side*.71,-.04,.23],[.205,.20,.18]);
    bell(g,track,navy,'rear-nozzle-rim',[side*.71,-.58,.08],.137);
    egg(g,track,thrust,'engine-core',[side*.71,-.645,.11],[.105,.06,.10]);
    egg(g,track,mint,'engine-top-panel',[side*.71,-.28,.363],[.12,.15,.035]);
  }
  egg(g,track,navy,'raised-canopy-gasket',[0,.04,.35],[.315,.39,.17]);
  egg(g,track,cockpit,'single-polished-raised-canopy',[0,.07,.43],[.275,.33,.24]);
  egg(g,track,mint,'canopy-catchlight',[-.12,.19,.638],[.025,.075,.012]);
  plate(g,track,blue,'single-chamfered-tail-plate',
    [[-.24,-.40],[-.25,-.53],[0,-.61],[.25,-.53],[.24,-.40]],.085,.20,.025);
  return seal(g,'player','q-player-pivot',.22);
}
function makeScout(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='scout-toy-bean';
  const orange=plastic(track,P3_COLORS.scout),cream=plastic(track,0xffedcf),
    deep=plastic(track,0xac5332,.53),teal=plastic(track,0x397a83),
    eye=glass(track,0x16394b),shine=luminous(track,0xfff5d8);
  // The orange bean IS the character. No cream pads covering its main volume.
  egg(g,track,deep,'scout-lower-pressure-shell',[0,.015,-.10],[.52,.43,.28]);
  egg(g,track,orange,'scout-continuous-orange-shell',[0,.025,.13],[.52,.47,.42]);
  for(const side of [-1,1]){
    plate(g,track,orange,side<0?'scout-port-airfoil':'scout-starboard-airfoil',
      [[.35,.20],[.66,.25],[.91,.13],[.91,-.16],[.66,-.30],[.35,-.24]],.15,-.05,.065,side);
    egg(g,track,deep,'scout-wing-joint',[side*.51,0,.11],[.14,.22,.14]);
    egg(g,track,orange,'scout-wing-shoulder',[side*.68,.09,.13],[.175,.19,.17]);
    egg(g,track,teal,'scout-rear-jet-housing',[side*.36,.32,.10],[.14,.20,.16]);
    egg(g,track,cream,'scout-rear-jet-cap',[side*.36,.43,.12],[.11,.075,.11]);
  }
  egg(g,track,deep,'scout-optical-gasket',[0,-.035,.45],[.35,.315,.13]);
  egg(g,track,cream,'scout-creamy-eye-surround',[0,-.055,.49],[.315,.29,.185]);
  egg(g,track,eye,'scout-main-single-optic',[0,-.11,.645],[.213,.23,.125]);
  egg(g,track,shine,'scout-eye-catchlight',[-.075,-.025,.755],[.037,.047,.016]);
  egg(g,track,orange,'scout-upper-brow',[0,.22,.485],[.29,.065,.075]);
  return seal(g,'scout','scout',.24);
}
function makeRaider(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='raider-cherry-crab';
  const coral=plastic(track,P3_COLORS.raider),cream=plastic(track,0xffd7b9),
    dark=plastic(track,0x663d54,.56),visor=glass(track,0x23334e),
    hot=luminous(track,0xffbb83);
  egg(g,track,dark,'raider-underbody',[0,.02,-.08],[.50,.46,.29]);
  body(g,track,coral,'raider-sculpted-chassis',[
    {y:-.50,radiusX:.04,centerZ:.06,radiusZ:.06},
    {y:-.25,radiusX:.42,centerZ:.10,radiusZ:.32},
    {y:.18,radiusX:.48,centerZ:.10,radiusZ:.36},
    {y:.46,radiusX:.31,centerZ:.07,radiusZ:.25},
    {y:.56,radiusX:.03,centerZ:.04,radiusZ:.04},
  ]);
  for(const side of [-1,1]){
    plate(g,track,dark,'raider-armature',[[.26,.28],[.79,.36],[1.0,.15],[.90,-.21],[.30,-.24]],.16,-.10,.07,side);
    egg(g,track,coral,'raider-round-pincer-shoulder',[side*.72,.17,.16],[.29,.34,.31]);
    egg(g,track,cream,'raider-shoulder-inlay',[side*.73,.25,.437],[.16,.13,.035]);
    egg(g,track,dark,'raider-independent-weapon-pod',[side*.74,-.28,.18],[.22,.35,.23]);
    egg(g,track,coral,'raider-muzzle-housing',[side*.74,-.40,.25],[.215,.15,.215]);
    const lip=bell(g,track,cream,'raider-open-cannon-lip',[side*.74,-.45,.475],.15);
    lip.rotation.x=.25;
    const bore=mesh(g,track,new THREE.CircleGeometry(.108,24),visor,'raider-cannon-bore',[side*.74,-.445,.458]);
    bore.rotation.x=.25;
    egg(g,track,hot,'raider-muzzle-emitter',[side*.74,-.446,.465],[.045,.035,.04]);
  }
  egg(g,track,dark,'raider-canopy-recess',[0,.10,.40],[.29,.25,.19]);
  egg(g,track,visor,'raider-dark-optical-canopy',[0,.08,.52],[.245,.20,.17]);
  egg(g,track,cream,'raider-visor-brow',[0,.235,.56],[.25,.065,.055]);
  return seal(g,'raider','raider',.21);
}
function makeGuardian(track:Track):THREE.Group {
  const g=new THREE.Group();g.name='guardian-lavender-shield';
  const violet=plastic(track,P3_COLORS.guardian,.51),lilac=plastic(track,0xded1f3),
    dark=plastic(track,0x544564,.55),teal=glass(track,0x24556a),
    glow=luminous(track,0x9aefda);
  egg(g,track,dark,'guardian-deep-monocoque',[0,.03,-.04],[.79,.59,.42]);
  plate(g,track,violet,'guardian-shield-carapace',
    [[0,.58],[.60,.48],[.77,.09],[.51,-.43],[0,-.61],[-.51,-.43],[-.77,.09],[-.60,.48]],.24,.08,.12);
  for(const side of [-1,1]){
    egg(g,track,dark,'guardian-shield-pylon',[side*.82,-.05,.12],[.30,.46,.34]);
    egg(g,track,violet,'guardian-big-shoulder',[side*.86,.11,.24],[.275,.42,.37]);
    plate(g,track,lilac,'guardian-soft-shoulder-plate',
      [[.78,.36],[.97,.31],[1.025,.10],[.96,-.15],[.77,-.20]],.085,.51,.045,side);
    egg(g,track,dark,'guardian-armor-joint',[side*.49,-.36,.32],[.16,.12,.15]);
  }
  egg(g,track,lilac,'guardian-raised-breastplate',[0,.31,.36],[.49,.23,.18]);
  egg(g,track,dark,'guardian-dark-core-recess',[0,-.13,.46],[.395,.37,.19]);
  const rim=mesh(g,track,new THREE.TorusGeometry(.285,.063,10,32),lilac,'guardian-core-ceramic-ring',[0,-.14,.62]);
  rim.rotation.x=.08;
  egg(g,track,teal,'guardian-dark-optic',[0,-.14,.61],[.275,.26,.20]);
  egg(g,track,glow,'guardian-three-dimensional-energy-lens',[0,-.17,.77],[.155,.16,.095]);
  egg(g,track,lilac,'guardian-brow-glint',[-.075,-.07,.825],[.035,.04,.015]);
  return seal(g,'guardian','guardian',.19);
}
export function createShipTemplates(resources:GpuResource[]):ShipTemplates {
  const track:Track=<T extends GpuResource>(value:T):T=>{resources.push(value);return value;};
  return {player:makePlayer(track),enemies:{scout:makeScout(track),raider:makeRaider(track),guardian:makeGuardian(track)}};
}
