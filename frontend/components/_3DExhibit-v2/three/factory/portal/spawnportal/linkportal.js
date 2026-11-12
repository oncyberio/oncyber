

// @ts-check

import Camera from '@3camera'

import Players from '@3player'

import { IS_FIRST_PERSON, IS_MOBILE, USER_HEIGHT } from '@components/_3DExhibit-v2/three/constants'

import { disposeMaterial, disposeObject3D } from '@3utils/three'

import { CanvasTexture, DoubleSide, LinearFilter, LinearMipMapLinearFilter, SRGBColorSpace, Texture, Vector3 } from "three"

import TVNoiseMaterial from '@3modules/material/tvnoisematerial'

const cameraDirection = new Vector3()

const cameraPosition = new Vector3()

const backPortalPosition = new Vector3()

import { Color, MeshBasicMaterial, PlaneGeometry } from "three"

import PipeLineMesh from "@3abstract/pipelinemesh";

import Loader from '@3loader'

import Emitter from '@3emitter'

import Events from '@3events'

import { nodeEnv } from "@env"

import MetadataAPI from "@api/metadata/_api";


export class LinkPortal extends PipeLineMesh {

    constructor() {

        let width = 2.3

        let height = 4.6

        const geometry = new PlaneGeometry(width, height)

        super(geometry, TVNoiseMaterial);

        this.texMaterial = new MeshBasicMaterial({
            // color: new Color(0xffffff),
            map: null,
            side: DoubleSide
        })

        this._active = false;

        this.active = false;

        this.width = width;

        this.height = height;

        const factor = IS_MOBILE ? 1.4 : 2

        this.teleportDistance = Math.pow( factor, 2 )

        this.mainCamWPosition = new Vector3()

        this.linkPortalPosition = new Vector3()

        this._worldPosition = null

        this.defaultLinkMetadata = {
            url: "",
            title: "",
            image: ""
        }

        this.linkMetadata = this.defaultLinkMetadata;
    }

    set active(val) {

        this._active = val;

        this.visible = val;

        if (val) {
            this.addEvents()
        } else {
            this.removeEvents()
        }
    }

    get active() {

        return this._active;
    }

    updateCoords() {
        const camera = Camera.current

        const distance = 4.6

        camera.getWorldPosition(cameraPosition)

        camera.getWorldDirection(cameraDirection)

        cameraDirection.normalize()

        const position = IS_FIRST_PERSON ? cameraPosition : Players.main.position

        backPortalPosition
            .copy(cameraDirection)
            .multiplyScalar(distance)
            .add(position)

        backPortalPosition.y = IS_FIRST_PERSON ? position.y : position.y + USER_HEIGHT

        this.position.copy(backPortalPosition)

        this.lookAt(position.x, backPortalPosition.y, position.z)

        this.worldPosition(true)
    }


    summon = async (opts = {}) => {

        if (!opts.url) return;

        this.updateCoords();

        if (this.linkMetadata.url === opts.url) return;

        this.setMaterial(TVNoiseMaterial);

        const url = opts.url

        this.linkMetadata.url = url;



        const data = await MetadataAPI.getMetadata({
            url: this.linkMetadata.url
        })

        // try {

            // let response = await fetch(nodeEnv.POLAR_SAMA + this.linkMetadata.url)

            // const text = await response.text();

        //     const parser = new DOMParser();

        //     const doc = parser.parseFromString(text, "text/html");

        //     const ogImage = doc.querySelector('meta[property="og:image"]');
        //     ogImageContent = ogImage?.getAttribute?.("content");

        //     const ogTitle = doc.querySelector('meta[property="og:title"]');
        //     ogTitleContent = ogTitle?.getAttribute?.("content");

        //     const twitterImage = doc.querySelector('meta[property="twitter:image"]');
        //     twitterImageContent = twitterImage?.getAttribute?.("content");

        //     const twitterTitle = doc.querySelector('meta[property="twitter:title"]');
        //     twitterTitleContent = twitterTitle?.getAttribute?.("content");
        // } catch(err) {
        //     console.log("failed to load metadata: ", err)
        // }

        this.linkMetadata.image = data.banner || data.icon;

        this.linkMetadata.title = data.title || this.linkMetadata.url;

        const canvasTexture = await this.buildTexture()

        this.texMaterial.map = canvasTexture

        this.setMaterial(this.texMaterial);
    }

