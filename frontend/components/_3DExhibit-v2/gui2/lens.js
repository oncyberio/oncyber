// @ts-check

import { noop } from "@utils/js";

export class PathLens {
    //
    constructor({ object, path }) {
        //
        this._IS_LENS = true;

        this.object = object;

        this.path = path;
    }

    get() {
        //
        let curr = this.object;

        for (let i = 0; i < this.path.length; i++) {
            //
            const key = this.path[i];

            if (i === this.path.length - 1) {
                //
                return curr[key];
            } else {
                //
                curr = curr[key];
            }
        }
    }

    set(value) {
        //
        let curr = this.object;

        for (let i = 0; i < this.path.length; i++) {
            //
            const key = this.path[i];

            if (i === this.path.length - 1) {
                //
                curr[key] = value;
            } else {
                //
                curr = curr[key];
            }
        }
    }
}

export class Lens {
    //
    constructor({ getter, setter = noop }) {
        //
        this._IS_LENS = true;

        this.getter = getter;

        this.setter = setter;
    }

    get() {
        //
        return this.getter();
    }

    set(value, opts) {
        //
        this.setter(value, opts);
    }
}

const idLens = (v) => {
    //
    return new Lens({
        getter: () => v,
        setter: () => {},
    });
};

export function getLens(state) {
    //
    if (state?._IS_LENS) return state;

    if (typeof state === "function") {
        //
        return new Lens({
            getter: state,
        });
    }

    if (Array.isArray(state)) {
        //
        return new PathLens({
            object: state[0],
            path: state.slice(1),
        });
    }

    if (state?.get) {
        //
        return new Lens({
            getter: () => state.get,
            setter: (value, opts) => state.set?.(value, opts),
        });
    } else {
        //
        return idLens(state);
    }
}
