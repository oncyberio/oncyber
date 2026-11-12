// @ts-check

import {

    Group,

    MeshBasicMaterial

} from 'three'

import { DRACOLoader } from "@3utils/draco.js"

import { AudioLoader, DataTexture, ImageLoader, LinearFilter, Mesh, SRGBColorSpace, Texture, TextureLoader, UnsignedByteType, VideoTexture } from 'three';


import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader';


import { GLTFLoader } from './loader/GLTFLoader'

import { GPU_TIER, IS_IOS, IS_VR, VIDEO_ERROR, OLD_ALTS_MAPPING  } from './constants';

import {  PatchedVideoTexture } from "@3utils/patchedvideotexture"

import { cacheStorages } from './utils/cachestorage';
import { isGlbUrl, isManagedModelUrl } from './utils/assetUrl';
import { uploadTextureBatch } from '@utils/uploadTextureBatch';
import { yieldLobbyLoadingWork } from '@utils/lobbyLoadingBudget';
import { linkedAbortSignal } from '@utils/linkedAbortSignal';
import { disposeObject3D } from './utils/three';
import { loadArtworkHlsVideo, loadArtworkVideoElement } from '@utils/media/video';

// import FBOHelper from '@3gl/globals/fbohelper.js'

import Mediator from '@3mediator'

import {

    FBO_DEBUG,

    DEBUG,

    CURRENT_SPACE,

    SUPPORT_BITMAP_LOADING,

    WEB_WORKER_SUPPORT,

    SUPPORT_TRANSFERRABLE,

    SET_COMPRESSED_SUPPORT

} from '@3constants'

import { VRMLoaderPlugin } from '@pixiv/three-vrm';

import whitelist from "@3whitelist"

// import GLTFInstancingExtension from './loader/EXT_mesh_gpu_instancing';

import { cloudinary, isRelay, opensea, relay, resize } from '@utils/urlUtils';

import { nodeEnv } from "env";

import WorkerPool from '@3gl/utils/workerpool.js'

import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR, REJECT_IF_ABORTED, combineAbortSignals } from "./utils/abort";

import { prepareSvgTextureBlob } from "@utils/media/svgTexture";

import { fitImageToTextureLimit } from "./utils/textureLimit";

import { isBrave, isInIFrame, removeDuplicates } from "@utils/js";

// var workerPool;

// if( WEB_WORKER_SUPPORT ) {

//     workerPool = new WorkerPool(8)

//    // const imageWorker = new Worker(new URL('@3gl/utils/imageworker.js', import.meta.url))
// }

import Scene from '@3scene'

const KHR_materials_pbrSpecularGlossiness = 'KHR_materials_pbrSpecularGlossiness'


// THREE_VRM.VRMUtils.rotateVRM0( vrm );


// const helperRoot = new Group();
// helperRoot.renderOrder = 10000;
// Scene.add( helperRoot );

import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// import WorkerSource from "@3gl/utils/image.worker.js";

import WorkerSource from "@3gl/utils/image.worker.js";


import {

    IS_MOBILE

} from '@3constants'
// import Textures from '@3textures'

import { loadMediaAlternatives } from "@utils/media/alternatives"

const noop = () => {}

/** The URL loadGLTF actually requests. */
export function normalizeModelUrl(url) {
    return url.trim()
        .replace('http://', 'https://')
        .replace('https://polar-mountain-96590.herokuapp.com/', '')
}

