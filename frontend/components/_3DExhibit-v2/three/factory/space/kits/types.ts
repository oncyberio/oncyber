import type { Component3D } from "./abstract";


export type Component3DFactory = typeof Component3D

export interface PresetData {
    name: string;
    image: string;
    data: any;
}

export interface ComponentOption {
    type: "@@Component";
    factory: Component3DFactory;
    preset?: PresetData;
}

export interface GroupOption {
    type: "@@Group";
    name: string;
    image: string;
    components: FactoryOption[];
}

export type FactoryOption = ComponentOption | GroupOption;