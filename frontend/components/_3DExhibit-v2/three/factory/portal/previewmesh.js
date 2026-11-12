
// @ts-check

import {

    BufferGeometry,

    CircleGeometry,

    Euler,

    Texture,

    LinearMipMapLinearFilter,

    LinearFilter,

    Matrix3,

    Mesh,

    MeshBasicMaterial,

    PlaneGeometry,

    Quaternion,

    SRGBColorSpace,

    Vector3,

    Material
} from "three"

import gsap from "gsap"

import Loader from '@3loader'

import Camera from "@3camera"

import { disposeMaterial, disposeObject3D } from "@3utils/three";

import InfoPreviewTexture from './textures/infopreviewtexture'

import InfoOpenTexture from '@3portal/textures/infoopentexture'

import Three60Material from './material/360/index.js'

import { CURRENT_SPACE, EDIT_MODE } from "../../constants";

import TwoDMaterial from "./material/2d";

import { STATES } from "./constants";

import PipeLineMesh from "@3abstract/pipelinemesh";

import TVNoiseMaterial from '@3modules/material/tvnoisematerial'

import Blackmaterial from '@3modules/material/blackmaterial'

import Starfield from '@3modules/starfield'

import infopreviewtexture from "./textures/infopreviewtexture";

import loader from "@3loader";

import PortalInfoRenderer from '@3gl/renderer/portalinfo.js'

import { CHECK_ABORT_SIGNAL, combineAbortSignals, IS_ABORT_ERROR } from "@3utils/abort";


import {

    IS_MOBILE

} from '@3constants'

import imageCache from "@3utils/imagecache"

import { cloudinary, resize } from '@utils/urlUtils'


let bbSize = new Vector3();
let meshPos = new Vector3();
let bbNormalMatrix = new Matrix3();


const tempQuat = new Quaternion()

const tmpEuler = new Euler(0, 0, 0, 'YXZ')




export const PORTAL_SHAPES = {
    RECTANGLE: /** @type {const} */ ("rectangle"),
    CIRCLE: /** @type {const} */ ("circle")
}

function createGeometry(opts) {

    if(opts.type === PORTAL_SHAPES.RECTANGLE) {

        return new PlaneGeometry(opts.width, opts.height)
    }
    else if(opts.type === PORTAL_SHAPES.CIRCLE) {

        return new CircleGeometry(opts.radius, opts.segments || 32)
    }
}


export class PortalPreviewMesh extends PipeLineMesh {

    constructor(opts) {

        super(createGeometry(opts), Blackmaterial, {

            occlusionMaterial: new MeshBasicMaterial({color: 0x000000}),

            visibleOnMirror: false,

            overrideOcclusionMaterial :  new MeshBasicMaterial({color: 0x000000})
        })

        this.geometry.computeBoundingBox()

        /**@type { import("./portal").Portal }  */
        this.portal = null

        this.opts = opts

        this.dissolve = false

        this._worldPosition = null



        this.abortController = new AbortController()

        this.abort = combineAbortSignals([ this.abortController.signal, this.opts.abort ])

        this.opts.abort?.addEventListener(

            "abort",

            () => { this.dispose() },

            { once: true }
        )
    }

    CHECK_ABORT() {

        CHECK_ABORT_SIGNAL(this.abort)
    }

    get aspect() {

        let scaleAspect = this.scale.x / this.scale.y

        let geoAspect;

        if(this.opts.type === PORTAL_SHAPES.RECTANGLE) {

            geoAspect = this.opts.width / this.opts.height
        }
        else if(this.opts.type === PORTAL_SHAPES.CIRCLE) {

            geoAspect = 1
        }

        return scaleAspect * geoAspect
    }

    get height() {


        let geoHeight;

        if(this.opts.type === PORTAL_SHAPES.RECTANGLE) {

            geoHeight = this.opts.height
        }
        else if(this.opts.type === PORTAL_SHAPES.CIRCLE) {

            geoHeight = this.opts.radius * 2
        }

        return geoHeight * this.scale.y
    }

    get width() {


        let geoWidth;

        if(this.opts.type === PORTAL_SHAPES.RECTANGLE) {

            geoWidth = this.opts.width
        }
        else if(this.opts.type === PORTAL_SHAPES.CIRCLE) {

            geoWidth = this.opts.radius * 2
        }

        return geoWidth * this.scale.x
    }


    raycast( raycaster, intersects ) {

        let shouldRaycast = Camera.isEditing || this.portal.currentState !== STATES.EMPTY

        if(shouldRaycast) {

            return super.raycast(raycaster, intersects)
        }
    }

