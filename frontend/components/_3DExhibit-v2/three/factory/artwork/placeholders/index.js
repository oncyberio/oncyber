// @ts-check

import { BoxGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'

import Loader from '@3loader'

import { TYPES } from '@3artwork/constants'

import PlaceHolderMaterial from "./placeholdermaterial"

import { SpacePlaceholder } from './spaceplaceholder'
import { createPreviewPlane } from '@components/_3DExhibit-v2/three/utils/three'

import PipelineMesh from '@3abstract/pipelinemesh'

import scene from '@components/_3DExhibit-v2/three/scene'
import root from '@components/_3DExhibit-v2/three/root'


export const defaultPlaceholderSize = [1, 1, 0.1]

const basicblack = new MeshBasicMaterial({color: 0x000000 })


const texture = Loader.loadImageTextureSync(`/images/textures/placeholder.png`)

const pos = new Vector3()
const quat = new Quaternion()
const scale = new Vector3()

class PlaceholderFactory {

    /**
     * @param { import('@gltypes').SpaceStateOptions } opts
     * @param { string } placeholderId
     * @returns
     */
    getPlaceholder(opts, placeholderId) {

        const size = opts.roomParameters.placeholderSize || defaultPlaceholderSize

        const material = new PlaceHolderMaterial({
            map: texture,
            ratio: size[0] / size[1]
        })

        const mesh = new PipelineMesh(
            new BoxGeometry(size[0], size[1], size[2]),
            material,
            {
                visibleOnMirror : false,
                occlusionMaterial : basicblack
            }
        )

        let spacePlaceholder = new SpacePlaceholder({
            ...opts,
            type: TYPES.PLACEHOLDER,
            placeholderId,
            item: null,
            mesh,
            raycastMesh: mesh,
            resources: [mesh]
        })

        spacePlaceholder.userData.id = placeholderId



        spacePlaceholder.add(mesh)

        return spacePlaceholder;
    }
    /**
     *
     * @param { import('@gltypes').ItemFactoryOptions } opts
     * @returns { SpacePlaceholder[] }
     */
    get(opts) {

        let spacePlaceholders = []

        opts.space.placeholders
            .forEach((gltfPlaceholder, index) => {

            let mesh = gltfPlaceholder;

            if (gltfPlaceholder instanceof Mesh) {

                // We plane
                if (gltfPlaceholder.geometry.attributes.position.count === 4) {

                    mesh = createPreviewPlane(gltfPlaceholder)

                    mesh.scale.copy(gltfPlaceholder.scale);
                }
            }

            const pl = this.getPlaceholder(opts, String(index))

            mesh.updateMatrixWorld(true)

            gltfPlaceholder.getWorldPosition(pos)

            mesh.getWorldQuaternion(quat)

            gltfPlaceholder.getWorldScale(scale)

            // mesh.matrixWorld.decompose(pos, quat, scale)

            pl.position.copy(pos)

            pl.quaternion.copy(quat)


            if (opts.roomParameters.version === 1) {
                pl.scale.copy(new Vector3(1, 1, 1))

            } else {
                pl.scale.copy(scale)

            }

            spacePlaceholders.push(pl)
        });

        for (let i = 0; i < opts.space.placeholders.length; i++) {

            opts.space.placeholders[i] = spacePlaceholders[i];
        }

        return spacePlaceholders;
    }
}

export default new PlaceholderFactory()
