import * as THREE from "three";

// The native travel effect reads scene visibility and materials. Camera layers
// keep the source cage intact for its reveal without tinting shared steel/glass.
export const PADEL_NEAR_WALL_LAYER = 17;
const IMPACT_COUNT = 6;
const IMPACT_LIFETIME = 0.52;
const finite = Number.isFinite;
const clamp = THREE.MathUtils.clamp;

export function createPadelEnclosureView({
  scene,
  rear,
  halfWidth = 5,
  halfLength = 10,
  sideGlassStartsAt = 6,
}) {
  const sourceLayers = new Map();
  const cameraLayers = new Map();
  rear.traverse((object) => {
    if (object.isMesh) sourceLayers.set(object, object.layers.mask);
  });
  let hidden = false,
    configured = false,
    disposed = false,
    next = 0;
  const effects = new THREE.Group();
  effects.name = "Padel · invisible wall contact ripples";
  effects.userData.worldRevealExclude = true;
  effects.visible = false;
  scene.add(effects);
  const geometry = new THREE.PlaneGeometry(2.1, 2.1);
  const impacts = Array.from({ length: IMPACT_COUNT }, () => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        age: { value: 1 },
        strength: { value: 0.6 },
        bounds: { value: new THREE.Vector2(halfWidth, halfLength) },
        tint: { value: new THREE.Color(0x9ed6ff) },
      },
      vertexShader: `varying vec2 vUv;varying vec3 vWorld;
        void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `varying vec2 vUv;varying vec3 vWorld;
        uniform float age;uniform float strength;uniform vec2 bounds;uniform vec3 tint;
        void main(){
          if(vWorld.y<.025||vWorld.y>4.||abs(vWorld.x)>bounds.x+.03||abs(vWorld.z)>bounds.y+.03) discard;
          float r=length((vUv-.5)*2.);
          float radius=.13+age*.72;
          float ring=exp(-pow((r-radius)/.038,2.));
          float halo=exp(-r*r/.11)*.18*(1.-age);
          float alpha=(ring*.43+halo)*pow(1.-age,1.8)*strength;
          gl_FragColor=vec4(mix(tint,vec3(1.),halo*2.),alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Padel · wall contact glow";
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    effects.add(mesh);
    return { mesh, material, age: IMPACT_LIFETIME };
  });

  function clear() {
    for (const impact of impacts) {
      impact.age = IMPACT_LIFETIME;
      impact.mesh.visible = false;
    }
    effects.visible = false;
  }
  function setView({
    mode,
    playing = false,
    camera,
    travelLocked = false,
  } = {}) {
    if (disposed || !camera?.layers) return;
    if (!configured) {
      for (const [mesh, original] of sourceLayers)
        mesh.layers.mask = (original & ~1) | (1 << PADEL_NEAR_WALL_LAYER);
      configured = true;
    }
    if (!cameraLayers.has(camera)) cameraLayers.set(camera, camera.layers.mask);
    hidden = playing && mode === "courtside" && !travelLocked;
    if (hidden) camera.layers.disable(PADEL_NEAR_WALL_LAYER);
    else camera.layers.enable(PADEL_NEAR_WALL_LAYER);
    if (!hidden) clear();
  }
  function wallImpact(event) {
    if (disposed || !hidden) return false;
    const point = event?.position || event?.wall?.position;
    if (!point || !finite(point.x) || !finite(point.y) || !finite(point.z))
      return false;
    const back = event.side === "back" || Math.abs(point.z - halfLength) < 0.18;
    const nearBack = back && Math.abs(point.z - halfLength) < 0.2;
    const nearSide =
      !back &&
      Math.abs(Math.abs(point.x) - halfWidth) < 0.2 &&
      point.z >= sideGlassStartsAt - 0.1 &&
      point.z <= halfLength + 0.2;
    // The far cage and middle side fences remain visible and receive no ghost effect.
    if ((!nearBack && !nearSide) || point.y < 0 || point.y > 4.1) return false;
    const impact = impacts[next++ % IMPACT_COUNT];
    impact.age = 0;
    impact.material.uniforms.age.value = 0;
    impact.material.uniforms.strength.value =
      0.5 + clamp((event.speed || 12) / 30, 0, 1) * 0.35;
    impact.material.uniforms.tint.value.set(
      event.surface === "fence" ? 0xc7dfff : 0x9ed6ff
    );
    impact.mesh.position.set(
      nearSide
        ? Math.sign(point.x) * (halfWidth - 0.014)
        : clamp(point.x, -halfWidth, halfWidth),
      point.y,
      nearBack ? halfLength - 0.014 : point.z
    );
    impact.mesh.rotation.set(0, nearSide ? Math.PI / 2 : 0, 0);
    impact.mesh.visible = true;
    effects.visible = true;
    return true;
  }
  function tick(dt) {
    if (disposed || !effects.visible) return;
    const delta = finite(dt) ? Math.max(0, dt) : 0;
    let active = false;
    for (const impact of impacts) {
      if (!impact.mesh.visible) continue;
      impact.age = Math.min(IMPACT_LIFETIME, impact.age + delta);
      impact.material.uniforms.age.value = impact.age / IMPACT_LIFETIME;
      impact.mesh.visible = impact.age < IMPACT_LIFETIME;
      active ||= impact.mesh.visible;
    }
    effects.visible = active;
  }
  return {
    setView,
    wallImpact,
    tick,
    get hidden() {
      return hidden;
    },
    get viewState() {
      return Object.freeze({
        rearHidden: hidden,
        hiddenPanels: hidden ? sourceLayers.size : 0,
        activeImpacts: impacts.filter(({ mesh }) => mesh.visible).length,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, mask] of sourceLayers) mesh.layers.mask = mask;
      for (const [camera, mask] of cameraLayers) {
        if (mask & (1 << PADEL_NEAR_WALL_LAYER))
          camera.layers.enable(PADEL_NEAR_WALL_LAYER);
        else camera.layers.disable(PADEL_NEAR_WALL_LAYER);
      }
      sourceLayers.clear();
      cameraLayers.clear();
      effects.removeFromParent();
      geometry.dispose();
      for (const impact of impacts) impact.material.dispose();
    },
  };
}
