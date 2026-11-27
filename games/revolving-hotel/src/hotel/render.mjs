import * as THREE from 'three/webgpu';
import {buildScene, HEIGHT, LENGTH, BAY} from './scene.mjs';

import {HotelMaterial} from './lighting.mjs';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {fxaa} from 'three/addons/tsl/display/FXAANode.js';
import * as n from 'three/tsl';
const loader = new THREE.TextureLoader();
const dir = './assets/surfaces/';
// The portable HTML export embeds the same files as data URLs.
const assetURL = path => new URL(path, document.baseURI).href;
const assets = {};
for(const name of ['carpet','walnut','wall','shade','plaster','brass','stone']){
  for(const [suffix,part] of [['','color'],['N','normal'],['R','rough']]) assets[name+suffix]=name+'-'+part;
}
Object.assign(assets,{print:'landscape-color',plate528:'plaque-528',plate491:'plaque-491'});

function surfaceUV(face,p,u,v) {
  if(face.stretch)return [u,v];
  const [x,y,z]=p,[nx,ny]=face.normal,mat=face.mat;
  if(mat==='carpet')return [x/1.8,z/2.1];
  const key=['wood','door','trim','flute'].includes(mat)?'wood':['bronze','brass','antique'].includes(mat)?'brass':mat;
  const [sx,sy]=({wood:[.78,1.8],brass:[.35,.35],wall:[.85,.85],padded:[.85,.85],ceiling:[1.4,1.4],stone:[1.25,1.25]})[key]??[1,1];
  // Shift each piece of veneer along the grain, preserving continuous corners within its bay.
  const offset=key==='wood'?Math.sin((Math.floor((z+.02)/BAY)+2)*(x<0?3.13:6.43))*.45:0;
  if(Math.abs(ny)>.65)return [x/sx+offset,z/sy];
  return [(Math.abs(nx)>.6?z:x)/sx+offset,y/sy+offset*.33];
}

function buildMeshes(data, materials, lightMap, directionMap) {
  const grouped = new Map();
  function group(name,bake) {
    const key=name+(bake?'_baked':'');
    if(!grouped.has(key)) grouped.set(key,{name,bake,p:[],n:[],uv:[],uv1:[],index:[]});
    return grouped.get(key);
  }
  for(const f of data.faces) {
    const g=group(f.mat,f.chart>=0), index=g.p.length/3, chart=data.charts[f.chart];
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) {
      const p=f.origin.map((x,i)=>x+u*f.u[i]+v*f.v[i]);
      g.p.push(...p); g.n.push(...f.normal);g.uv.push(...surfaceUV(f,p,u,v));
      if(chart){
        const [x,y,w,h]=chart.rect;
        g.uv1.push((x+2.5+u*(w-5))/data.atlasWidth,1-(y+2.5+v*(h-5))/data.atlasHeight);
      }
    }
    g.index.push(index,index+1,index+2,index,index+2,index+3);
  }
  const up=new THREE.Vector3(0,1,0),vec=new THREE.Vector3(),normal=new THREE.Vector3(),q=new THREE.Quaternion();
  for(const obj of data.curves) {
    const cylinder=obj.kind==='cylinder';
    const mesh = cylinder?new THREE.CylinderGeometry(obj.rt,obj.rb,obj.h,obj.segments,1):new THREE.SphereGeometry(1,10,7);
    if(cylinder)q.setFromUnitVectors(up,vec.fromArray(obj.axis));
    else{q.setFromAxisAngle(new THREE.Vector3(0,0,1),obj.angle);mesh.scale(...obj.scale);}
    const g=group(obj.mat,false), off=g.p.length/3;
    for(let i=0;i<mesh.attributes.position.count;i++) {
      vec.fromBufferAttribute(mesh.attributes.position,i).applyQuaternion(q);
      g.p.push(vec.x+obj.p[0],vec.y+obj.p[1],vec.z+obj.p[2]);
      normal.fromBufferAttribute(mesh.attributes.normal,i).applyQuaternion(q);
      g.n.push(normal.x,normal.y,normal.z);
      g.uv.push(mesh.attributes.uv.getX(i),mesh.attributes.uv.getY(i));
    }
    for(const i of mesh.index.array)g.index.push(off+i);
    mesh.dispose();
  }
  const room=new THREE.Group();
  for(const g of grouped.values()) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.n,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.uv,2));
    if(g.bake)geo.setAttribute('uv1',new THREE.Float32BufferAttribute(g.uv1,2));
    geo.setIndex(g.index);
    const mat=new HotelMaterial(materials[g.name]);
    if(g.bake){mat.lightMap=lightMap;mat.lightMapIntensity=24;mat.lightDirection=directionMap;}
    if(g.name==='shade'||g.name==='drum'){
      // A bulb behind woven linen produces a broad hot band, with darker binding at both ends.
      const y=n.uv().y,dy=y.sub(.49).mul(g.name==='shade'?3.25:2.05);
      const profile=n.exp(dy.mul(dy).negate()).mul(.96).add(.38);
      mat.emissiveNode=n.materialEmissive.mul(profile);
    }
    if(g.name==='diffuser'){
      const r=n.uv().sub(.5).length().mul(2);
      mat.emissiveNode=n.materialEmissive.mul(n.exp(r.mul(r).mul(-2.55)).mul(.72).add(.56));
    }
    if(g.name==='opal'){
      // Diffused backlight has a vertical falloff and a soft shadow behind the reeded glazing.
      const x=n.positionLocal.x.abs().sub(.52),y=n.positionLocal.y;
      const offset=x.sub(.12).mul(4);
      const lightBox=n.exp(offset.mul(offset).negate()).mul(.50).add(.46);
      const reeds=n.cos(x.mul(161.1)).mul(.055).add(1);
      mat.emissiveNode=n.materialEmissive.mul(lightBox).mul(reeds).mul(n.smoothstep(.95,2.25,y).mul(.32).add(.8));
    }
    const item=new THREE.Mesh(geo,mat);item.name=g.name;room.add(item);
  }
  return room;
}

