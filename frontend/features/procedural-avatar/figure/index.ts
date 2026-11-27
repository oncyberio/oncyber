export {
    styleFigure,
    type FigureFace,
    type FigureForm,
    type StyleFigureOptions,
    type StyledFigure,
} from "./createFigure";
export {
    DETAIL_PIXELS,
    createFigureCrowd,
    createFigurePoses,
    type CrowdFigure,
    type CrowdView,
    type FigureCrowd,
    type FigureCrowdOptions,
    type FigurePoses,
} from "./crowd";
export {
    levelFor,
    levelTolerance,
    pixelSize,
    type FigureLevels,
} from "./levels";
export { FIGURE_URLS, loadFigure } from "./load";
export { createFigureLooks, type FigureLooks } from "./looks";
export { blinkAt } from "./shading";
export { STANCES, standFigure, type Stance } from "./stances";
export {
    FIGURE_STYLES,
    PLAIN_STYLE,
    STAGEHAND_STYLE,
    type FaceFeature,
    type FigureShape,
    type FigureStyle,
} from "./style";
export { variedLook } from "./vary";
export type { FigureInfo, FigureLandmarks, FigurePart } from "./format";
export { HAIR_FILES, hairUrl, type HairFile } from "./hairFiles";
export { wearHair } from "./wearHair";
