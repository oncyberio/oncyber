import type * as THREE from "three";

/** The same 0.016-unit cell pattern as the native avatar camera-collision fade. */
export function createAvatarReveal(root: THREE.Object3D) {
    const amount = { value: 1 };
    const seen = new Set<THREE.Material>();
    root.traverse((object: any) => {
        for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
            if (seen.has(material)) continue;
            seen.add(material);
            const compile = material.onBeforeCompile;
            const cacheKey = material.customProgramCacheKey.bind(material);
            material.onBeforeCompile = (shader, renderer) => {
                compile.call(material, shader, renderer);
                shader.uniforms.avatarReveal = amount;
                shader.vertexShader = "varying vec3 avatarRevealPosition;\n" + shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\navatarRevealPosition = mvPosition.xyz;");
                shader.fragmentShader = "uniform float avatarReveal;\nvarying vec3 avatarRevealPosition;\n" + shader.fragmentShader.replace("void main() {", `void main() {
                    vec3 cell = abs(mod(-avatarRevealPosition, vec3(0.016)) - vec3(0.008)) / 0.008;
                    if (avatarReveal < 0.9999 && (avatarReveal <= 0.0 || max(max(cell.x, cell.y), cell.z) >= avatarReveal)) discard;
                `);
            };
            material.customProgramCacheKey = () => cacheKey() + ":avatar-reveal-v1";
            material.needsUpdate = true;
        }
    });
    return (value: number) => { amount.value = value; root.visible = value > 0; };
}
