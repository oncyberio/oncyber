import { Color } from "three";

export const idFormat = {
    format: (value, opts) => value,
    parse: (value, prev, opts) => value,
};

export const numberFormat = {
    format: (value, opts) => {
        return +value.toFixed(opts?.decimals || 4);
    },
    parse: (value, prev, opts) => parseFloat(value),
};

const xyzKeys = {
    xyz: ["x", "y", "z"],
    xyz_: ["_x", "_y", "_z"],
    arr: [0, 1, 2],
};

function getKeys(v) {
    //
    if (Array.isArray(v)) return xyzKeys.arr;

    if (v._x != null) return xyzKeys.xyz_;

    if (v.x != null) return xyzKeys.xyz;

    throw new Error("getKeys: invalid argument");
}

function copyXYZ(dst, src) {
    //
    const dstKeys = getKeys(dst);

    const srcKeys = getKeys(src);

    for (let i = 0; i < 3; i++) {
        //
        const srcKey = srcKeys[i];

        if (!Object.hasOwn(src, srcKey)) continue;

        dst[dstKeys[i]] = src[srcKey];
    }
}

function cloneXYZ(v) {
    //
    if (Array.isArray(v)) return v.slice();

    return { ...v };
}

export const xyzFormat = {
    //
    format: (value, opts) => {
        //
        let result = { x: 0 };

        copyXYZ(result, value);


        result.x = +result.x.toFixed(opts?.decimals || 4);

        if (result.y != null) {
            result.y = +result.y.toFixed(opts?.decimals || 4);
        }

        if (result.z != null) {
            result.z = +result.z.toFixed(opts?.decimals || 4);
        }

        return result;
    },
    //
    parse: (value, prev, opts = {}) => {
        //
        if (opts.immutable) {
            //
            prev = cloneXYZ(prev);
        }

        copyXYZ(prev, value);

        return prev;
    },
};

const c = new Color();

export const colorFormat = {
    //
    format(v) {
        //
        if (v instanceof Color) {
            //
            return "#" + v.getHexString();
            //
        } else if (Array.isArray(v)) {
            //
            c.fromArray(v);

            return "#" + c.getHexString();
            //
        } else if (typeof v === "string") {
            //
            return v;
        } else {

            console.log( v )
            //
            throw new Error("invalid color value");
        }
    },

    parse(v, prev, opts = {}) {
        //
        if (prev instanceof Color) {
            //
            if (opts.immutable) {
                prev = prev.clone;
            }

            return prev.set(v);
            //
        } else if (Array.isArray(prev)) {
            //
            if (opts.immutable) {
                //
                prev = prev.slice();
            }

            c.set(v);

            prev[0] = c.r;
            prev[1] = c.g;
            prev[2] = c.b;

            return prev;
            //
        } else {
            //
            return v;
        }
    },
};

const formats = {
    xyz: xyzFormat,
    number: numberFormat,
    color: colorFormat,
};

export function getFormat(type) {
    return formats[type] ?? idFormat;
}
