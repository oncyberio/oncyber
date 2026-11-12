import { SpaceArtworkOptions, SpaceItemOptions } from "@gltypes";
import { Material, Mesh } from "three";


export interface SpacePlaceholderOptions extends SpaceArtworkOptions {
    placeholderId: string;
    mesh: Mesh
}
