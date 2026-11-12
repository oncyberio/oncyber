// @ts-check

import {
    AnimationClip,
    Box3,
    BoxGeometry,
    BoxHelper,
    BufferAttribute,
    Camera,
    Color,
    EdgesGeometry,
    Euler,
    Frustum,
    InterleavedBufferAttribute,
    Light,
    LineSegments,
    Material,
    MathUtils,
    Matrix3,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    Sprite,
    Texture,
    Vector3
} from "three";
import { USER_HEIGHT } from "../constants";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";
import { LineMaterial } from '@3utils/lines/linematerial2.js';
import PipeLineLines from "../abstract/pipelinelines";
import PipeLineMesh from '@3abstract/pipelinemesh'
import PipeLineSkinnedMesh from '@3abstract/pipelineskinnedmesh'



/**
 *
 * @param { Vector3 | Euler | } o
 * @returns
 */
export function toXYZ(o) {
    return {
        x: o.x,
        y: o.y,
        z: o.z
    }
}

export function toXYZ_(o) {

    return {
        _x: o.x ?? o._x,
        _y: o.y ?? o._y,
        _z: o.z ?? o._z
    }
}

export function fromXYZ_(o) {
    return {
        x: o._x,
        y: o._y,
        z: o._z
    }
}

/**
 *
 * @param { number | import("@gltypes").XYZ } o
 * @returns
 */
export function toScale(o) {

    if(typeof o === "number") return { x: o, y: o, z: o }

    return {
        x: o.x,
        y: o.y,
        z: o.z
    }
}

 export function disposeThreeResource(resource) {

    if(resource instanceof Object3D) {

        disposeObject3D(resource)
    }
    else if(resource instanceof Material) {

        disposeMaterial(resource)
    }

    else if(resource instanceof Texture) {

        resource.dispose()
    }
    else if(resource && typeof resource.dispose === "function") {

        resource.dispose()
    }
}


export function disposeObject3D(object) {

    // Meshes can own child meshes, and disposal can detach siblings.
    for (const child of [...object.children]) disposeObject3D(child);
    if (object instanceof Mesh || object instanceof Sprite) {
        disposeMesh(object);
    } else if (object instanceof Light) {
        object.dispose();
    }

    if( object.extraDispose ){
        object.extraDispose()
    }

    // // call additional per object dispose

    // if( object._dispose ) {
    //     object._dispose()
    // }
}

const isDev = process.env.NODE_ENV === "development"

const GEO_DUMMY = isDev ? null : new PlaneGeometry(1,1)

export function disposeMesh(mesh) {
    
    if(!mesh.geometry?.userData.isShared) {

        mesh.geometry?.dispose();
        // Setting memory to null is good to hunt memory leaks
        // but in production this might lead to a crash
        mesh.geometry = GEO_DUMMY
    }

    disposeMaterial(mesh.material);

    if( mesh.destroy ){
        mesh.destroy()
    }
}

export function disposeMaterial(material) {

    // console.log(material)
    if (Array.isArray(material)) {
        material.forEach(disposeMaterial);
    } else if (material instanceof Material) {

        if(material.userData.isShared) return

        for(let key in material) {
            let value = material[key]

            if(key == 'fogTexture'){

                console.log('trying to destroy fogTexture ')

                continue;
            }

            if( key == 'envMap' && value != null ){

                // debugger
            }

            if(value && !(value.userData?.isShared) && typeof value.dispose === "function") {

                if(value instanceof Texture) {

                    // @ts-ignore
                    if( value?.renderTarget ){
                        // @ts-ignore
                        value.renderTarget.dispose()
                    }

                    // dispose bitmap
                    if( value?.source?.data?.close != null ) {

                        value.source.data.close()
                    }
                }

                value.dispose()
                material[key] = null
            }
        }

        // Node materials keep the same `uniforms` map (TSL uniform/texture nodes with .value).
        if(material.uniforms) {

            for(let key in material.uniforms) {

                let uni = material.uniforms[key]

                if(key == 'fogTexture'){

                    console.log('trying to destroy fogTexture ')

                    continue;
                }

                if (uni?.value?.userData?.isShared) continue

                if(uni?.value?.dispose) {

                    uni.value.dispose()
                }

                if( uni?.value?.renderTarget ){

                    uni.value.renderTarget.dispose()
                }

                // dispose bitmap
                if( uni?.value?.source?.data?.close != null ) {

                    uni.value.source.data.close()
                }
            }
        }

        material.dispose();

    }
}

