// @ts-check

import Camera from "@3camera"
import { getMediaDimensions } from "@utils/metadata/reformatAsset";
import { Group, MeshBasicMaterial, PlaneGeometry } from "three";
import { Fn, bool, float as tslFloat, select, sRGBTransferEOTF, uv, vec2, vec4 } from "three/tsl";
import { ArtworkNodeMaterial, KEEP_ALL_FRAGMENTS, materialTexture, materialUniform } from "../artwork/nodematerial";
import Border from "@3factory/border"
import PipeLineMesh from "@3abstract/pipelinemesh";
import { CURRENT_SPACE, USER_INTERACTED, VOICE_ROLLOFF_FACTOR } from "../../constants";
import { VideoTexture } from "../artwork/textures/videotexture";
import { disposeObject3D, toXYZ } from "../../utils/three";
import { PseudoAudioController } from "../artwork/controllers/pseudoaudiocontroller";
import { StreamAudioPlayer } from "../artwork/controllers/players";
import { VideoController } from "../artwork/controllers/videocontroller";
import { artworkDepth } from "../../utils/spaceutils";
import { PlaceholderComponent } from "../space/kits/cyber/components/placeholder";



const pad = materialUniform("planeAspect", "float").sub(materialUniform("videoAspect", "float")).mul(0.5)

// remap(x, vec2(0, 1), to)
const remap = (x, to) => x.mul(to.y.sub(to.x)).add(to.x)

const insideUnit = (x) => x.greaterThanEqual(0.0).and(x.lessThanEqual(1.0))

// Aspect-fit the stream: letterbox (black) whatever the video doesn't cover.
const streamColorNode = Fn(() => {

    const vUv = uv()

    const uvX = select(pad.greaterThan(0.0), remap(vUv.x, vec2(pad.negate(), pad.add(1.0))), vUv.x)

    const uvY = select(pad.lessThan(0.0), remap(vUv.y, vec2(pad, tslFloat(1.0).sub(pad))), vUv.y)

    const col = materialTexture("map", vec2(uvX, uvY))

    const inside = select(pad.greaterThan(0.0), insideUnit(uvX), select(pad.lessThan(0.0), insideUnit(uvY), bool(true)))

    const color = select(inside, col, vec4(0.0, 0.0, 0.0, 1.0))

    // The WebGL shader wrote the texel without output conversion.
    return vec4(sRGBTransferEOTF(color.rgb), color.a)
})()

class StreamMaterial extends ArtworkNodeMaterial {

    static get type() {

        return "VideoStreamMaterial"
    }

    constructor({ videoAspect, planeAspect, map }) {

        super()

        this.uniforms = {
            videoAspect: { value: videoAspect },
            planeAspect: { value: planeAspect },
            map: { value: map }
        }

        this.colorNode = streamColorNode

        this.alphaTestNode = KEEP_ALL_FRAGMENTS

        this.polygonOffset = true

        this.polygonOffsetFactor = -2.0

        this.polygonOffsetUnits = -8.0

        this.transparent = true
    }
}

export class VideoStream extends Group {

    /**
     *
     * @param { { stream: import("./streamcontainer").ShareStream, opts: any } } opts
     */
    constructor({ stream, opts }) {

        super()

        this.opts = opts

        /** @type { import("./streamcontainer").ShareStream } */
        this.stream = stream

        this.videoTrack = stream.getVideoTracks()[0]

        this.audioTrack = stream.getAudioTracks()[0]

        /** @type { PlaceholderComponent } */
        this.placeholder = null
    }

    async init() {

        await this.addVideo()

        this.setOptions(this.opts)
    }

