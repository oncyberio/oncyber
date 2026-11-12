import {
    ShaderMaterial,
    Texture,
    LinearFilter,
    LinearMipMapLinearFilter,
    DoubleSide,
    Vector2,
} from "three";
import vertexShader from "./shaders/vert.glsl";
import fragmentShader from "./shaders/frag.glsl";

export function createCardMaterial() {
    return new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
            map: { value: null },
            ready: { value: 0 },
            opacity: { value: 1 },
            imageAspect: { value: 1 },
            cardSize: { value: new Vector2(1, 1) },
            center: { value: new Vector2() },
            radius: { value: 1 },
            cornerRadius: { value: 0 },
            hover: { value: 0 },
        },
    });
}

export function configureCardTexture(texture: Texture) {
    // The Three fork has colorSpace; the installed @types/three predates it.
    (texture as Texture & { colorSpace: string }).colorSpace = "srgb";
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}