const cameraViewProjectionMatrix = new Matrix4()

/**
 *
 * @param {PerspectiveCamera} camera
 * @param {Frustum} frustum
 * @returns
 */
export function getFrustum(camera, frustum) {

    camera.updateMatrixWorld()

    cameraViewProjectionMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse )

    frustum.setFromProjectionMatrix( cameraViewProjectionMatrix )

    return frustum

}


/**
 *
 * @param { Object3D } object
 * @returns { Scene }
 */
export function getParentScene(object) {
    let parent = object;
    while (parent.parent != null) parent = parent.parent;
    if (parent instanceof Scene) return parent;
}

const bbTarget = new Vector3()
const box3 = new Box3()
/**
 *
 * @param { Object3D } object
 * @returns {  Mesh }
 */
export function getRaycastBox(object) {

    box3.setFromObject(object)

    box3.getSize(bbTarget)

    const { x, y, z } = bbTarget

    let boxGeo = new BoxGeometry(x, y, z)

    const mesh = new Mesh(
        boxGeo,
        new MeshBasicMaterial({
            color: "#ffff00",
            opacity: 0.3,
            transparent: true,
        })
    );

    mesh.position.copy(bbTarget.addVectors(box3.min, box3.max).multiplyScalar(0.5))

    return mesh
}


let bbSize = new Vector3();
let meshScale = new Vector3()
let meshPos = new Vector3();
let bbNormalMatrix = new Matrix3();

let HANDLE_SIZE = 0.1;

/**
 *
 * @param { Mesh } mesh
 * @returns { Mesh<PlaneGeometry, MeshBasicMaterial> }
 */
export function createPreviewPlane(mesh) {
    mesh.updateMatrixWorld();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeVertexNormals();
    let box = mesh.geometry.boundingBox;

    box.getSize(bbSize);
    let arr = [bbSize.x, bbSize.y, bbSize.z];
    arr.sort((a, b) => b - a);

    let height = arr[0];
    let width = arr[1];

    let boxGeo = new PlaneGeometry(width, height);

    let boxMesh = new Mesh(boxGeo, new MeshBasicMaterial());
    boxMesh.userData.width = width;
    boxMesh.userData.height = height;
    box.getCenter(meshPos);
    meshPos.applyMatrix4(mesh.matrixWorld);
    boxMesh.position.copy(meshPos);

    // boxGeo.computeVertexNormals();
    const normAttr = mesh.geometry.attributes.normal;
    let n = new Vector3(normAttr.getX(1), normAttr.getY(1), normAttr.getZ(1));
    n.applyNormalMatrix(bbNormalMatrix.getNormalMatrix(mesh.matrixWorld));
    n.add(boxMesh.position);
    boxMesh.lookAt(n);
    boxMesh.updateMatrixWorld();
    return boxMesh;
}

/**
 *
 * @param { Mesh } mesh
 * @param { Color | number } color
 * @param { number } linewidth
 */