function makeMaterials(t) {
  const material=(color,roughness,metalness=0,extra={})=>({color,roughness,metalness,...extra});
  const surface=(name,scale)=>({map:t[name],normalMap:t[name+'N'],roughnessMap:t[name+'R'],normalScale:new THREE.Vector2(scale,scale)});
  const walnut=(tint,coat)=>material(tint,1,0,{...surface('walnut',.59),clearcoat:coat,clearcoatRoughness:.23});
  const metal=(tint,rough)=>material(tint,rough,.94,{...surface('brass',.42)});
  const linen=(heat,strength)=>material('#fffaf2',1,0,{...surface('shade',.53),emissive:heat,emissiveMap:t.shade,emissiveIntensity:strength});
  return {
    wall:material('#f8f4ef',1,0,{...surface('wall',.47),sheen:.17,sheenRoughness:.72,sheenColor:0xb4a28d}),
    padded:material('#f2eae0',.97,0,{...surface('wall',.54),sheen:.27,sheenRoughness:.66,sheenColor:0xc6aa89}),
    ceiling:material('#eee9e4',1,0,surface('plaster',.39)),
    carpet:material('#e7e3dc',1,0,{...surface('carpet',.66),sheen:.38,sheenRoughness:.78,sheenColor:0x998774}),
    wood:walnut('#ddcfc0',.39),door:walnut('#d2c3b4',.47),trim:walnut('#ad9d8b',.43),flute:walnut('#c1b2a3',.39),
    brass:metal('#ffedce',.93),bronze:metal('#b6a491',1.25),antique:metal('#957d66',1.22),
    stone:material('#e3dacf',1,0,{...surface('stone',.24),clearcoat:.46,clearcoatRoughness:.21}),
    paper:material('#ddd3bd',.84),print:material('#eae7de',.6,0,{map:t.print,clearcoat:.16,clearcoatRoughness:.20}),
    plate528:material('#e8e3d9',.41,.33,{map:t.plate528}),plate491:material('#e8e3d9',.41,.33,{map:t.plate491}),
    keyslot:material('#242321',.24,.4),
    shade:linen('#ffe2bd',1.66),drum:linen('#fff0d2',2.04),
    shadeSeam:material('#bd996b',.72,0,{emissive:'#ffbd79',emissiveIntensity:.24}),
    diffuser:material('#e7ded2',.51,0,{emissive:'#ffe5b9',emissiveIntensity:2.44}),
    opal:material('#d6d5c7',.35,0,{emissive:'#dae5df',emissiveIntensity:1.5,clearcoat:.28,clearcoatRoughness:.19}),
    ceramic:material('#696965',.26,.13,{clearcoat:.68,clearcoatRoughness:.18}),
    stem:material('#443c2b',.76),leaf:material('#52533c',.68,0,{sheen:.15,sheenColor:0x73845e}),
    petal:material('#e6d6bc',.74,0,{sheen:.20,sheenColor:0xc2bda8})
  };
}

