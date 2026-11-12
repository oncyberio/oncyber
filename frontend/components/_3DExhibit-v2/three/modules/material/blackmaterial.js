import { MeshBasicMaterial } from "three";

class BlackMaterial extends MeshBasicMaterial {
    constructor() {
        /** @type { import("three").MeshBasicMaterialParameters } */
        let opts = {
            color: 0x000000,
            fog: false,
            toneMapped: false
        };

        super(opts)

        this.userData.isShared = true
    }
}

export default new BlackMaterial()