export function getSelectionHandle(mesh, color, linewidth = 2) {
    
    if(mesh.geometry.boundingBox == null) {

        mesh.geometry.computeBoundingBox()
    }

    const box = mesh.geometry.boundingBox;

    const boxGeo = new BoxGeometry(
        box.max.x - box.min.x,
        box.max.y - box.min.y,
        box.max.z - box.min.z
    );

    boxGeo.translate(
        (box.max.x + box.min.x) / 2,
        (box.max.y + box.min.y) / 2,
        (box.max.z + box.min.z) / 2
    );

    const edges = new EdgesGeometry(boxGeo);

    let geometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);


    if (color instanceof Color) {

        color = color.getHex()
    }

    const border = new PipeLineLines(
        geometry,
        new LineMaterial({
            color,
            linewidth,
            // depthTest: false,
            // depthWrite: false,
        }),
        {
            visibleOnOcclusion: false,
            visibleOnMirror : false
        }
    );
    

    return border;

    
}

/**
 *
 * @param { Mesh } mesh
 * @param { PerspectiveCamera } camera
 * @returns
 */
export function lookAtDistance(mesh, camera) {

    const geo = mesh.geometry

    if (geo.boundingBox == null) {

        geo.computeBoundingBox()
    }

    geo.boundingBox.getSize(bbSize)

    mesh.getWorldScale(meshScale)

    const radius =
        Math.max(
            bbSize.x * meshScale.x,
            bbSize.y * meshScale.y,
            bbSize.z * meshScale.z
        ) / 2

    // bbSize
    //     .set(
    //         bbSize.x * this.scale.x,
    //         bbSize.y * this.scale.y,
    //         bbSize.z * this.scale.z
    //     )
    //     .multiplyScalar(1.5);

    return getDistanceToFitSphere(camera, radius)

}


export function getDistanceToFitSphere(camera, radius) {

    const vFOV = camera.getEffectiveFOV() * MathUtils.DEG2RAD

    const hFOV = Math.atan(Math.tan(vFOV * 0.5) * camera.aspect) * 2

    const fov = 1 < camera.aspect ? vFOV : hFOV

    return radius / Math.sin(fov * 0.5)
}

export function getDistanceToFitBox(camera, bb) {

    const boundingRectAspect = bb.x / bb.y

    const fov = camera.fov * MathUtils.DEG2RAD

    const aspect = camera.aspect

    const heightToFit = boundingRectAspect < aspect ? bb.x : bb.y / aspect

    return (heightToFit * 0.5) / Math.tan(fov * 0.5)
}

/**
 *
 * @param { Camera } camera
 * @param { Vector3 } target
 * @returns { Vector3 }
 */
export function getCameraLocalDirection(camera, target) {

    camera.updateMatrix()

    const e = camera.matrix.elements;

	return target.set( - e[ 8 ], - e[ 9 ], - e[ 10 ] ).normalize();

}


/**
 *
 * @param { Material | Material[] } material
 * @param { number } opacity
 * @returns
 */
export function setOpacity(material, opacity) {


    if (Array.isArray(material)) {

        material.forEach(m => setOpacity(m, opacity));
    }
    else if (material instanceof Material) {

        material.opacity = opacity

        material.transparent = true

        material.needsUpdate = true

    }

}


/**
     *
     * @param { PerspectiveCamera } origin
     * @param { PerspectiveCamera } target
     */
export function copyCamera( origin, target ){

    target.position.copy( origin.position )

    target.quaternion.copy( origin.quaternion )

    target.near = origin.near

    target.far = origin.far

    target.updateProjectionMatrix()

}


let tmpPosition = new Vector3()

/**
 *
 * @param { Vector3 } point
 * @param { Camera } camera
 * @param { boolean } updateMatrix
 * @returns {{ x: number, y: number, z: number }}
 */
export function projectPoint(point, camera, updateMatrix = true) {

    if(updateMatrix) {
        camera.updateMatrixWorld(true)
    }

    tmpPosition.copy(point).project(camera)

    let widthHalf = window.innerWidth / 2

    let heightHalf = window.innerHeight / 2

    let x = (tmpPosition.x * widthHalf) + widthHalf

    let y = - (tmpPosition.y * heightHalf) + heightHalf

   return { x, y, z: tmpPosition.z }
}

// let corners = Array.from({ length: 8 }).map( _ => new Vector3())

