// @ts-check

import Emitter from "events";
import { Lens, getLens } from "./lens";
import { getFormat } from "./formats";
import { deepEqual, isObject } from "@utils/js";

const validate = {
    //
    number: (value, config) => {
        //
        const min = config.min ?? -Infinity;
        const max = config.max ?? Infinity;

        return Math.min(Math.max(value, min), max);
    },
    xyz: (value, config) => {
        //
        const minX = config.min?.x ?? -Infinity;
        const maxX = config.max?.x ?? Infinity;

        const minY = config.min?.y ?? -Infinity;
        const maxY = config.max?.y ?? Infinity;

        const minZ = config.min?.z ?? -Infinity;
        const maxZ = config.max?.z ?? Infinity;

        value.x = Math.min(Math.max(value.x, minX), maxX);

        if (Object.hasOwn(value, "y")) {
            value.y = Math.min(Math.max(value.y, minY), maxY);
        }

        if (Object.hasOwn(value, "z")) {
            value.z = Math.min(Math.max(value.z, minZ), maxZ);
        }

        return value;
    },
};

function mergeData(current, incoming) {
    //
    for (let key in incoming) {
        //
        const value = incoming[key];

        if (current[key] == null || !isObject(value)) {
            //
            current[key] = value;

            continue;
        }

        mergeData(current[key], value);
    }
}

export class Props {
    //
    constructor(meta, opts = {}) {
        //
        this.meta = {};

        this.$$top = opts.emitter == null;

        opts.emitter ??= new Emitter();

        opts.pathMap ??= {};

        this.$$opts = opts;

        this.$$props = {};

        this.isProgress = false;

        Object.keys(meta).forEach((key) => {
            //
            const config = meta[key];

            if (config.type == "group") {
                //
                const props = new Props(config.children, this.$$opts);

                this.$$props[key] = {
                    get: () => props,
                    set: (value, opts) => props.$$doUpdate(value, opts),
                };

                this.meta[key] = {
                    ...config,
                    children: props.meta,
                };

                return;
            }

            const { type, value, onChange, opts = {}, ...rest } = config;

            opts.immutable = true;

            const lens = getLens(value);

            const format = config.format || getFormat(type);

            const validator = validate[type];

            const self = this;

            const p = {
                //
                get: () => lens.get(),

                set: (value, opts = {}) => {
                    //
                    // validate
                    if (opts?.preFormat) {
                        value = format.format(value);
                    }

                    if (validator) {
                        //
                        value = validator(value, config);

                        // console.log("validate", value);
                    }

                    // if (config.validate) {
                    //
                    //    value = config.validate(value);
                    //}

                    const oldVal = lens.get();

                    const newVal = format.parse(value, oldVal, opts);

                    // console.log("parse", newVal);

                    lens.set(newVal);

                    onChange?.(newVal, self.isProgress, opts);

                    return newVal;

                    // console.groupEnd();
                },
            };

            this.$$props[key] = p;

            if (Array.isArray(value) && value[0] == this.$$opts.data) {
                const path = value.slice(1);

                if (path.some((p) => typeof p != "string")) {
                    throw new Error(
                        `Props: invalid path, all must be strings  ${this.$$opts.data.id} / ${key}`
                    );
                }

                this.$$opts.pathMap[path.join(".")] = p;
            }

            const uiLens = new Lens({
                //
                getter: p.get,

                setter: (value, opts = {}) => {
                    //
                    opts.preFormat = false;

                    opts.source = "ui";

                    this.update({ [key]: value }, opts);
                },
            });

            this.meta[key] = {
                type: config.type,
                value: uiLens,
                format,
                opts,
                ...rest,
            };
        });
    }

    on(event, cb) {
        //
        this.$$opts.emitter.on(event, cb);
    }

    off(event, cb) {
        //
        this.$$opts.emitter.off(event, cb);
    }

    emit(event, payload) {
        //
        this.$$opts.emitter.emit(event, payload);
    }

    get data() {
        return this.$$opts.data;
    }

    update(payload, opts = {}) {
        //
        this.isProgress = opts?.isProgress ?? false;

        opts = { ...opts, preFormat: opts?.preFormat ?? opts.source != "ui" };

        this.$$doUpdate(payload, opts);

        this.emit("change", {
            isProgress: this.isProgress,
            source: opts?.source ?? "unknown",
        });
    }

    $$doUpdate(payload, opts) {
        //
        for (let key in payload) {
            //
            const input = payload[key];

            const prop = this.$$props[key];

            if (prop) {
                //
                prop.set(input, opts);
            }
        }
    }

    updateData(data, source = "unknown") {
        //
        this.$$doUpdateData(data, "", source === "unknown");

        mergeData(this.$$opts.data, data);

        this.emit("change", {
            isProgress: false,
            source,
        });
    }

    $$doUpdateData(data, curPath, validate) {
        //
        for (let key in data) {
            //
            const value = data[key];

            const path = curPath ? `${curPath}.${key}` : key;

            const prop = this.$$opts.pathMap[path];

            if (prop) {
                //
                let newVal = prop.set(value);

                // console.log("updateData", { path, value, newVal });

                if (validate) {
                    data[key] = newVal;
                }
                //
            } else if (isObject(value)) {
                //
                this.$$doUpdateData(value, path);
            }
        }
    }

    getPresets(presets) {
        //
        return presets.map((preset) => {
            //
            return new Preset(preset, this);
        });
    }

    dispose() {
        //
        if (this.$$wasDisposed) return;

        this.$$wasDisposed = true;

        for (let key in this.$$props) {
            //
            const prop = this.$$props[key];

            if (prop instanceof Props) {
                //
                prop.dispose();
            }
        }

        if (this.$$top) {
            //
            this.$$opts.emitter.removeAllListeners();
        }
    }
}

class Preset {
    //
    constructor(opts, props) {
        //
        this.name = opts.name;

        this.data = opts.data;

        this.image = opts.image;

        this.props = props;
    }

    apply(canUndo) {
        //
        let prevData = Preset.apply(this.data, this.props, canUndo);

        if (!canUndo) return null;

        return {
            undo: () => {
                //
                Preset.apply(prevData, this.props);
            },
            redo: () => {
                //
                Preset.apply(this.data, this.props);
            },
        };
    }

    isApplied() {
        //
        return Preset.isEqual(this.data, this.props.data);
    }

    static apply(data, props, save) {
        //
        let prevData;

        if (save) {
            //
            prevData = Preset.save(data, props.data);
        }

        props.updateData(data);

        return prevData;
    }

    static save(payload, data) {
        //
        let savedData = {};

        for (let key in payload) {
            //
            const incoming = payload[key];

            const current = data?.[key];

            if (isObject(current)) {
                //
                if (!isObject(incoming)) {
                    //
                    throw new Error("Preset.save: data mismatch");
                }

                savedData[key] = Preset.save(incoming, current);
                //
            } else {
                //
                savedData[key] = current;
            }
        }

        return savedData;
    }

    static isEqual(payload, data) {
        //

        for (let key in payload) {
            //
            const incoming = payload[key];

            const current = data[key];

            if (isObject(current)) {
                //
                if (!isObject(incoming)) {
                    console.error(
                        "Preset.isEqual: data mismatch",
                        key,
                        incoming,
                        current
                    );

                    return false;
                }

                if (!Preset.isEqual(incoming, current)) {
                    return false;
                }

                continue;
            } else if (!deepEqual(incoming, current)) {
                //
                return false;
            }
        }

        return true;
    }
}
