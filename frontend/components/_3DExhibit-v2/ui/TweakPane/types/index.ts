import { LIST_CONTROLLERS } from "../constants";

export interface GUIParams {
    //
    visible?: boolean | undefined;

    checkable?: boolean | undefined;

    grouped?: boolean | undefined;

    checked?: boolean | undefined;

    name: string | undefined;

    width?: number | undefined;

    position?: Partial<{
        top: number;
        left: number;
        bottom: number;
        right: number;
    }>;
}

export interface ControlSettings<T = any> {
    //
    target: any;
    propName: string;

    visible?: boolean;
    onChange?: ControllerCallback<T>;
    onUpdate?: ControllerCallback<T>;
    onFinishChange?: ControllerCallback<T>;

    name?: string;
    label?: string;
    componentType?: ControlType;
    min?: number | Vector3;
    max?: number | Vector3;
    step?: number | Vector3;
    color?: string;
    items?: number[] | string[];

    fileOpts?: FileSettings;
}

export type FileSettings = {
    maxSize?: number;
    dimensions?: {
        width: number;
        height: number;
    };
    extension?: string[];
};

export type Callback = (value: any) => void;
export type ListControllers = typeof LIST_CONTROLLERS;
export type ControllerCallback<T> = (v: T) => unknown;
export type Vector3 = { x?: number; y?: number; z?: number };
export type ControlType = ListControllers[keyof ListControllers];