    /**
     *
     * @param { boolean } forceUpdate
     * @returns { Vector3 }
     */
    worldPosition(forceUpdate = false) {

        if(this._worldPosition == null) {

            this._worldPosition = new Vector3()

            forceUpdate = true
        }

        if(forceUpdate) {

            this.getWorldPosition(this._worldPosition)
        }

        return this._worldPosition
    }


    async loadStaticPreview() {

        const { exhibit, user } = this.portal.portalData

        let s360Path = CURRENT_SPACE.roomParameters.slug !== "6529hub" ? this.portal.opts?.cHeroImg360 || exhibit?.info?.cHeroImg360 : null;

        if (s360Path == null) {

            return this.load2DPrreview()

        } else if(s360Path != null ) {

            return this.load360Prreview(s360Path)
        }

        else {

            console.error("Portal has no hero img", exhibit);

            return Blackmaterial
        }

    }


    async load2DPrreview() {

        if(this.material2D == null) {

            const { exhibit } = this.portal.portalData

            let image = await imageCache.loadImage(
                exhibit.info.cHeroImg || "/images/thumbnail-vertical.png",
                this.abort
            );

            this.CHECK_ABORT()

            // @ts-ignore
            const texture = new Texture(image)

            texture.colorSpace = SRGBColorSpace
            texture.minFilter = LinearMipMapLinearFilter
            texture.magFilter = LinearFilter
            texture.generateMipmaps = true;
            texture.needsUpdate = true


            this.material2D = new TwoDMaterial({
                map: texture,
                aspect: this.aspect
            });
        }

        this.setMaterial(this.material2D)
    }


    async load2DPrreviewWithInfo() {

        if(this.material === this.material2D) {

            if(this.material2DWithInfo == null) {

                const { exhibit, roomParameters, user } = this.portal.portalData

                let tInfo = await infopreviewtexture.get(
                    exhibit,
                    user,
                    this.aspect,
                    true,
                    this.abort
                )

                this.CHECK_ABORT()

                const textureInfo = PortalInfoRenderer.get( this.material2D.uniforms.map.value,  tInfo, this.geometry, this.aspect )

                // @ts-ignore
                textureInfo.texture.renderTarget = textureInfo

                this.material2DWithInfo = new MeshBasicMaterial({
                    map: textureInfo.texture
                })
            }

            this.setMaterial(this.material2DWithInfo)

        }
    }


    /**
     *
     * @param { string } s360Path
     * @param { boolean } [forceUpdate]
     * @returns
     */
    async load360Prreview(s360Path, forceUpdate = false) {

        let current360Material = this.three60Material


        if(current360Material == null || forceUpdate) {

            const { exhibit, user } = this.portal.portalData
       
            var path = resize( s360Path, 2048, 1024);

            if( IS_MOBILE ) {

                path = resize( path, 1024, 512)
            }

            let [tex, tinfo] = await Promise.all([
                Loader.loadImageTexture(path),
                InfoPreviewTexture.get(
                    exhibit,
                    user,
                    this.aspect,
                    true,
                    this.abort
                )]
            )

            this.CHECK_ABORT()

            this.three60Material = new Three60Material({map: tex, halo : 'color', tinfo })

            this.updateMatrixWorld()


            this.getWorldQuaternion(tempQuat)

            tmpEuler.setFromQuaternion(tempQuat)


            this.three60Material.uniforms.rotation.value = tmpEuler.y - Math.PI * 0.5

            this.three60Material.uniforms.scaleFactor.value = 1

            this.three60Material.needsUpdate = true


        }

        this.setMaterial(this.three60Material)

        if(current360Material != null) {

            disposeMaterial(current360Material)
        }
    }


    async update360Img(s360Path) {

        if(this.material === this.three60Material) {

            return this.load360Prreview(s360Path, true)
        }
    }

    async loadInfoMaterial() {

        const portal = this.portal

        if(portal.opts.backState == null) return

        if(this.infoPreviewMaterial == null) {


            const canEnterSpace = portal.ownsSpace && portal.gatingError == null

            const { exhibit, roomParameters, user } = portal.portalData

            let width = 512

            let heigt = 1024

            if(this.material === this.material2D) {

                const prevImg = this.material2D.uniforms.map.value.image

                width = prevImg.width

                heigt = prevImg.height
            }


            const textureInfo = await InfoOpenTexture.get(
                exhibit,
                user,
                width,
                heigt,
                canEnterSpace,
                this.abort
            );

            this.CHECK_ABORT()

            this.infoPreviewMaterial = new MeshBasicMaterial({
                map: textureInfo,
                transparent: true,
                //depthTest: false,
            });
        }

        this.setMaterial(this.infoPreviewMaterial)

    }


