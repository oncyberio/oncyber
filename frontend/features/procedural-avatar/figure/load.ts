import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { styleFigure, type StyleFigureOptions } from "./createFigure";
import type { FigureStyle } from "./style";

/** The figures there are, and where each is served from. */
export const FIGURE_URLS = {
    male: "/models/figure_male.vrm",
} as const;

/**
 * Load a figure and make it the character a style describes. Each call
 * loads its own copy, because styling changes the figure in place.
 */
export async function loadFigure(
    url: string,
    style: FigureStyle,
    options: StyleFigureOptions = {}
) {
    const loader = new GLTFLoader();
    loader.register(
        (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm;
    // A figure is a VRM 0.x model, which faces the other way.
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);
    return { vrm, figure: styleFigure(vrm, style, options) };
}
