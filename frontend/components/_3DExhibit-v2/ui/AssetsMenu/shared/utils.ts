import { Rotation } from "@uitypes/experience";
import type { SpaceComponent } from "@3factory/abstract/spacecomponent";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import type { SpaceArtwork } from "@components/_3DExhibit-v2/three/factory/artwork/abstract";
import type { SpacePlaceholder } from "@components/_3DExhibit-v2/three/factory/artwork/placeholders/spaceplaceholder";
import type { Portal } from "@components/_3DExhibit-v2/three/factory/portal/portal";
import type { KitBashElement } from "@3factory/space/kits/kitbash/kitbashelement";

import { degreeToRadian, radianToDegree, round, toNum, XYZ } from "@utils/js";
import { Placement3DChange } from "./Placement3D";

export function toNumXYZ({ x, y, z }: { x: any; y: any; z: any }) {
    return {
        x: round(toNum(x, 0), 4),
        y: round(toNum(y, 0), 4),
        z: round(toNum(z, 0), 4),
    };
}

export function toDegree(x: any) {
    return round(radianToDegree(toNum(x, 0)), 0);
}

export function toRadian(x: any) {
    return round(degreeToRadian(toNum(x, 0)), 4);
}

export function toDegreeXYZ({ x, y, z }: { x: any; y: any; z: any }) {
    return {
        x: toDegree(x),
        y: toDegree(y),
        z: toDegree(z),
    };
}

export function toRadianXYZ(e: Placement3DChange): Placement3DChange {
    //
    if ("x" in e) {
        return { x: toRadian(e.x) };
    }
    if ("y" in e) {
        return { y: toRadian(e.y) };
    }
    if ("z" in e) {
        return { z: toRadian(e.z) };
    }
}

export function xyzEquals(a: XYZ, b: XYZ) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function _xyzEquals(a: Rotation, b: Rotation) {
    return a._x === b._x && a._y === b._y && a._z === b._z;
}

export function isArtwork(item: SpaceComponent): item is SpaceArtwork {
    return item?.isArtwork;
}

export function isPlaceholder(item: SpaceComponent): item is SpacePlaceholder {
    return item?.isPlaceholder;
}

export function isPortal(item: SpaceComponent): item is Portal {
    return item?.isPortal;
}

export function isKitBash(item: any): item is KitBashElement {
    return item?.isKitBash;
}

export function mediaType(item: SpaceItem) {
    if (isArtwork(item)) return item.mediaType;
    return null;
}
