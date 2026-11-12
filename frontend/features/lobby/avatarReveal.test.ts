import * as THREE from "three";
import { createAvatarReveal } from "./avatarReveal";

test("collision-style reveal preserves existing shader hooks and changes a shared uniform", () => {
    const material = new THREE.MeshLambertMaterial();
    const compile = jest.fn();
    material.onBeforeCompile = compile;
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const reveal = createAvatarReveal(root);
    const shader: any = { uniforms: {}, vertexShader: "#include <project_vertex>", fragmentShader: "void main() { }" };
    material.onBeforeCompile(shader, {} as any);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(shader.vertexShader).toContain("avatarRevealPosition = mvPosition.xyz");
    expect(shader.fragmentShader).toContain("vec3(0.016)");
    reveal(0);
    expect(root.visible).toBe(false);
    expect(shader.uniforms.avatarReveal.value).toBe(0);
    reveal(0.5);
    expect(root.visible).toBe(true);
    expect(shader.uniforms.avatarReveal.value).toBe(0.5);
    reveal(1);
    expect(shader.uniforms.avatarReveal.value).toBe(1);
});
