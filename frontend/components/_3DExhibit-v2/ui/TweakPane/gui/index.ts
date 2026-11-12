import React from "react";
import emitter from "events";
import { Controller } from "./controller";
import { Panel } from "../components/Panel";
import { createRoot } from "react-dom/client";
import { LIST_CONTROLLERS } from "../constants";
import { GUIParams, ControlType, ControlSettings, ControllerCallback } from "../types";

export default class GUI {
    public container: HTMLElement = null;

    private _emitter = new emitter();
    public emit = this._emitter.emit.bind(this._emitter);
    public on = this._emitter.on.bind(this._emitter);
    public off = this._emitter.off.bind(this._emitter);
    public once = this._emitter.once.bind(this._emitter);

    public params: GUIParams = null;
    public needsUpdate: boolean = false;
    public folders: Record<string, any> = {};
    public static needsUpdate = false;
    public visible = true;

    _onVisibleChange = null;
    _onCheckChange = null;

    constructor(params: GUIParams, public listens = []) {
        this.params = params;
        this.params.visible = params.visible ?? true;
    }

    add<O extends object, P extends keyof O>(target: O, propName: P, name?: string, onUpdate?: ControllerCallback<O[P]>, component?: ControlType): Controller<O[P]>;
    add<O extends object, P extends keyof O>(target: O, propName: P, items?: number[], onUpdate?: ControllerCallback<O[P]>, component?: ControlType): Controller<O[P]>;
    add<O extends object, P extends keyof O>(target: O, propName: P, items?: string[], onUpdate?: ControllerCallback<O[P]>, component?: ControlType): Controller<O[P]>;
    add<O extends object, P extends keyof O>(target: O, propName: P, items?: Array<{ id: string; name: any }>, onUpdate?: ControllerCallback<O[P]>, component?: ControlType): Controller<O[P]>;
    add<O extends object, P extends keyof O>(target: O, propName: P, min?: number, max?: number, step?: number, component?: ControlType): Controller<O[P]>;
    add(target: Object, propName: string, itemsNameStatusMin?: any, maxFunction?: any, stepComponent?: any): Controller {
        const controller: ControlSettings = { propName, target };

        if (typeof target[propName] === "function") {
            controller.componentType = LIST_CONTROLLERS.BUTTON;
        } else if (typeof target[propName] === "boolean") {
            controller.componentType = LIST_CONTROLLERS.SWITCH;
        } else if (typeof itemsNameStatusMin === "number") {
            controller.min = itemsNameStatusMin;
            controller.componentType = LIST_CONTROLLERS.RANGE;
        } else if (Array.isArray(itemsNameStatusMin)) {
            controller.items = itemsNameStatusMin;
            controller.componentType = LIST_CONTROLLERS.LIST;
        } else if (target[propName].hasOwnProperty("x") && target[propName].hasOwnProperty("z")) {
            controller.componentType = LIST_CONTROLLERS.Vector;
        }

        if (typeof itemsNameStatusMin === "string") {
            controller.name = itemsNameStatusMin;
        } else {
            controller.name = propName;
        }

        if (maxFunction) {
            if (typeof maxFunction === "number") {
                controller.max = maxFunction;
                controller.componentType = LIST_CONTROLLERS.RANGE;
            } else {
                controller.onUpdate = maxFunction;
            }
        }

        if (stepComponent) {
            if (typeof stepComponent === "number") {
                controller.step = stepComponent;
                controller.componentType = LIST_CONTROLLERS.RANGE;
            } else {
                controller.componentType = stepComponent;
            }
        }

        const intance = new Controller(controller, this.params.name, this.listens, this.folders);

        this.folders[propName] = intance;

        GUI.forceUpdate();

        return intance;
    }

    static forceUpdate() {
        this.needsUpdate = true;
    }

    addFolder = (name: string): GUI => {
        if (this.folders[name]) {
            return this.folders[name];
        }
        const gui = new GUI({ name }, this.listens);
        this.folders[name] = gui;
        GUI.forceUpdate();
        return gui;
    };

    getFolder = (name: string): GUI => {
        return this.folders[name];
    };

    removeFolder = (name: string): GUI => {
        const gui = this.folders[name];
        this.folders[name] = null;
        GUI.forceUpdate();
        return gui;
    };

    checkable = (b = true) => {
        this.params.checkable = b;
        return this;
    };

    group = (b = true) => {
        this.params.grouped = b;
        return this;
    };

    setVisible = (b: boolean, trigger = true) => {
        if (b === this.visible) return this;
        this.visible = b;
        GUI.forceUpdate();
        if (trigger) this._onVisibleChange?.(this.visible);
        return this;
    };

    toggle = (b: boolean) => {
        if (b === this.params.visible) return this;
        this.params.visible = b;
        GUI.forceUpdate();
        //if (options?.trigger) this._onVisibleChange?.(this.params.visible);
        return this;
    };

    onVisibleChange = (cb: (b: boolean) => unknown) => {
        this._onVisibleChange = cb;
        return this;
    };

    onCheckChange = (cb: (b: boolean) => unknown) => {
        this._onCheckChange = cb;
        return this;
    };

    mount(opts: any = {}) {
        if (this.container != null) return;

        this.container = document.createElement("div");
        this.container.id = `gui-container-${Date.now()}`;
        this.container.style.position = "relative";
        document.body.appendChild(this.container);

        const element = React.createElement(Panel, {
            onSubmit: opts.onSubmit,
            btnName: opts.buttonName,
            folders: this.folders,
            listens: this.listens,
            params: this.params,
        });

        const root = ((this.container as any).$GUI_ROOT = createRoot(this.container));

        root.render(element);
    }

    unmount() {
        if (this.container == null) return;

        (this.container as any).$GUI_ROOT.unmount();
        document.body.removeChild(this.container);
    }
}
