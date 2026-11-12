// @ts-check

import { Line2 } from '@3utils/lines/Line2'
import { LineGeometry } from '@3utils/lines/LineGeometry'
import { LineMaterial } from '@3utils/lines/LineMaterial'
import { Vector3, LineSegments, LineBasicMaterial, BufferGeometry, Mesh, Vector2 } from 'three'

import PipeLineLines from '@3abstract/pipelinelines'

import Shared from '@3shared'

/**
 * @extends {Line2<LineGeometry, LineMaterial>}
 */

let occlusionMaterial =  
    new LineMaterial({
        transparent: true,
        color: "#000000",
        fog: false,
        toneMapped: false,
        resolution: Shared.resolution.value,
})

occlusionMaterial.color.setHex( 0x000000 );

export class Line extends PipeLineLines {

    /**
     *
     * @param { Vector3[] } points
     * @param { Partial<import('three').LineBasicMaterialParameters> } opts
     */
    constructor(
        points,
        opts
    ) {



        let geometry = new LineGeometry()

        const vertices = points.flatMap(v => [v.x, v.y, v.z])
        geometry.setPositions(vertices)


        let material = new LineMaterial({
            transparent: true,
            // depthTest: false,
            fog: false,
            toneMapped: false,
            // vertexColors: true,
            resolution: Shared.resolution.value,
            ...opts
        })


        super(geometry, material, {

            
            visibleOnOcclusion: true,
            visibleOnMirror: false,
            occlusionMaterial: occlusionMaterial

        })

        this.computeLineDistances()
        this.scale.set(1, 1, 1)


        this.frustumCulled = false

        this.renderOrder = Infinity
    }
}