    restorePreviewMaterial() {

        // back and summoned portals have no preview image: they were black
        let prevMaterial = this.three60Material ?? this.material2DWithInfo ?? this.material2D ?? Blackmaterial

        this.setMaterial(prevMaterial)
    }


    async setState(STATE, opts) {



        try {

            this.loadingTween?.kill()

            switch (STATE) {

                case STATES.EMPTY:

                    this.setMaterial(Blackmaterial)

                    this.disposeMaterials()

                    break

                case STATES.LOADING:

                    this.setMaterial(TVNoiseMaterial)

                    break

                case STATES.CLOSE:

                    if(this.three60Material != null) {

                        this.three60Material.uniforms.loading.value = 0
                    }
                    else {

                        Starfield.removeEvents()
                    }

                    if(this.currentState === STATES.OPENING || this.currentState === STATES.OPEN) {

                        this.restorePreviewMaterial()
                    }
                    else {

                        await this.loadStaticPreview()
                    }

                    break

                case STATES.OPENING:

                    if(this.material === this.three60Material) {

                        const completed = await (new Promise((resolve)=>{

                            this.loadingTween = gsap.to(this.three60Material.uniforms.loading, {
                                value: 1,
                                duration: 2,
                                onComplete:()=>{

                                    resolve(true)
                                },
                                // killed by the next setState: settle, or
                                // whoever awaits this opening waits forever
                                onInterrupt:()=>{

                                    resolve(false)
                                }
                            })
                        }))

                        this.CHECK_ABORT()

                        // the state that interrupted this one owns the mesh now
                        if(!completed) return
                    }
                    else {

                        this.setMaterial(Starfield)

                        Starfield.renderOnTop = false 

                        Starfield.addEvents()

                        Starfield.activate( true )

                        Starfield.resize(

                            this.aspect * 1000,

                            1 * 1000
                        )
                    }

                    break

                case STATES.OPEN:

                    // console.log("previewmesh open start")

                    // console.log("previewmesh open loadinfo")

                    await this.loadInfoMaterial()

                    // console.log("previewmesh open success")

                    Starfield.removeEvents()

                    break
            }

            this.previousState = this.currentState

            this.currentState  = STATE
        }
        catch(err) {

            if(IS_ABORT_ERROR(err)) {

                console.info("PortalPreviewMesh canceleld", this.portal.portalData?.exhibit?.id)

                return
            }

            console.error(err)

        }

    }



    setMaterial(material) {

        // console.log( this.material )

        if(this.material === material) return

        this.material = material

        // console.log( this.material )


        if(material === this.three60Material) {

            material.uniforms.loading.value = 0

            this.dissolve = true
        }
        else {

            this.dissolve = false
        }

        this.material.needsUpdate = true
    }

    disposeMaterials() {

        if(this.material2D != null) {

            disposeMaterial(this.material2D)

            this.material2D = null
        }

        if(this.three60Material != null) {

            disposeMaterial(this.three60Material)

            this.three60Material = null
        }

        if(this.material2DWithInfo != null) {

            disposeMaterial(this.material2DWithInfo)

            this.material2DWithInfo = null
        }

        if(this.infoPreviewMaterial) {

            disposeMaterial(this.infoPreviewMaterial)

            this.infoPreviewMaterial = null
        }

    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        disposeObject3D(this)

        this.disposeMaterials()

        super.dispose()

        this.abortController.abort("dispsed")
    }

    static create(opts) {

        return new PortalPreviewMesh(opts)

    }

    /**
     *
     * @param { Mesh } mesh
     * @returns
     */
    static createFromPlaceholder(mesh) {

        mesh.updateMatrixWorld()

        mesh.geometry.computeBoundingBox()

        mesh.geometry.computeVertexNormals()

        let box = mesh.geometry.boundingBox

        box.getSize(bbSize)

        let arr = [bbSize.x, bbSize.y, bbSize.z]

        arr.sort((a, b) => b - a)


        let height = arr[0]
        let width = arr[1]


        let boxMesh = this.create({
            type: PORTAL_SHAPES.RECTANGLE,
            width,
            height
        })

        box.getCenter(meshPos)

        meshPos.applyMatrix4(mesh.matrixWorld)

        boxMesh.position.copy(meshPos)

        const normAttr = mesh.geometry.attributes.normal

        let n = new Vector3(normAttr.getX(1), normAttr.getY(1), normAttr.getZ(1))

        n.applyNormalMatrix(bbNormalMatrix.getNormalMatrix(mesh.matrixWorld))

        n.add(boxMesh.position)

        boxMesh.lookAt(n)

        boxMesh.updateMatrixWorld()

        return boxMesh
    }
}