    async addVideo() {

        // const wrapper = document.createElement("div")

        // // document.body.appendChild(wrapper)

        // wrapper.style.display = "none"

        // await USER_INTERACTED

        // stream.videoTrack.play(wrapper)

        // stream.audioTrack.play()

        // let video = wrapper.getElementsByTagName("video")[0]

        let video = this.video = document.createElement('video');

        let mediaStream = this.stream; 

        const track = this.videoTrack;

        const supports = navigator.mediaDevices.getSupportedConstraints();

        if (
          !supports["width"] ||
          !supports["height"] ||
          !supports["frameRate"] ||
          !supports["facingMode"]
        ) {
          // We're missing needed properties, so handle that error.
          
        } else {
            //
            const constraints = {
                frameRate: { max: 30 },
                width: {  max: 1440 },
            };

            await track
                .applyConstraints(constraints)
                .catch((reason) => {
                    console.error(reason)
                });
        }

        video.srcObject = mediaStream;

        video.playsInline = true

        video.muted = true

        USER_INTERACTED.then(() => {
            //
            video.muted = false;
        })

        let depth = artworkDepth(CURRENT_SPACE.roomParameters)

        video.load()

        await new Promise((resolve) => {
            //
            video.addEventListener("loadedmetadata", () => {
                //
                console.log("videostream loadedmetadata", video.videoWidth, video.videoHeight)

                resolve()
            }, { once: true })
        })


        video.addEventListener("resize", () => {
            //
            console.log("videostream resize", video.videoWidth, video.videoHeight)

            this.videoDimensions = [video.videoWidth, video.videoHeight]

            const aspect = this.videoDimensions[0] / this.videoDimensions[1]

            this.planeMaterial.uniforms.videoAspect.value = aspect
        })

        const videoSettings = this.videoTrack.getSettings()

        console.log("videostream settings", videoSettings)

        this.videoDimensions = [videoSettings.width || 960, videoSettings.height || 540]
        
        // @ts-ignore
        const map = new VideoTexture({ video })

        const aspect = this.videoDimensions[0] / this.videoDimensions[1]

        this.planeMaterial = new StreamMaterial({
            videoAspect: aspect,
            planeAspect: 1,
            map
        });

        const geometry = new PlaneGeometry(1, 1);

        this.mesh = new PipeLineMesh(geometry, this.planeMaterial, {

            occlusionMaterial: new MeshBasicMaterial({color: 0x000000}),

            visibilityOnMirror : false
        })

        this.add(this.mesh)

        this.mesh.position.z = depth * 0.50;

        this.border = Border.get({
            color: 0,
            height: 1,
            width: 1,
            depth,
            borderSize: 0
        });

        this.add(this.border)

        this.videoController = new VideoController({
            video,
            mesh: this.mesh,

        })

        this.videoController.addEvents()

        /*
        if (this.audioTrack) {

            this.audioController = new PseudoAudioController({
                mesh: this.mesh,
                audioPlayer: new StreamAudioPlayer(this.audioTrack),
                volume: 2 ,
                rolloffFactor: VOICE_ROLLOFF_FACTOR
            })
    
            USER_INTERACTED.then(() => {
                //
                if (this.wasDisposed) return
    
                this.audioController.play()
            })
        }*/

        if (process.env.NODE_ENV === "development") {

            window["$$str"] = this
        }
    }

    setPlaceholder(placeholderId) {

        if (this.placeholder != null) {

            this.placeholder.offMatrixChanged(this.syncCoords)

            this.placeholder = null
        }

        if (placeholderId != null) {

            // @ts-ignore
            this.placeholder = CURRENT_SPACE.space.kitbash?.getComponentById(placeholderId)

            if (this.placeholder != null) {

                this.placeholder.onMatrixChanged(this.syncCoords)

                this.syncCoords()
            }
        }
    }

    syncCoords = () => {
        //
        this.position.copy(this.placeholder.position)

        this.quaternion.copy(this.placeholder.quaternion)

        this.scale.copy(this.placeholder.scale)

        this.scale.z = 1
    }

    setDefaultCoords() {

        const position = Camera.current.position

        this.position.copy(Camera.getPreferredInitPosition(6.05))

        this.lookAt(position.x, this.position.y, position.z)

        const { width, height, depth } = getMediaDimensions({
            width: this.videoDimensions[0],
            height: this.videoDimensions[1],
            // @ts-ignore
            artworkData: {},
            roomParameters: CURRENT_SPACE.roomParameters
        })

        this.scale.set(width, height, 1)
    }


    setOptions(opts) {

        if (opts.placeholderId != this.placeholder?.data.id) {

            this.setPlaceholder(opts.placeholderId)
        }
        
        if (this.placeholder == null) {

            if(opts?.position != null) {

                this.position.set(opts.position.x, opts.position.y, opts.position.z)
                
                this.rotation.set(opts.rotation.x, opts.rotation.y, opts.rotation.z)
                
                this.scale.set(opts.scale.x, opts.scale.y, opts.scale.z)
            }
            else {

                this.setDefaultCoords()
            }
        }
    }

    getOptions() {

        if (this.placeholder == null) {

            return {
                position: toXYZ(this.position),
                rotation: toXYZ(this.rotation),
                scale: toXYZ(this.scale),
            }
        }
        else {

            return {
                placeholderId: this.placeholder.data.id
            }
        }
    }

    updateMatrixWorld(force) {

        super.updateMatrixWorld(force)

        const scale = this.placeholder == null ? this.scale : this.placeholder.scale

        this.planeMaterial.uniforms.planeAspect.value = scale.x / scale.y
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.setPlaceholder(null)

        this.audioController?.dispose()

        this.videoController?.dispose()

        disposeObject3D(this)

        this.video.pause()
        this.videoTrack.stop()
        this.audioTrack?.stop()

        this.stream = null

        this.audioController = null

        this.videoController = null

    }
}
