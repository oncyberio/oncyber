// @ts-check


import {

	RE_PORTAL_PREVIEW

} from '@3constants'

import { Mesh } from 'three'

import { PortalPreviewMesh } from '../previewmesh'


class PortalPlaceholderFactory {

    /**
     *
     * @param { import('@gltypes').GLTF } room
     * @returns { import('@gltypes').PortalPlaceholderData[] }
     */
	get(room, portalMeshes){

        /** @type { import('@gltypes').PortalPlaceholderData[] } */
        const portalPlaceholders = []

        const portalNode = room.scene.getObjectByName('portal')

        const animations = room.animations.slice()

        room.animations = room.animations.filter((animation) => {
            return !animation.name.toLowerCase().startsWith("portal");
        });

        let index = 0

        if(portalNode != null ) {

            portalNode.traverse((mesh) => {

                let match = RE_PORTAL_PREVIEW.exec(mesh.name);

                if (mesh instanceof Mesh && match != null) {


                    // Clear mesh

                    // mesh.updateMatrix();

                    // mesh.geometry.applyMatrix( mesh.matrix );

                    // mesh.matrix.identity();

                    // mesh.geometry.verticesNeedUpdate = true;

                    // mesh.scale.set( 1, 1, 1 );

                    // mesh.position.set(0,0, 0);

                    // mesh.rotation.set(0,0, 0);

                    const portalId = mesh.name

                    // let portalMesh = scene.getObjectByName(
                    //     `Portal_Mesh_${match[3]}`
                    // )

                    // let portalDoor = scene.getObjectByName(
                    //     `Portal_Door_${match[3]}`
                    // )


                    let portalMesh = portalMeshes[`Portal_Mesh_${match[3]}`]

                    let portalDoor = portalMeshes[`Portal_Door_${match[3]}`]

                    index++

                    let openAnimations = animations.filter((animation) => {
                        return animation.name.includes(`Portal_Open_${match[3]}`);
                    });

                    let closeAnimations = animations.filter((animation) => {
                        return animation.name.includes(`Portal_Close_${match[3]}`);
                    });

                    let previewMesh = PortalPreviewMesh.createFromPlaceholder(mesh)

                    previewMesh.name = `${mesh.name}-preview-box`

                    // const helper2 = new VertexNormalsHelper(
                    //     previewBox,
                    //     2,
                    //     0x0000ff
                    // );

                    // object.scene.add(helper2);

                    // const helper = new VertexNormalsHelper(
                    //     previewMesh,
                    //     2,
                    //     0x00ff00
                    // );

                    // object.scene.add(helper);

                    portalPlaceholders.push({
                        portalId,
                        meshes : {
                            originalPreviewMesh: mesh,
                            previewMesh,
                            portalMesh,
                            portalDoor

                        },
                        animations: {
                            open: openAnimations,
                            close: closeAnimations
                        }
                    })
                }

            })

            portalNode.parent?.remove(portalNode)
        }


        return portalPlaceholders
	}
}

export default new PortalPlaceholderFactory()