    buildTexture() {

        return new Promise((resolve, reject) => {
            // load image to use for canvas
            const image = new Image();

            image.src = this.linkMetadata.image ? nodeEnv.POLAR_SAMA + this.linkMetadata.image : "/images/sq_image_placeholder.png";

            image.crossOrigin = "anonymous";

            image.onload = () => {
                // draw image to canvas
                const canvas = document.createElement('canvas');

                const texture = new CanvasTexture(canvas);

                texture.minFilter = LinearFilter;

                texture.magFilter = LinearFilter;

                texture.generateMipmaps = true;

                texture.colorSpace = SRGBColorSpace

                const context = canvas.getContext('2d');

                canvas.width = 512 / 2;

                canvas.height = 512;

                context.drawImage(image, canvas.width / 2 - image.width / 2, canvas.height / 2 - image.height / 2);

                // canvas transparent gradient overlay from bottom to top

                // const gradient = context.createLinearGradient(0, canvas.height, 0, 0);

                // gradient.addColorStop(0, "red");

                // gradient.addColorStop(1, "transparent");

                // context.fillStyle = gradient;

                // context.fillRect(0, 0, canvas.width, canvas.height);


                // rotate text 90 degrees

                // context.translate(0, canvas.height);

                // context.rotate(-Math.PI / 2);

                context.font = "24px SpaceGrotesk, Arial, sans-serif";

                context.fillStyle = "white";

                context.textAlign = "left";

                context.fillText( this.linkMetadata.title.length > 16 ? this.linkMetadata.title.slice(0, 16) + "..." : this.linkMetadata.title, 20, canvas.height - 60);

                context.font = "12px SpaceGrotesk, Arial, sans-serif";

                context.fillStyle = "#d2d2d2";

                context.fillText("Touch to open", 20, canvas.height - 40);

                resolve(texture);
            }
        })
    }

    preUpdate() {

        this.mainCamWPosition.copy(Camera.currentControls?.world?.firstPersonPos || Camera.current.position)

        this.linkPortalPosition.copy(this.worldPosition())

        const distance = this.linkPortalPosition.distanceToSquared(this.mainCamWPosition)

        if( distance <= this.teleportDistance) {


            // we exit pointer lock first or else we'll get an error
            if (!IS_MOBILE) {
                document.exitPointerLock();
            }

            this.dispose();

            Camera.currentControls?.playerState?.reset?.()

            setTimeout(() => {
                window.open(this.linkMetadata.url, '_blank');
            }, 100)
        }
    }

    addEvents(){

        if( this.preUpdateEvent == null ){

            this.preUpdateEvent = this.preUpdate.bind(this)

            Emitter.on(Events.PRE_UPDATE, this.preUpdateEvent)
        }
    }

    removeEvents(){

        if( this.preUpdateEvent != null ){

            Emitter.off(Events.PRE_UPDATE, this.preUpdateEvent)

            this.preUpdateEvent = null
        }
    }

    worldPosition(forceUpdate) {

        if(this._worldPosition == null) {

            this._worldPosition = new Vector3()

            forceUpdate = true
        }

        if(forceUpdate) {

            this.getWorldPosition(this._worldPosition)
        }

        return this._worldPosition
    }

    setMaterial(material) {

        if(this.material === material) return

        this.material = material

        this.material.needsUpdate = true
    }

    dispose() {

        if(this.wasDisposed) return

        this.linkMetadata = this.defaultLinkMetadata;

        this.active = false;

        disposeMaterial(this.texMaterial)

        disposeObject3D(this)

        this.texMaterial = null

        this.wasDisposed = true

        super.dispose()
    }
}