/** Models loadGLTF downloads as bytes (through the room cache) and parses. */
function usesFetchedBytes(url) {
    return isGlbUrl(url) || isManagedModelUrl(url) || /\.vrm(?:[?#]|$)/i.test(url)
}

class Loader {

    constructor(){

        this.pendingLoads = new Set();
        this.workerPool = null ;

        if( WEB_WORKER_SUPPORT ) {

           this.workerPool = new WorkerPool(WorkerSource, IS_MOBILE ? 4 : 8)
        }

        this.imageLoader = new ImageLoader()

        this.imageLoader.setCrossOrigin("anonymous")

        this.imageTextureLoader = new TextureLoader()

        this.imageTextureLoader.setCrossOrigin("anonymous")

        this.gltfLoader = new GLTFLoader().setCrossOrigin("anonymous")

        // this.gltfLoader.register(parser => new GLTFInstancingExtension(parser));

       this.gltfLoader.register( ( parser ) => {

            const p = new VRMLoaderPlugin( parser, { helperRoot: null && helperRoot, autoUpdateHumanBones: true } );

            p.mtoonMaterialPlugin.getMaterialType = ( materialIndex )=>{

                return null
            }

            // MToon is off: don't fetch its extra textures or push MToon-only
            // params onto the fallback material (three r180 warns per param).
            p.mtoonMaterialPlugin.extendMaterialParams = async () => {}

            return p

       } );

        this.dracoLoader = new DRACOLoader()

        this.dracoLoader.setDecoderConfig( {} );

        this.dracoLoader.setDecoderPath("/draco/")

        this.gltfLoader.setDRACOLoader(this.dracoLoader)


        this.audioLoader = new AudioLoader()

        this.rgbeLoader = new HDRLoader()

        this.pmremGenerator = null

        if ( DEBUG ) {

            // @ts-ignore
            window.loader = this

        }

        this.bitmapOptions = { imageOrientation: /** @type {const} */ ('flipY') }
    }

    async getRenderer(){

        if(this.renderer == null ) {

            const { default: renderer, rendererReady } = await import('@3renderer')

            await rendererReady

            this.renderer = renderer
        }

        return this.renderer
    }

    async beginSession(signal) {
        this.sessionSignal = signal;
        if (!this.dracoLoader) {
            this.dracoLoader = new DRACOLoader().setDecoderConfig({}).setDecoderPath("/draco/");
            this.gltfLoader.setDRACOLoader(this.dracoLoader);
        }
        // Fetch the decoder (draco_wasm_wrapper.js + draco_decoder.wasm) now,
        // alongside the room, instead of when the parser first meets
        // compressed geometry. Its workers still start on first use.
        this.dracoLoader.preload();
        if (!this.ktxLoader) await this.addKTX();
    }

    /** Room downloads started before the parser asks for them, by URL. */
    prefetchedModels = new Map();

    /**
     * Starts downloading a model now, through the same cache as loadGLTF;
     * the next loadGLTF(url) parses these bytes instead of fetching again.
     * Unclaimed downloads end with the session.
     * @param { string } url
     * @param {{ compressedTextures?: boolean }} [hints]
     * @returns { boolean } whether a download started
     */
    prefetchModel(url, hints = {}) {
        const signal = this.sessionSignal;
        if (!url || !signal || signal.aborted) return false;
        const key = normalizeModelUrl(url);
        if (!usesFetchedBytes(key)) return false;
        if (this.prefetchedModels.has(key)) return true;
        if (hints.compressedTextures) void this.ktxLoader?.init?.()?.catch?.(noop);
        const pending = (async () => {
            const braveIframe = (await isBrave()) && isInIFrame();
            const response = braveIframe
                ? await fetch(key, { signal })
                : await cacheStorages.room.fetch(key, { signal });
            if (!response.ok) throw new Error(`Failed to download the room (HTTP ${response.status})`);
            return response.arrayBuffer();
        })();
        void pending.catch(noop);
        this.prefetchedModels.set(key, pending);
        return true;
    }

    /** The prefetched bytes for a URL, once; null when there are none. */
    takePrefetchedModel(url) {
        const key = normalizeModelUrl(url);
        const pending = this.prefetchedModels.get(key);
        if (!pending) return null;
        this.prefetchedModels.delete(key);
        return pending;
    }

    async endSession() {
        this.prefetchedModels.clear();
        WorkerPool.disposeAll();
        await Promise.allSettled([...this.pendingLoads]);
        const environments = Object.values(this.pmremCache);
        this.pmremCache = {};
        await Promise.allSettled(environments.map(async (pending) => {
            const texture = await pending;
            if (texture?.renderTarget) texture.renderTarget.dispose();
            else texture?.dispose();
        }));
        this.pmremGenerator?.dispose();
        this.pmremGenerator = null;
        this.ktxLoader?.dispose();
        this.ktxLoader = null;
        this.dracoLoader?.dispose();
        this.dracoLoader = null;
        this.gltfLoader.setKTX2Loader(null);
        this.gltfLoader.setDRACOLoader(null);
        this.sessionSignal = null;
    }

    async addKTX(){

        this.ktxLoader = new KTX2Loader()

        this.ktxLoader
                     .setTranscoderPath( '/basis/' )
                     .detectSupport( await this.getRenderer() )


        SET_COMPRESSED_SUPPORT( this.ktxLoader.workerConfig  )

        this.gltfLoader.setKTX2Loader( this.ktxLoader );
    }

    async getRenderer(){

        if(this.renderer == null ) {

            const { default: renderer, rendererReady } = await import('@3renderer')

            await rendererReady

            this.renderer = renderer
        }

        return this.renderer
    }

    /**
     *
     * @param {string[]} urls
     * @param { boolean } [optimiseLegacy]
     * @param { AbortSignal } [abort]
     * @returns { Promise<import('@gltypes').GLTF> }
     */
    async loadGLTFAsset(urls, optimiseLegacy, abort) {

        const alts = await this.preprocessUrl(...urls)

        return this.loadAlts(
            url => {
                // CID assets are immutable across visits; mutable third-party
                // artwork URLs retain their normal HTTP-cache behavior.
                return this.loadGLTF(url, false, !isManagedModelUrl(url), optimiseLegacy)
            }
            ,
            alts,
            abort
        )

    }

    /**
     * @param { string } url
     * @param { boolean } [initTextures]
     * @param { boolean } [noCache]
     * @param { boolean } [optimiseLegacy]
     * @param {{ signal?: AbortSignal, keepSourceBytes?: boolean }} [options]
     *   keepSourceBytes: put the downloaded file on the result as
     *   `sourceBytes` (the parser keeps no reference to it), for a caller
     *   that hands it on, such as the avatar bake worker.
     * @returns { Promise<import('@gltypes').GLTF> }
     */
    loadGLTF(url, initTextures = false, noCache = false, optimiseLegacy = false, options = {}) {
        const linked = linkedAbortSignal([this.sessionSignal, options.signal]);
        const pending = this.loadGLTFImpl(url, initTextures, noCache, optimiseLegacy, {
            signal: linked.signal,
            abortableFetch: !!options.signal,
            keepSourceBytes: !!options.keepSourceBytes,
        }).finally(linked.dispose);
        this.pendingLoads.add(pending);
        void pending.finally(() => this.pendingLoads.delete(pending)).catch(() => {});
        return pending;
    }

    async loadGLTFImpl( url, initTextures = false, noCache = false, optimiseLegacy = false, options = {} ){

        const signal = options.signal || this.sessionSignal;
        CHECK_ABORT_SIGNAL(signal);
        var gltf = null

        try {
        url = normalizeModelUrl(url)

        // Avoid cache fetch for iframe-loaded content in Brave browser.
        // (due to security policy issue)
        const braveIframe = (await isBrave()) && isInIFrame()
        CHECK_ABORT_SIGNAL(signal);

        if (options.abortableFetch || usesFetchedBytes(url)) {
            try {

                const prefetched = noCache ? null : this.takePrefetchedModel(url);
                // A failed early download is retried here, as if it never ran.
                let data = prefetched ? await prefetched.catch(() => null) : null;
                CHECK_ABORT_SIGNAL(signal);
                if (!data) {
                const response = !noCache && !braveIframe
                    ? await cacheStorages.room.fetch(url, { signal })
                    : await fetch(url, { signal });
                CHECK_ABORT_SIGNAL(signal);
                if (!response.ok) throw new Error(`Failed to download the room (HTTP ${response.status})`);
                data = await response.arrayBuffer();
                }
                // Decoding cannot be interrupted; do not start it after departure.
                CHECK_ABORT_SIGNAL(signal);

                await yieldLobbyLoadingWork({ signal, force: true });
                CHECK_ABORT_SIGNAL(signal);
                gltf = await new Promise((resolve, reject) => {
                    this.gltfLoader.parse(data, new URL(".", new URL(url, window.location.href)).href, resolve, reject)
                });
                // GLB chunks are copied out while parsing; these bytes are free.
                if (options.keepSourceBytes && gltf) gltf.sourceBytes = data;

            } catch (err) {
                CHECK_ABORT_SIGNAL(signal);
                console.error(err);
                // The original (offline, out of memory, HTTP status) is kept
                // for the visitor's error message and "Copy details".
                throw new Error("Failed to parse glft file of the room", { cause: err });
            }
        } else {

            gltf =  await this.gltfLoader.loadAsync(url)

        }

        CHECK_ABORT_SIGNAL(signal);

        // is it using pbrSpecularGlossiness extension
        // if yes, transform it
        let isLegacy = false

        gltf.scene.traverse((child)=>{

            if( child.material?.userData?.gltfExtensions?.[KHR_materials_pbrSpecularGlossiness] != null ) {

                isLegacy = true

            }
        })

        // @ts-ignore
        if( isLegacy && optimiseLegacy ) {

            console.log( ' start transformation ')

            const { default: Optimiser } = await import('@3modules/optimiser')
            CHECK_ABORT_SIGNAL(signal);
            const blob = await Optimiser.transformRoughness(url)
            CHECK_ABORT_SIGNAL(signal);

            const transformedURL = URL.createObjectURL( blob )

            try {
                disposeObject3D(gltf.scene);
                gltf = null;
                gltf = await this.gltfLoader.loadAsync(transformedURL);
                CHECK_ABORT_SIGNAL(signal);
            } finally { URL.revokeObjectURL(transformedURL); }

            gltf.transformedBlob = blob

        }

        const mapTexture = new Map()
        const mapMaterial = new Map()

        let textures = [];

        let materials = []


        gltf.scene.traverseVisible(async (child) => {

            if (child instanceof Mesh && child.material.map?.isTexture) {

                if(mapTexture.get(child.material.map.uuid) == null ){

                    mapTexture.set(child.material.map.uuid, child.material.map)

                    textures.push(child.material.map);

                    child.material.map.userData.mesh = child

                    if( FBO_DEBUG ) {

                        if(mapTexture.get(child.material.map.uuid) == null ){

                            if(this.fboHelper == null){

                                this.fboHelper = (await import('@3gl/globals/fbohelper.js')).default
                            }

                            this.fboHelper.attach(child.material.map, 'tex' + Math.random() )
                        }
                    }
                }
            }
        });

        gltf.textures = textures

        if( initTextures ) {
            await this.uploadTextures(textures, signal);
            CHECK_ABORT_SIGNAL(signal);
        }

        return gltf
        } catch (error) {
            // A parser may finish after its request or entire scene was cancelled.
            // Its donor never becomes visible and must not retain decoded images.
            if (gltf?.scene) disposeObject3D(gltf.scene);
            CHECK_ABORT_SIGNAL(signal);
            throw error;
        }

    }



    async uploadTextures(textures, signal = this.sessionSignal) {
        CHECK_ABORT_SIGNAL(signal);
        const renderer = await this.getRenderer();
        await uploadTextureBatch(
            textures,
            (texture) => renderer.initTexture(texture),
            () => Mediator.nextFrame(),
            {
                signal,
                beforeUpload: () => yieldLobbyLoadingWork({ signal }),
            }
        );
    }

    // async uploadMaterials(gltf) {

    //     gltf.scene.traverse((async (object) => {
    //         if(object instanceof Mesh && object.material) {
    //             const chilren = object.children
    //             object.children = []
    //             Renderer.compile(object, Camera.current)
    //             await Mediator.nextFrame()
    //             object.children = chilren
    //         }
    //     }))
    // }

    /**
     *
     * @param  {...string} urls
     * @returns
     */
    async preprocessUrl(...urls) {

        // if (GPU_TIER.path === "low") {

        //     // return cloudinary.res(url, 480)
        //     return url
        // }

        urls = removeDuplicates( urls.filter(url => url != null) )

        let result = []

        let promises = []

        urls.forEach( (url, i) => {

            if(url.startsWith("/")) {

                result[i] = url
            }

            else if(opensea.isOldOpenSeaUrl(url)) {

                promises.push(opensea.redirect(url).then(newUrl => {

                    result[i] = newUrl
                }))

            }

            else if (cloudinary.isCloudinaryUrl(url)) {

                if(whitelist[CURRENT_SPACE?.exhibit?.owner?.toLowerCase?.()]?.["highq-artworks"]) {

                    result[i] = resize(url, 1080);
                }
                else {

                    let urls = [url]

                    let url2 = cloudinary.noTransform(url)

                    if(url2 !== url) {

                        urls.push(url2)
                    }

                    result[i] = urls
                }
            }
            else if(!isRelay(url)) {

                result[i] = [url, relay(url)]

            } else {

                result[i] = url
            }
        })

        await Promise.all(promises)

        return result.flat()

    }

    /**
     * @param {string[]} [urls]
     * @param { AbortSignal } [abort]
     * @returns { Promise<HTMLImageElement | ImageBitmap> }
     */
     async loadImage( urls, abort, forceNoWorker = false, name = "" ) {

        const alts = await this.preprocessUrl(...urls)

        CHECK_ABORT_SIGNAL(abort)

        return loadMediaAlternatives(
            alts.map(url => OLD_ALTS_MAPPING[url] ?? url),
            (url, signal) => this.fetchImage(url, signal, forceNoWorker, name),
            abort
        )
    }

    /**
     *
     * @param { string } url
     * @param { AbortSignal } [abort]
     * @param { boolean } [forceNoWorker]
     * @returns { Promise<HTMLImageElement | ImageBitmap> }
     */
    async fetchImage(url, abort, forceNoWorker = false, name = "" ) {

        const image = await this.decodeImage(url, abort, forceNoWorker, name)

        return /** @type {any} */ (await fitImageToTextureLimit(image))
    }

    /**
     * @param { string } url
     * @param { AbortSignal } [abort]
     * @param { boolean } [forceNoWorker]
     * @returns { Promise<HTMLImageElement | ImageBitmap> }
     */
    decodeImage(url, abort, forceNoWorker = false, name = "" ) {

        // console.log("bitmap", SUPPORT_BITMAP_LOADING)

        // if(abort == null) {

        //     console.log("fetchImage called", name, abort)
        // }

        abort = abort && this.sessionSignal
            ? combineAbortSignals([abort, this.sessionSignal])
            : abort || this.sessionSignal;
        CHECK_ABORT_SIGNAL(abort)

        return new Promise( async ( resolve, reject )=>{

            if( forceNoWorker == false && WEB_WORKER_SUPPORT && cloudinary.isCloudinaryUrl( url ) ) {

                this.workerPool.queueJob(

                    './imageworker.js',

                    {

                        url: url,

                        imageOrientation: this.bitmapOptions.imageOrientation,

                        bitmap: SUPPORT_TRANSFERRABLE && SUPPORT_BITMAP_LOADING
                    },

                    ( e ) => {

                        // console.log(e.data)

                        if( e.data.cancel ) {

                            console.log( 'job killed ')
                        }

                        // console.log("LODMesh worker callback", name, abort, e)

                        if(REJECT_IF_ABORTED(abort, reject)) { e.data.image?.close?.(); return; }

                        if( e.data.error == true ){

                            reject('not found')
                        }

                        else {

                            if( e.data.blob ) {

                                var url = window.URL.createObjectURL(e.data.blob)

                                var image  = new Image()

                                image.crossOrigin = 'anonymous'

                                image.onload = ()=>{
                                    URL.revokeObjectURL(url)
                                    if (!REJECT_IF_ABORTED(abort, reject)) resolve(image)
                                }
                                image.onerror = (error) => {
                                    URL.revokeObjectURL(url)
                                    reject(error)
                                }

                                image.src = url
                            }

                            else {

                                const img = e.data.image

                                img.naturalWidth  = img.width

                                img.naturalHeight = img.height

                                resolve( img )
                            }

                        }
                    },

                    this,

                    abort
                )
            }

            else {

                if(url.startsWith('ipfs://')) {
                    url = url.replace('ipfs://', 'https://cyber.mypinata.cloud/ipfs/');
                    console.log('ipfsurl', url);
                }

                fetch(url, {

                    signal: abort

                }).then( async ( response )=>{

                    // console.log((new Date()).toTimeString(), "LODMesh worker callback", name, abort?.aborted)

                    if(REJECT_IF_ABORTED(abort, reject)) return

                    if( !response.ok ){

                        reject('not found')

                        return
                    }

                    const mimeType = response.headers
                        .get("Content-Type")
                        ?.split(";")[0];


                        const isSvg = mimeType?.startsWith("image/svg")

                    // if( response. )

                    var blob = await  response.blob()

                    if (isSvg) blob = await prepareSvgTextureBlob(blob)

                    if(REJECT_IF_ABORTED(abort, reject)) return

                    if (!isSvg && SUPPORT_BITMAP_LOADING ){

                        let bmoptions = {

                            imageOrientation: this.bitmapOptions.imageOrientation
                        }

                        let img = await  createImageBitmap( blob, bmoptions )

                        if(abort?.aborted) {
                            img.close()
                            REJECT_IF_ABORTED(abort, reject)
                            return
                        }

                        // @ts-ignore
                        img.naturalWidth  = img.width

                        // @ts-ignore
                        img.naturalHeight = img.height

                        resolve( img )
                    }

                    else {

                        let img  = new Image()

                        img.crossOrigin = 'Anonymous'
                        const blobUrl = URL.createObjectURL(blob)

                        img.onload = ()=>{
                            img.onload = null

                            img.onerror = null

                            URL.revokeObjectURL(blobUrl)
                            if (!REJECT_IF_ABORTED(abort, reject)) resolve(img)
                        }

                        img.onerror = () => {
                            URL.revokeObjectURL(blobUrl)

                            img.onload = null

                            img.onerror = null

                            if(REJECT_IF_ABORTED(abort, reject)) return

                            reject("not found")
                        }

                        img.src = blobUrl
                    }

                })

                .catch((error) => {

                    if(REJECT_IF_ABORTED(abort, reject)) return

                    reject( error )

                })
            }
        })

    }

    /**
     * @param {string} url
     * @returns { Promise<Texture> }
     */
    async loadImageTexture( url ) {

        const alts = await this.preprocessUrl(url)

        return this.loadAlts(
            url => this.imageTextureLoader.loadAsync( url ),
            alts
        )
    }

    async loadAlts(loader, urls, abort) {

    
        urls = urls.filter(url => !!url)

        urls = urls.map(url => OLD_ALTS_MAPPING[url] ?? url)

        CHECK_ABORT_SIGNAL(abort)

        if(urls.length === 0) throw new Error("No usable artwork media URL")

        const [url, ...rest] = urls

        try {
            return (await loader( url, abort ))
        }
        catch(err) {

            if(IS_ABORT_ERROR(err)) {

                throw err
            }

            console.error("[loadAlts] failed to load", url)

            if(rest.length === 0) throw err

            return this.loadAlts(loader, rest, abort)
        }
    }


     /**
     * @param {string} url
     * @param { (t: Texture) => void } [onLoad]
     * @param { (e: any) => void } [onError]
     * @returns { Texture }
     */
      loadImageTextureSync( url, onLoad, onError ) {
        return this.imageTextureLoader.load( url, onLoad, null, onError )
    }

    /**
     * @param { string } url
     * @returns { Promise<AudioBuffer> }
     */
    async loadAudio(url) {

        return new Promise((resolve, reject) => {

            this.audioLoader.load(url, resolve, () => {}, reject)
        })
    }


    /**
     *
     * @param { string[] } urls
     * @param { AbortSignal } [abort]
     * @returns { Promise<HTMLVideoElement> }
     */
     async loadVideo(urls, abort) {

        const self = this

        const alts = await this.preprocessUrl(...urls)

        return loadMediaAlternatives(
            alts.map(url => OLD_ALTS_MAPPING[url] ?? url),
            (url, signal) => tryLoadVideo(url, signal), abort
        )

        /**
         *
         * @param { string } url
         * @returns
         */
        async function tryLoadVideo (url, abort) {

            const video = document.createElement("video")

            if(url.endsWith(".m3u8") && !video.canPlayType('application/vnd.apple.mpegurl')) {

                return self.loadHLSVideo(url, video, abort)
            }

            return loadArtworkVideoElement(url, video, abort, IS_IOS)

        }
    }


     /**
     * @param {string} url
     * @param {HTMLVideoElement} video
     */
     async loadHLSVideo(url, video, abort) {


        return loadArtworkHlsVideo(url, video, abort)

    }


    /**
     * r180's PMREM generator (three/webgpu), shared by the environment loaders.
     * Imported lazily so non-rendering code paths never pull in three/webgpu.
     */
    async getPMREMGenerator() {

        if (this.pmremGenerator == null) {

            const { PMREMGenerator } = await import('three/webgpu')

            const renderer = await this.getRenderer()

            // another caller may have created it while we awaited
            this.pmremGenerator ??= new PMREMGenerator( renderer );
        }

        return this.pmremGenerator
    }

    async loadCubeMapfrom360(path, abort) {

        // WebGLCubeRenderTarget.fromEquirectangularTexture does not run under
        // WebGPURenderer: return the equirect's PMREM instead (a cube-UV map
        // every environment/background consumer samples the same way).
        let texture = await this.loadImageTexture(path)

        const pmremGenerator = await this.getPMREMGenerator()

        const renderTarget = pmremGenerator.fromEquirectangular( texture )

        // @ts-ignore
        renderTarget.texture.renderTarget = renderTarget

        return renderTarget.texture
    }


    async loadCubeMapFromScene(scene, flipY = false) {

        const pmremGenerator = await this.getPMREMGenerator()

        scene.children.forEach((child) => {
            if (child.name === "artwork") {
                child.visible = false;
            }
        });

        let envMap = pmremGenerator.fromScene(scene, 0, 0.01, 5000);

        // @ts-ignore
        envMap.flipY = false

        scene.children.forEach((child) => {
            if (child.name === "artwork") {
                child.visible = true
            }
        })

        // @ts-ignore
        envMap.texture.renderTarget = envMap

        return envMap
    }

    async loadEquirectangularFromScene(scene, flipY = false) {

        // fromScene already returns the PMREM (cube-UV) map; the WebGL version
        // re-ran fromEquirectangular on that render target, which was a no-op
        // at best.
        return (await this.loadCubeMapFromScene(scene, flipY)).texture
    }

    /**
     *
     * @param { string } path
     * @returns { Promise<{ texture: DataTexture; texData: object }> }
     */
    async loadRGBE(path) {


        var blobURL = path;

        var previouslyAblob = true

        if(path.search('blob:') == -1){
           //do something

           previouslyAblob = false

           const response = await cacheStorages.hdr.fetch(path, { signal: this.sessionSignal });
           const buffer = await response.arrayBuffer();
           const type = response.headers.get("content-type")?.split(";")[0];
           blobURL = URL.createObjectURL(new Blob([buffer], { type }));
        }


        return new Promise((resolve, reject) => {
            this.rgbeLoader.load(
                blobURL,
                (texture, texData) => {
                    if( previouslyAblob == false ) {
                        URL.revokeObjectURL(blobURL);
                    }
                    resolve({ texture, texData });
                },
                undefined,
                (err) => {

                    if( previouslyAblob == false ) {
                        URL.revokeObjectURL(blobURL);
                    }
                    reject(err);
                }
            );
        });
    }


    pmremCache = {}

    /**
     *
     * @param { import('@gltypes').EnvironmentParams} environment
     * @returns { Promise<Texture> }
     */
    async loadPMREMEnvironment( environment, flipY = false, tex = null ) {

        // console.log("loadPMREMEnvironment flipY", !!flipY)

        if (!environment.path) return null;

        if( this.pmremCache[environment.path] != null ) {

            console.log("loadPMREMEnvironment found in cache", environment.path)

            return this.pmremCache[environment.path]
        }

        console.log("loadPMREMEnvironment not found in cache", environment.path)

        this.pmremCache[environment.path] = this._loadPMREMEnvironmentNoCache(environment, flipY, tex)

        return this.pmremCache[environment.path]

    }

    async _loadPMREMEnvironmentNoCache( environment, flipY = false, tex = null) {

        const pmremGenerator = await this.getPMREMGenerator()



        const ownsSource = tex == null;
        if(tex == null){

            const { texture } = await this.loadRGBE(environment.path);
            texture.flipY = flipY

            tex = texture

        }

        tex.needsUpdate = true


        if( FBO_DEBUG ) {

            if(this.fboHelper == null){

                this.fboHelper = (await import('@3gl/globals/fbohelper.js')).default
            }

            this.fboHelper.attach(tex, 'tex' + Math.random() )

        }

        // const { texture } = await this.loadRGBE(environment.path);
        // texture.flipY = flipY

        const temp = pmremGenerator.fromEquirectangular(tex)
        if (ownsSource) tex.dispose();


        // console.log(tem)

        // @ts-ignore
        temp.texture.renderTarget = temp

        let envMap = temp.texture

        envMap.magFilter = LinearFilter

        envMap.userData.isShared = true


        if( FBO_DEBUG ) {

            if(this.fboHelper == null){

                this.fboHelper = (await import('@3gl/globals/fbohelper.js')).default
            }

            this.fboHelper.attach(envMap, 'tex' + Math.random() )

        }

        return envMap;
    }

    async exportGLTF( originalGLTFScene, options ){

        if( this.gltfExporter == null ) {
            const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter')
            this.gltfExporter = new GLTFExporter()
        }

        const url = CURRENT_SPACE.roomParameters.uPath.fileURL
        const original = await this.loadGLTF(url, false)
        const result = await new Promise((resolve, reject) => {
            this.gltfExporter.parse(original.scene, resolve, reject, {
                binary: true,
                animations: original.animations
            })
        })

        this.save(new Blob([result], { type: 'application/octet-stream' }), 'whatever.glb')
        return result
    }

    async loadJson( url ){

        const reponse = await fetch(url, {})

        const data = await reponse.json()

        return data
    }

    save( blob, filename ) {

        const link = document.createElement( 'a' );
        link.style.display = 'none';
        document.body.appendChild( link )

        link.href = URL.createObjectURL( blob );
        link.download = filename;
        link.click();

        document.body.removeChild(link)

    }
}

export default new Loader()