// let [FTL, FTR, FBL, FBR, BTL, BTR, BBL, BBR] = Array.from({ length: 8 }).map((_, i) => i)

/**
 *
 * @param { Mesh } mesh
 * @param { Camera } camera

 * @returns {{ x: number, y: number, w: number, h: number }}
 **/
export function getScreenRect(mesh, camera) {

    const geo = mesh.geometry

    if (geo.boundingBox == null) {

        geo.computeBoundingBox()
    }

    let pMin = geo.boundingBox.min.clone().applyMatrix4(mesh.matrixWorld)
    let pMax = geo.boundingBox.max.clone().applyMatrix4(mesh.matrixWorld)

    let p1 = projectPoint(pMin, camera)
    let p2 = projectPoint(pMax, camera)

    return {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        w: Math.abs(p1.x - p2.x),
        h: Math.abs(p1.y - p2.y),
    }

}

const zv3 = new Vector3(0,0,1)

/**
 *
 * @param {Object3D} obj
 * @param {Vector3} target
 */
export function getObjectNormal(obj, target) {

    return target.copy(zv3).applyQuaternion(obj.quaternion)
}


/**
 *
 * @param {{ x: number, y: number, z: number }} point
 * @param { Camera } camera
 * @returns { Vector3 }
 */
 export function unprojectPoint({x, y, z}, camera) {

    camera.updateMatrixWorld(true)

    let widthHalf = window.innerWidth / 2

    let heightHalf = window.innerHeight / 2

    x = (x - widthHalf) / widthHalf

    y = -(y - heightHalf) / heightHalf

    tmpPosition.set(x, y, z).unproject(camera)

   return tmpPosition.clone()
}

/**
 *
 * @param { AnimationClip[] } animations
 *
 * @returns { Set<string> }
 */
export function getAnimatedMeshes(animations) {

    let set = new Set()

    animations.forEach(anim => {

        getMehesInAnimation(anim, set)
    })

    return set
}

/**
 *
 * @param { AnimationClip } animation
 * @param { Set<string> } set
 */
export function getMehesInAnimation(animation, set) {

    animation.tracks.forEach(track => {

        const index = track.name?.lastIndexOf(".") || -1

        if(index > 0) {

            const meshName = track.name.slice(0, index)

            set.add(meshName)
        }
    })
}



/**
 *
 * @param { Object3D } m
 * @return { m is Mesh }
 */
export function isMesh(m) {
    // @ts-ignore
    return m.isMesh
}

const dirV3 = new Vector3()

const posV3 = new Vector3()

let _obj = new Object3D()


/**
 *
 * @param { { object: Object3D, distance?: number } } opts
 * @returns
 */
export function getCoordsFromObject(opts) {


        const distance = opts.distance || 4.6

        opts.object.getWorldDirection(dirV3)

        dirV3.normalize()

        opts.object.getWorldPosition(posV3)

        const position = new Vector3()

        position
            .copy(dirV3)
            .multiplyScalar(distance)
            .add(posV3)
            .setY(USER_HEIGHT)

        _obj.position.copy(position)
        _obj.lookAt(posV3.setY(USER_HEIGHT))

        const euler = new Euler().setFromQuaternion(_obj.quaternion)

        return { position, rotation: euler }

}





const tmpV3Size = new Vector3()
const tmpBox3 = new Box3()

const boundsCache = new WeakMap()



// For now should be enough for 2D artworks
// TODO: handle 3D artworks (compute far edges??)
function get2DSize(target) {

    let bounds = boundsCache.get(target)

    if(bounds == null) {

        tmpBox3.setFromObject(target)

        const size = tmpBox3.getSize(tmpV3Size)

        bounds = { width: Math.max(size.x, size.z), height: size.y }

        boundsCache.set(target, bounds)
    }

    return bounds
}

const alignCoef = {
    left: -1,
    right: 1,
    center: 0,
    top: 1,
    bottom: -1
}





