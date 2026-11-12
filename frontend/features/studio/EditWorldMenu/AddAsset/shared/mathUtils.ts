import { Rotation } from "@uitypes/experience";
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

export function toRadianXYZ({ x, y, z }: { x: any; y: any; z: any }) {
    //
    return {
        x: toRadian(x),
        y: toRadian(y),
        z: toRadian(z),
    };
}

export function xyzEquals(a: XYZ, b: XYZ) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function _xyzEquals(a: Rotation, b: Rotation) {
    return a._x === b._x && a._y === b._y && a._z === b._z;
}