export async function createHotel(canvas,pixelRatio=window.devicePixelRatio||1) {
  const data=buildScene(), renderer=new THREE.WebGPURenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  const init=renderer.init();
  const maps=Object.entries(assets).map(async ([key,name])=>{
    const t=await loader.loadAsync(assetURL(dir+name+'.webp'));
    t.colorSpace=(key.endsWith('N')||key.endsWith('R'))?THREE.NoColorSpace:THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return [key,t];
  });
  const [textures,lm,ld]=await Promise.all([Promise.all(maps),loader.loadAsync(assetURL('./assets/light.webp')),loader.loadAsync(assetURL('./assets/direction.webp')),init]);
  lm.colorSpace=THREE.SRGBColorSpace;
  ld.colorSpace=THREE.NoColorSpace;
  for(const map of [lm,ld]){map.channel=1;map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;}
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.79;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#161410');
  const camera=new THREE.PerspectiveCamera(55,1,.035,LENGTH+10);
  const stage=new THREE.Group();stage.position.y=HEIGHT/2;scene.add(stage);
  const room=buildMeshes(data,makeMaterials(Object.fromEntries(textures)),lm,ld);
  room.position.y=-HEIGHT/2;stage.add(room);
  const accents=Array.from({length:5},()=>{const light=new THREE.PointLight(0xffffff,0,5.5,2);room.add(light);return light;});
  function accentsAt(z) {
    const sources=[...data.lights].sort((a,b)=>Math.abs(a.position[2]-z)-Math.abs(b.position[2]-z));
    accents.forEach((p,i)=>{
      const l=sources[i],d=Math.abs(l.position[2]-z);p.position.fromArray(l.position);
      p.color.setRGB(...l.color);p.intensity=.18*l.power*THREE.MathUtils.smoothstep(5.5-d,0,2);
    });
  }
  // Capture the lit room in linear HDR before any display transform or bloom.
  const pmrem=new THREE.PMREMGenerator(renderer),probes=[];
  const small=canvas.clientWidth<680;
  const fill=new THREE.HemisphereLight(0xffedd8,0x867165,.085);room.add(fill);
  for(const z of [3.0,15.7,28.95]){
    accentsAt(z);
    const at=new THREE.Vector3(0,1.39,z);
    const target=await pmrem.fromSceneAsync(scene,0,.035,LENGTH+3,{size:small?128:256,position:at});
    probes.push({at,texture:target.texture});
  }
  pmrem.dispose();
  scene.environment=probes[1].texture;scene.environmentIntensity=.70;
  const tablePlane=new THREE.Object3D();
  tablePlane.rotation.x=-Math.PI/2;tablePlane.position.y=.7885;room.add(tablePlane);
  const tabletop=n.reflector({target:tablePlane,resolutionScale:.5,generateMipmaps:true,bounces:false,samples:0});
  tabletop.levelNode=n.float(2.4);
  for(const mesh of room.children){
    if(!mesh.isMesh)continue;
    mesh.material.hotelProbes=probes;
    if(mesh.name==='stone')mesh.material.tableReflection=tabletop;
    mesh.material.needsUpdate=true;
  }
  const shot=n.pass(scene,camera,{samples:0});
  const hdr=shot.getTextureNode('output');
  const contact=ao(shot.getTextureNode('depth'),null,camera);
  contact.resolutionScale=small?.5:.65;
  contact.radius.value=.29;contact.thickness.value=.20;contact.samples.value=12;
  const tungstenBalance=n.vec3(.86,.98,1.17);
  const exposed=hdr.rgb.mul(n.mix(1,contact.getTextureNode().r,.42)).mul(tungstenBalance);
  const glare=bloom(hdr,.14,.48,1.18);
  const post=new THREE.PostProcessing(renderer);
  post.outputColorTransform=false;
  const graded=n.renderOutput(exposed.add(glare.rgb.mul(tungstenBalance)),renderer.toneMapping,renderer.outputColorSpace);
  post.outputNode=fxaa(graded);
  function resize() {
    const w=canvas.clientWidth,h=canvas.clientHeight;
    renderer.setPixelRatio(Math.min(pixelRatio,1.5,Math.sqrt(1750000/(w*h))));
    renderer.setSize(w,h,false);camera.aspect=w/h;
    camera.fov=w/h<.85?66:55;camera.updateProjectionMatrix();
  }
  resize();
  const up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(0,0,1),look=new THREE.Vector3();
  const key=new THREE.DirectionalLight('#ffdfb9',2.0),rim=new THREE.DirectionalLight('#cdd7e2',1.05);
  const bounce=new THREE.HemisphereLight('#eee5d4','#b9a48e',1.13);
  for(const light of [key,rim,bounce]){light.layers.set(7);room.add(light);}
  room.add(key.target,rim.target);
  const castLights=n.lights([bounce,key,rim,...accents]);
  function mount(actor){
    room.add(actor.root);
    actor.mesh.material.lightsNode=castLights;
    actor.mesh.material.envMap=probes[1].texture;
    actor.mesh.material.envMapIntensity=.38;
  }
  function draw(frame){
    const {view,angle,poses}=frame;
    stage.rotation.z=angle;
    room.updateWorldMatrix(true,false);
    camera.position.fromArray(view.eye);room.localToWorld(camera.position);
    look.fromArray(view.target);room.localToWorld(look);
    camera.up.copy(up).applyAxisAngle(axis,angle+view.cameraBank);
    camera.fov=view.fov;camera.updateProjectionMatrix();camera.lookAt(look);
    const z=poses[0].z;
    key.position.set(1.85,3.3,z+2.35);key.target.position.set(0,1.10,z);
    rim.position.set(-1.65,2.6,z-2.1);rim.target.position.set(0,1.20,z);
    accentsAt(z);post.render();
  }
  function dispose(){
    const resources=new Set([...Object.values(Object.fromEntries(textures)),lm,ld]);
    room.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const m of [].concat(node.material||[]))resources.add(m);});
    for(const r of resources)r.dispose();
    for(const p of probes)p.texture.dispose();
    post.dispose();renderer.dispose();
  }
  return {draw,room,scene,stage,camera,renderer,mount,castLights,resize,dispose,backend:renderer.backend.isWebGPUBackend?'WebGPU':'WebGL 2'};
}
