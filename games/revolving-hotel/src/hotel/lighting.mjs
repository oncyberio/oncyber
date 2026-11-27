// All light paths and probe lookups use set-local metres, including when the set rolls.
import {IrradianceNode,LightingNode,MeshPhysicalNodeMaterial} from 'three/webgpu';
import * as n from 'three/tsl';
import {WIDTH,HEIGHT,LENGTH} from './scene.mjs';

const minBounds=n.vec3(-WIDTH/2-.24,0,0), maxBounds=n.vec3(WIDTH/2+.24,HEIGHT,LENGTH);

function localDirection(viewDirection){
  return n.modelWorldMatrixInverse.mul(n.vec4(n.cameraWorldMatrix.mul(n.vec4(viewDirection,0)).xyz,0)).xyz.normalize();
}

function roomIntersection(direction) {
  const point=n.positionLocal.clamp(minBounds.add(.001),maxBounds.sub(.001));
  const safe=direction.greaterThanEqual(0).select(direction.abs().max(.0001),direction.abs().max(.0001).negate());
  const boundary=direction.greaterThanEqual(0).select(maxBounds,minBounds);
  const t=boundary.sub(point).div(safe);
  return point.add(direction.mul(n.min(t.x,n.min(t.y,t.z)).max(0)));
}

class HotelReflections extends LightingNode {
  constructor(probes,baked,tableReflection){super();this.probes=probes;this.baked=baked;this.tableReflection=tableReflection;}
  setup(builder) {
    const sample=(direction,roughness,projected)=>{
      const hit=projected?roomIntersection(direction).toVar():null;
      const radiance=this.probes.map(({texture,at})=>{
        const corrected=projected?hit.sub(n.vec3(at.x,at.y,at.z)).normalize():direction;
        return n.pmremTexture(texture,corrected,roughness);
      });
      const z=n.positionLocal.z;
      const near=n.smoothstep(this.probes[0].at.z,this.probes[1].at.z,z);
      const far=n.smoothstep(this.probes[1].at.z,this.probes[2].at.z,z);
      return n.mix(n.mix(radiance[0],radiance[1],near),radiance[2],far);
    };
    const reflected=(normal,roughness)=>{
      const dir=n.positionViewDirection.negate().reflect(normal);
      return localDirection(n.mix(dir,normal,roughness.mul(roughness)));
    };
    const ctx=builder.context;
    ctx.radiance.addAssign(sample(reflected(n.normalView,n.roughness),n.roughness,true));
    // The baked atlas already contains diffuse bounce. Only small uncharted objects get diffuse IBL here.
    if(!this.baked)ctx.iblIrradiance.addAssign(sample(localDirection(n.normalView),n.float(1),false).mul(2.45));
    if(ctx.lightingModel.clearcoatRadiance){
      const coat=sample(reflected(n.clearcoatNormalView,n.clearcoatRoughness),n.clearcoatRoughness,true);
      // All console tops share a physical plane. Their varnish reflects the actual nearby lamp and vase.
      const radiance=this.tableReflection?n.mix(coat,this.tableReflection.rgb,n.smoothstep(.96,.999,n.normalGeometry.y)):coat;
      ctx.lightingModel.clearcoatRadiance.addAssign(radiance);
    }
  }
}

export class HotelMaterial extends MeshPhysicalNodeMaterial {
  setupEnvironment(builder){
    return this.hotelProbes?new HotelReflections(this.hotelProbes,!!this.lightMap,this.tableReflection):super.setupEnvironment(builder);
  }
  setupLightMap(builder) {
    if(!this.lightMap||!this.lightDirection)return super.setupLightMap(builder);
    const atlas=n.texture(this.lightMap,n.uv(1));
    // Four-tap cubic reconstruction of a single linear mip. Charts include a two-texel guard band.
    const uv=n.uv(1),size=n.vec2(this.lightMap.image.width,this.lightMap.image.height);
    const p=uv.mul(size).sub(.5), f=n.fract(p), one=n.vec2(1), q=one.sub(f);
    const w0=q.pow(3).div(6),w1=f.pow(3).mul(3).sub(f.mul(f).mul(6)).add(4).div(6);
    const w2=q.pow(3).mul(3).sub(q.mul(q).mul(6)).add(4).div(6),w3=f.pow(3).div(6);
    const a=w0.add(w1),b=w2.add(w3),lo=n.floor(p).sub(.5).add(w1.div(a)).div(size);
    const hi=n.floor(p).add(1.5).add(w3.div(b)).div(size);
    const irradiance=n.mix(n.mix(atlas.sample(lo).rgb,atlas.sample(n.vec2(hi.x,lo.y)).rgb,b.x),
      n.mix(atlas.sample(n.vec2(lo.x,hi.y)).rgb,atlas.sample(hi).rgb,b.x),b.y).mul(this.lightMapIntensity);
    const dir=n.texture(this.lightDirection,n.uv(1)).rgb.mul(2).sub(1);
    const l=dir.div(dir.length().max(.001));
    const ng=n.normalGeometry.normalize(),ns=localDirection(n.normalView);
    const correction=l.dot(ns.sub(ng)).div(l.dot(ng).max(.2)).mul(dir.length()).clamp(-.35,.35);
    return new IrradianceNode(irradiance.mul(correction.add(1)));
  }
}
