// Make a shot-scale derivative of the project's fitted v07 Mesh and its 52-joint rig.
// Only exposed anatomy is needed under the suit. Preserve skin weights on the hands.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {Vector3, Matrix4, Quaternion} from 'three/webgpu';

if(!process.argv[2])throw Error('Pass the path to the fitted v07 GLB');
const blob = fs.readFileSync(process.argv[2]);
const headerLength = blob.readUInt32LE(12);
const g = JSON.parse(blob.subarray(20,20+headerLength));
const bytes = 28+headerLength;
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const round=n=>Math.round(n*1e5)/1e5;
function accessor(index) {
  const a=g.accessors[index], v=g.bufferViews[a.bufferView];
  const dim={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  const A={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
  const start=blob.byteOffset+bytes+(v.byteOffset||0)+(a.byteOffset||0);
  const stride=(v.byteStride || dim*A.BYTES_PER_ELEMENT)/A.BYTES_PER_ELEMENT;
  const array=new A(blob.buffer,start,(a.count-1)*stride+dim);
  return {count:a.count, at:i=>Array.from(array.subarray(i*stride,i*stride+dim))};
}
const joints=g.skins[0].joints, raw=[],parent=[];
function walk(i,mat,parentJoint) {
  const n=g.nodes[i],world=mat.clone().multiply(n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4());
  let k=joints.indexOf(i);
  if(k>=0){raw[k]=V().setFromMatrixPosition(world);parent[k]=parentJoint;}
  for(const c of n.children||[])walk(c,world,k>=0?k:parentJoint);
}
walk(g.scenes[0].nodes[0],new Matrix4(),-1);
const names=joints.map(i=>g.nodes[i].name.replace('mixamorig:',''));
const id=n=>names.indexOf(n), at=n=>raw[id(n)], rest=raw.map(v=>v.clone());
const handTransforms={}, shoeOffsets={};
for(const [side,sgn] of [['Left',1],['Right',-1]]){
  const arm=at(side+'Arm'), elbow=at(side+'ForeArm'), hand=at(side+'Hand');
  const canonicalElbow=arm.clone().add(V(sgn*arm.distanceTo(elbow),0,0));
  const canonicalHand=canonicalElbow.clone().add(V(sgn*elbow.distanceTo(hand),0,0));
  const q=new Quaternion().setFromUnitVectors(hand.clone().sub(elbow).normalize(),V(sgn,0,0));
  handTransforms[side]=v=>v.sub(hand).applyQuaternion(q).add(canonicalHand);
  rest[id(side+'ForeArm')]=canonicalElbow;
  for(let i=0;i<names.length;i++) if(names[i].startsWith(side+'Hand'))rest[i]=handTransforms[side](raw[i].clone());
  const hip=at(side+'UpLeg'),knee=at(side+'Leg'),foot=at(side+'Foot');
  rest[id(side+'Leg')]=hip.clone().add(V(sgn*.013,-hip.distanceTo(knee),.015));
  rest[id(side+'Foot')]=rest[id(side+'Leg')].clone().add(V(0,-knee.distanceTo(foot),-.012));
  shoeOffsets[side]=rest[id(side+'Foot')].clone().sub(foot);
  rest[id(side+'ToeBase')].add(shoeOffsets[side]);
}
const packed = {bones:names.map((name,i)=>[name,parent[i],...rest[i].toArray().map(round)]),parts:{}};
function extract(part,meshIndex,keep,alter){
  const m=g.meshes[meshIndex].primitives[0],a=Object.fromEntries(Object.entries(m.attributes).map(([k,i])=>[k,accessor(i)]));
  const faces=accessor(m.indices), vertices=[],indices=[],remap=new Map(),cache=[];
  function vertex(i){
    if(!cache[i]){
      const pos=V().fromArray(a.POSITION.at(i)), weights=a.WEIGHTS_0.at(i),j=a.JOINTS_0.at(i);
      const normal=V().fromArray(a.NORMAL.at(i)),side=pos.x>0?'Left':'Right';
      cache[i]={pos,weights,j,normal,side,keep:keep(pos,side,j)};
    }
    return cache[i];
  }
  function mapped(i){
    if(remap.has(i))return remap.get(i);
    const {pos,weights,j,normal,side}=vertex(i);
    let p=pos.clone(), n=normal.clone();if(alter)[p,n]=alter(p,n,side);
    // Weld subdivided fitted anatomy into a millimetre-scale screen LOD.
    const grid=part==='skin'?0.0024:.0015;
    const key=[...p.toArray().map(v=>Math.round(v/grid)),j[0]].join(',');
    let out=remap.get(key);
    if(out===undefined){out=vertices.length;remap.set(key,out);
      vertices.push([...p.toArray().map(v=>Math.round(v*10000)),...n.toArray().map(v=>Math.round(v*100)),...j,...weights.map(v=>Math.round(v*255))]);}
    remap.set(i,out);return out;
  }
  for(let i=0;i<faces.count;i+=3){
    const tri=[0,1,2].map(k=>faces.at(i+k)[0]);
    if(!tri.every(k=>vertex(k).keep))continue;
    const [a,b,c]=tri.map(mapped);if(a!==b&&b!==c&&a!==c)indices.push(a,b,c);
  }
  packed.parts[part]={v:vertices,i:indices};
}
extract('skin',0,(p,s,j)=>p.y>1.53&&Math.abs(p.x)<.17 || names[j[0]].startsWith(s+'Hand') || (Math.abs(p.x)>Math.abs(at(s+'Hand').x)-.024&&p.y<at(s+'Hand').y+.028),
(p,n,s)=>{if(p.y>1.53)return [p,n];const fn=handTransforms[s];return [fn(p.clone()),fn(p.clone().add(n)).sub(fn(p.clone())).normalize()];});
extract('eyes',1,()=>true);
extract('shoes',2,()=>true,(p,n,s)=>[p.add(shoeOffsets[s]),n]);
const dest=new URL('../public/assets/fitted-cast.json.gz',import.meta.url);
fs.writeFileSync(dest,gzipSync(JSON.stringify(packed),{level:9}));
console.log('Cast mesh',Object.fromEntries(Object.entries(packed.parts).map(([k,v])=>[k,[v.v.length,v.i.length/3]])),fs.statSync(dest).size);
console.log(packed.bones.filter(b=>!b[0].includes('Hand')||b[0].endsWith('Hand')));
