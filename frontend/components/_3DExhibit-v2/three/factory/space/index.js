// @ts-check
import SpaceFuture from './kits/kitbash'

import SpaceClassic from './kits/classic'

import ComponentManager from './componentManager';

import { KitbashWrapper } from './kits/kitbash/kitbashwrapper';
import SpaceFactoryAbstract from '../abstract/spacefactory';
import { updateRoomFromData } from './roomdatacompat';



async function overrideRoomParameters( opts ) {

    const { roomParameters, exhibit } = opts

    const { roomParameters: exhibitRoomParameters } = exhibit?.info || {};

    if (exhibitRoomParameters?.sky) {

        opts.roomParameters = {
            ...roomParameters,
            ...exhibitRoomParameters.sky
        }
    }

    if( opts.roomParameters.background_type == null ) {

        opts.roomParameters.background_type = 'color'
    }

    // if background map is legacy not defined
    if( opts.roomParameters.backgroundMap == null && ( opts.roomParameters.envMap != null &&  opts.roomParameters.envMap != "" && Object.keys(opts.roomParameters.envMap).length != 0 )  ){

        opts.roomParameters.backgroundMap = opts.roomParameters.envMap

        opts.roomParameters.background_type = 'image'
    }


    if (Object.values(exhibit.kitbash ?? {}).length > 0) {

        updateRoomFromData( opts.roomParameters, exhibit.kitbash )
    }
}

class SpaceFactory extends SpaceFactoryAbstract {

    /**
     * @typedef { import('@gltypes').SpaceData } SpaceData
     *
     *
     * @param { import('@gltypes').World3DOptions } opts
     * @returns { Promise<SpaceData> }
     */
     async get(opts){

        const isNewUpload = opts.roomParameters.uPath?.fileURL != null

        overrideRoomParameters(opts);

        /** @type { SpaceData } */
        let spaceData;

        let kitbashData = opts.exhibit.kitbash || {}

        let kit = opts.roomParameters.slug

        let futureOpts = {
            ...opts,
            kit,
            data: kitbashData
        }

        let kitbashWrapper

        if( opts.roomParameters.isFuture ){

            spaceData = await SpaceFuture.get(futureOpts)

            kitbashWrapper = spaceData.kitbash

            if (isNewUpload) {

                futureOpts.data = kitbashWrapper.data
            }
        }
        else {

            spaceData = await SpaceClassic.get(opts)

            futureOpts.kit = '@@cyber/classic'

            kitbashWrapper = new KitbashWrapper({
                ...futureOpts,
                types: {},
            })    
        }

        spaceData.kitbash = new ComponentManager({
            ...futureOpts,
            space: spaceData,
            kitbashWrapper
        })

        await spaceData.kitbash.build()

        spaceData.kitbash.components.forEach((component) => {

            component.getBBox( spaceData.bbox )
        })


        let far = this.getFarValue(spaceData.scene, spaceData.bbox )

        let fog = this.getFog( spaceData.background, far, opts )

        spaceData.scene.fog = fog



        return spaceData
    }

}

export default new SpaceFactory()
