import {
    Vector3,
    ControlType,
    ControlSettings,
    ControllerCallback,
    FileSettings,
} from "../types";
import GUI from "./index";
import { progressWidth } from "@utils/js";
import { LIST_CONTROLLERS } from "../constants";

export class Controller<T = any> {
    public readonly settings: ControlSettings<T> = null;
    public dom = new Set<HTMLInputElement>();
    public currentDomElement = null;
    private preValue = undefined;
    public isToggled = false;

    constructor(
        controller: ControlSettings<T>,
        public rootFolder: string,
        private listens: Array<Controller<unknown>>,
        public folders: Record<string, any>
    ) {
        this.settings = { ...this.settings, ...controller };
        this.settings.visible = true;
    }

    name = (value: string) => {
        this.settings.name = value;
        return this;
    };

    label = (value: string) => {
        this.settings.label = value;
        return this;
    };

    onChange = (callback: ControllerCallback<T>) => {
        this.settings.onChange = callback;
        return this;
    };

    listen = () => {
        this.listens.push(this);
        return this;
    };

    update = (
        target: Object,
        propName: string,
        newValueItems: number | string | boolean | string[] | number[]
    ) => {
        const element = this.currentDomElement;

        if (
            typeof newValueItems === "string" ||
            typeof newValueItems === "number" ||
            typeof newValueItems === "boolean"
        ) {
            target[propName] = newValueItems;
            this._updateDom(element, newValueItems);
        } else if (Array.isArray(newValueItems)) {
            for (let i = element?.options?.length - 1; i >= 0; i--) {
                element?.remove?.(i);
            }

            let selectedIndex = 0;

            for (let i = 0; i < newValueItems.length; i++) {
                const option = document.createElement("option");
                const currentItem = newValueItems[i];
                option.text = currentItem.toString();
                option.value = currentItem.toString();
                if (target[propName] == currentItem) {
                    selectedIndex = i;
                }
                element?.add?.(option);
            }

            if (element?.selectedIndex && selectedIndex) {
                element.selectedIndex = selectedIndex;
            }
        }
    };

    component = (type: ControlType) => {
        this.settings.componentType = type;
        return this;
    };

    min = (n: number | Vector3) => {
        this.settings.min = n;

        if (typeof n === "number") {
            this.settings.componentType = LIST_CONTROLLERS.RANGE;
        }

        return this;
    };

    max = (n: number | Vector3) => {
        this.settings.max = n;

        if (typeof n === "number") {
            this.settings.componentType = LIST_CONTROLLERS.RANGE;
        }

        return this;
    };

    step = (n: number | Vector3) => {
        this.settings.step = n;

        if (typeof n === "number") {
            this.settings.componentType = LIST_CONTROLLERS.RANGE;
        }

        return this;
    };

    addColor = (value: string) => {
        this.settings.color = value;
        this.settings.componentType = LIST_CONTROLLERS.COLOR_PICKER;
        return this;
    };

    setVisible = (b: boolean) => {
        if (b === this.settings.visible) return this;
        this.settings.visible = b;
        GUI.forceUpdate();
        return this;
    };

    setFileSettings = (b: FileSettings) => {
        this.settings.fileOpts = b;
        return this;
    };

    onUpdate = (callback: ControllerCallback<T>) => {
        if (!this.settings?.onUpdate) {
            this.settings.onUpdate = callback;
        }
        return this;
    };

    onFinishChange = (callback: ControllerCallback<T>) => {
        if (!this.settings?.onFinishChange) {
            this.settings.onFinishChange = callback;
        }
        return this;
    };

    remove = () => {
        delete this.folders[this.settings.propName];
        GUI.forceUpdate();
    };

    _updateDom = (element, value) => {
        if (this.settings.componentType === LIST_CONTROLLERS.RANGE) {
            const children = element?.childNodes;
            for (let i = 0; i < children.length; i++) {
                const current = children[i];
                if (current.type === "range") {
                    const background = current?.getAttribute("data-bg");
                    const progressColor = current?.getAttribute(
                        "data-progress-color"
                    );
                    current.value = value;
                    current.min = this.settings.min || 0;
                    current.max = this.settings.max || 100;
                    current.step = this.settings.step || 1;
                    current.style.background = `linear-gradient(to right, ${progressColor} 0%, ${progressColor} ${progressWidth(
                        current.value,
                        current.min,
                        current.max
                    )}%, ${background} ${progressWidth(
                        current.value,
                        current.min,
                        current.max
                    )}%, ${background} 100%)`;
                } else {
                    current.value = value;
                }
            }
        } else if (this.settings.componentType === LIST_CONTROLLERS.SWITCH) {
            element.checked = value;
        } else if (
            this.settings.componentType === LIST_CONTROLLERS.COLOR_PICKER
        ) {
            const children = element?.childNodes;
            for (let i = 0; i < children.length; i++) {
                const current = children[i];
                if (current.id === "SelectedColor") {
                    current.textContent = value;
                    current.style.backgroundColor = value;
                } else if (current.id === "ColorPickerWrapper") {
                    current?.setAttribute?.("color", value);
                }
            }
        }
    };

    updateDisplays = () => {
        const value = this.settings.target[this.settings.propName];

        if (this.preValue !== undefined && this.preValue === value) {
            return;
        }

        this.dom.forEach((element) => {
            element.value = value;
            this._updateDom(element, value);
        });

        this.preValue = value;
    };
}