/**
 * @typedef {object} SnapOptions
 * @property {"left" | "right" | "center"} [horz]
 * @property {"top" | "bottom" | "center"} [vert]
 * @property { Vector3 } [axis]
 * @property {number} [horzOffset]
 * @property {number} [vertOffset]
 * @property {number} [offset]
 *
 *
 * @param {Object3D} target
 * @param {Object3D} object
 * @param {SnapOptions} [opts]
 */
export function snap(target, object, opts = {}) {

    const { horz = "right", vert = "center" } = opts;

    const { horzOffset = opts.offset ?? 0, vertOffset = opts.offset ?? 0 } = opts;

    const targetSize = get2DSize(target);

    const sourceSize = get2DSize(object)

    const offset = new Vector3();

    offset.x = targetSize.width / 2 + sourceSize.width / 2 + horzOffset

    offset.y = targetSize.height / 2 + sourceSize.height / 2 + vertOffset

    if(opts.axis) {

        offset.x *= opts.axis.x

        offset.y *= opts.axis.y

    }
    else {

        offset.x *= alignCoef[horz];

        offset.y *= alignCoef[vert];

        offset.applyQuaternion(target.quaternion);
    }



    object.position.copy(target.position).add(offset);

    object.quaternion.copy(target.quaternion);
}

const occlusionMaterial = new MeshBasicMaterial({ color: 0x000000 });

function cloneAnimations(sourceAnimations) {
  const clonedAnimations = [];

  sourceAnimations.forEach((sourceClip) => {
    const clonedClip = THREE.AnimationClip.parse(JSON.parse(JSON.stringify(sourceClip.toJSON())));
    clonedAnimations.push(clonedClip);
  });

  return clonedAnimations;
}

export function upgradeObject( object, animations ) {

    try {

        const meshesToReplace = []

        object.traverse((val) => {

            if(val.isMesh){

                meshesToReplace.push(val)
            }
        })


        const meshMap = new Map();

        let i = 0

        while(i < meshesToReplace.length ) {

            const torp = meshesToReplace[i]

              if (torp.isMesh) {
                let newMesh;

                if (torp.skeleton !== undefined) {
                  newMesh = new PipeLineSkinnedMesh(
                    torp.geometry,
                    torp.material,
                    {
                      occlusionMaterial: occlusionMaterial,
                      visibleOnOcclusion: true,
                      visibleOnMirror: false,
                    }
                  );

                  // Bind skeleton and matrices
                  newMesh.bind(torp.skeleton, torp.matrixWorld);
                  newMesh.skeleton = torp.skeleton;
                  newMesh.bindMatrix.copy(torp.bindMatrix);
                  newMesh.bindMatrixInverse.copy(torp.bindMatrixInverse);
                } else {
                  newMesh = new PipeLineMesh(
                    torp.geometry,
                    torp.material,
                    {
                      occlusionMaterial: occlusionMaterial,
                      visibleOnOcclusion: true,
                    }
                  );
                }

                // Copy properties from the original mesh
                newMesh.position.copy(torp.position);
                newMesh.rotation.copy(torp.rotation);
                newMesh.scale.copy(torp.scale);
                newMesh.name = torp.name;
                newMesh.receiveShadow = true;

                // Store the new mesh and its parent relationship
                meshMap.set(newMesh, {
                  parent: torp.parent,
                  children: torp.children,
                });

                // Add the new mesh to its parent
                const parent = torp.parent;
                parent.add(newMesh);

                // Remove the original mesh from its parent
                parent.remove(torp);
              }

            i++
        }


        // Clean up references and data from the original meshes
        meshMap.forEach((value, oldMesh) => {
          // Dispose or perform any necessary cleanup operations on the old mesh
          // For example: oldMesh.geometry.dispose(), oldMesh.material.dispose(), etc.

          // Reparent the children of the original mesh to the new mesh
          value.children.forEach((child) => {
            oldMesh.add(child);
          });
        });

        console.log(object)

    }

    catch(e){

        console.log( e )
    }

}