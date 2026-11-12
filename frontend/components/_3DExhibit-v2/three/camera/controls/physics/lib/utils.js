// @ts-check

import { isMesh } from "@components/_3DExhibit-v2/three/utils/three";

import { Box3, Object3D, Vector3 } from "three";
import { OctreeTriangle } from "./octreetriangle";


const _v1 = new Vector3();

const _v2 = new Vector3();

export function splitBox(box1, factory) {

    const subTrees = [];

    const halfsize = _v2
        .copy(box1.max)
        .sub(box1.min)
        .multiplyScalar(0.5);

    for (let x = 0; x < 2; x++) {

        for (let y = 0; y < 2; y++) {

            for (let z = 0; z < 2; z++) {

                const box = new Box3();
                
                const v = _v1.set(x, y, z);

                box.min.copy(box1.min).add(v.multiply(halfsize));
                
                box.max.copy(box.min).add(halfsize);

                subTrees.push(new factory(box));
            }
        }
    }

    return subTrees;
}

/**
 *
 * @param { Object3D } group
 * @param { OctreeTriangle[] } tris
 * @returns
 */
export function genTrianglesFromObject(group, tris = []) {

    let vs = Array(3)

    group.traverse((obj) => {

        if (isMesh(obj)) {

            let geometry = obj.geometry

            const meshName = obj.name


            if (obj.geometry.index !== null) {


                const indices = geometry.index.array

                const attribute = geometry.getAttribute("position")
                const itemSize = attribute.itemSize
                const array = attribute.array


                // @ts-ignore
                const isInterleaved = attribute.isInterleavedBufferAttribute


                let index = 0

                for (let i = 0; i < indices.length; i += 3) {

                    for(let off = 0; off < 3; off++) {

                        let j = i + off

                        if ( isInterleaved ) {

                            // @ts-ignore
                            index = indices[ j ] * attribute.data.stride + attribute.offset;

                        } else {

                            index = indices[ j ] * itemSize;

                        }

                        const v = new Vector3(array[index], array[index + 1], array[index + 2])

                        vs[off] = v
                    }

                    const tri = new OctreeTriangle(vs[0], vs[1], vs[2], meshName)

                    tri.applyMatrix4(obj.matrixWorld)

                    tris.push(tri)
                }

            } else {

                const positionAttribute = geometry.getAttribute("position");

                for (let i = 0; i < positionAttribute.count; i += 3) {
                    const v1 = new Vector3().fromBufferAttribute(
                        positionAttribute,
                        i
                    );
                    const v2 = new Vector3().fromBufferAttribute(
                        positionAttribute,
                        i + 1
                    );
                    const v3 = new Vector3().fromBufferAttribute(
                        positionAttribute,
                        i + 2
                    );

                    const tri = new OctreeTriangle(v1, v2, v3, meshName)

                    tri.applyMatrix4(obj.matrixWorld)

                    tris.push(tri)
                }
            }
        }
    });

    return tris;
}


/**
 *
 * @param { Object3D[] } groups
 */
export function genTriangles(groups) {

    /** @type { OctreeTriangle[] } */
    let tris = []

    for (let i = 0; i < groups.length; i++) {

        const g = groups[i];

        // Static collision can be built before the first render. Bake current
        // authored transforms without changing the dynamic collider lifecycle.
        g.updateWorldMatrix(true, true);

        genTrianglesFromObject(g, tris)
    }

    return tris;
}