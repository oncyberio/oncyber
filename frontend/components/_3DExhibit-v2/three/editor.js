// @ts-check


import { CURRENT_SPACE } from "./constants.js"

import States from "./states.js"


export default class EditorApi {

	constructor() {}

    /**
     * @template {import('./factory/editor/actions').EDITOR_ACTION} A
     *
     * @param {A} opts
     * @returns {import('./factory/editor/actions').EditorReturnType[A["type"]]}
     */
	edit( opts ){

		return States.edit(opts.type, opts)
	}

    getFutureWrapper() {
        //
        return CURRENT_SPACE?.space?.kitbash
    }

    createDefaultComponents() {
        //
        CURRENT_SPACE.space.kitbash.createDefaultComponents()
    }

    memo = new WeakMap()

    /**
     * @typedef {object} KitBashTypeInfo
     * @property {string} type
     * @property {string} img
     *
     *
     * @returns { Array<KitBashTypeInfo> }
     *
     */
    getKitBashTypes() {

        const kitbash = CURRENT_SPACE.space.kitbash.kitbashWrapper

        if(kitbash == null) return null

        /** @type { Array<KitBashTypeInfo> } */
        let result = this.memo.get(kitbash)

        if(result == null) {


            result = []

            Object.keys(kitbash.types).forEach(type => {

                result.push( {

                    type,
                    img: kitbash.types[type].previewImg
                })
            })

            this.memo.set(kitbash, result)
        }

        return result
    }

    /**
     *
     * @returns { import("@uitypes/experience.js").Experience['kitbash'] }
     */
    getKitBashData(reset = false) {

        const kitbash = CURRENT_SPACE.space.kitbash

        if(kitbash == null) return null

        return reset ? kitbash.getDefaultData() : kitbash.getCurrentData()
    }

    /**
     *
     * @returns { import("@gltypes").SpaceData['kitbashImgs'] }
     */
    getKitbashImages() {

        if(CURRENT_SPACE.roomParameters?.isFuture) {

            // const KitBuilder = (await import('@3factory/space/kits/kitbash/kitbuilder.js')).default

            // const img = await KitBuilder.bakeAssets( CURRENT_SPACE.space.scene )

            // @ts-ignore
            return CURRENT_SPACE?.space?.kitbashImgs;
        }

        return null

    }

    toggleMapControls(opts) {

        return States.toggleMapControls(opts)
    }
}
