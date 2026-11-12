
// @ts-check

import { SRGBColorSpace, Vector3 } from "three"

import Raycaster from "@3raycaster"


import Emitter from "@3emitter"

import Events from "@3events"

import { HTMLSpaceArtwork } from "../meshes/html/HTMLspaceartwork"

import Augmented from "@3abstract/augmented"
import { EDIT_MODE } from "@components/_3DExhibit-v2/three/constants"


// Cap the generative HTML draw loop (its requestAnimationFrame callbacks) to
// ~30fps. Those callbacks are the dominant per-frame cost of HTML content;
// running them every render frame (esp. on 120Hz displays) is wasteful and
// visually indistinguishable for virtually all generative pieces.
const HTML_FRAME_MS = 1000 / 30


export class HTMLCanvasController extends Augmented {


    /**
     *
     * @param { import("@gltypes").HTMLArtworkOptions }  opts
     */
    constructor(opts) {

        super()

        this.opts = opts

        this.mesh = opts.mesh

        this.htmlText = opts.htmlText

        this.baseUrl = opts.baseUrl

        this.foreverPlay = opts.foreverPlay || false

        this.prevLookedAtPoint = new Vector3();

        /** @type { HTMLElement } */
        this.dom = null;

        /** @type { HTMLIFrameElement }  */
        this.iframe = null

        this.docProxy = {
            callbacks: []
        }

        /** @type { HTMLCanvasElement } */
        this.currentCanvas = null

        this.canvasTimestamp = 0

        this.checkCanvasFPS = 3

        this._badBoy = false

        this.isPaused = true

        this._offenses = 0

        this._lookedatTime = Infinity

        this.checkPlaybackStateFPS = 3

        this.currentFrame = 0

        this.colorSpace = SRGBColorSpace

        this.addEvents()

        // if(opts.item.data.autoPlay) {

        //     this.play()
        // }
    }

    getDisplayCanvas() {

        // Find the greatest visible canvas
        let cs = this.iframe.contentDocument.querySelectorAll("canvas")

        /** @type { HTMLCanvasElement } */
        let canvas

        for (let i = 0; i < cs.length; i++) {

            const c = cs[i]

            if (isVisible(c)) {

                if (
                    canvas == null ||
                    (c.width > canvas.width && c.height > canvas.height)
                ) {

                    canvas = c
                }
            }
        }
        // check for svg rendered art like https://generator.artblocks.io/76000091
        let svg = this.iframe.contentDocument.querySelector("svg")

        if (svg != null && isVisible(svg)) return null

        return canvas
    }

    // @ts-ignore
    update = (e) => {

        if (this.isWorldPaused ) return;

        if(!this.enabled || this.wasDisposed) {

            console.error("[Potential memory leak] HtmlCanvasTexture.update after dispose/removeEvents")

            return
        }

        if(this.mesh.parent == null) return;

        this.currentFrame++

        if((this.currentFrame % this.checkPlaybackStateFPS) === 0) {

            this.updatePlaybackState()
        }

        if (
            this.isPaused ||
            this._badBoy ||
            this.iframe == null
        )
            return

        if(this.checkCanvasFPS < 500 && (this.currentFrame % this.checkCanvasFPS) === 0) {

            this.updateCanvas()
        }

        // Throttle the generative draw loop to ~30fps regardless of render fps.
        const nowTick = performance.now()

        if (nowTick - (this._lastTick || 0) < HTML_FRAME_MS) return

        this._lastTick = nowTick

        const then = performance.now()

        let cbs = this.docProxy.callbacks.slice()

        this.docProxy.callbacks.length = 0

        for (let i = 0; i < cbs.length; i++) {

            cbs[i](then)
        }

        const now = performance.now()

        cbs = null

        if (now - then > 30) {

            this._offenses++

            if (this._offenses > 100) {

                this._badBoy = true

                this.pause()

                console.log(
                    "bad boy detected",
                    this.mesh.parent.userData.name,
                    this.mesh.parent.userData.animation_url,
                    "took ",
                    now - then,
                    "ms"
                )
            }
            return
        }
    }

    updatePlaybackState() {

        const artwork = this.mesh.parent

        const now = performance.now()

        const isVisible = artwork.isVisibleToCamera

        if (EDIT_MODE) {

            if (artwork.isSelected) {

                this.play()
            }
            else {

                this.pause()
            }

            return
        }

        if (!artwork.isLookedAt) {

            this._lookedatTime = Infinity;
        }
        else {

            // Just entered, starts counting looked at time
            if (this._lookedatTime === Infinity) {

                this._lookedatTime = now
            } else {

                // if camera is moving, then resets looked at time
                let movement = this.prevLookedAtPoint.distanceToSquared(artwork.lookedAtPoint)

                if (movement > 0.001 && this.isPaused) this._lookedatTime = now
            }

            this.prevLookedAtPoint.copy(artwork.lookedAtPoint)
        }

        if (artwork.isLookedAt && now - this._lookedatTime > 300) {

            this.play()
        }
        else if (
            (!isVisible && !this.foreverPlay) ||
            this.isAnotherHTMLPlaying()
        ) {
            this.pause()
        }
    }

    isAnotherHTMLPlaying() {

        const lookedAtArtwork = Raycaster.lookedAtItem

        return (
            lookedAtArtwork instanceof HTMLSpaceArtwork &&
            lookedAtArtwork !== this.mesh.parent &&
            lookedAtArtwork.canvasTexture?.htmlController?.isPlaying
        )
    }

    updateCanvas() {

        let canvas = this.getDisplayCanvas()

        const now = performance.now()

        if (canvas == null) {

            this.currentCanvas = null

            this.canvasTimestamp = 0

            this.checkCanvasFPS = 3
        }
        else {

            if (canvas != this.currentCanvas) {

                this.currentCanvas = canvas

                this.canvasTimestamp = now

                this.checkCanvasFPS = 3
            }
            else {

                // Exponentially raise this, it's likely that if keep getting the same
                // canvas that the artblock has settled on a main canvas
                this.checkCanvasFPS *= 2

                // switching to canvas rigth away will show flickering
                // So wait a little until the canvas draws something
                if (now - this.canvasTimestamp > 30) {

                    // console.log("HTML's got a new canvas", this)

                    this.emit(Events.
                        HTML_PLAYING, {
                        canvas: this.currentCanvas
                    })

                }
            }
        }

    }

    /**
     * @returns { HTMLCanvasElement }
     */
    get canvas() {


        return performance.now() - this.canvasTimestamp > 30
                    ?  this.currentCanvas
                    : null
    }

    load() {



        const div = document.createElement("div")

        div.style.position = "fixed"
        div.style.top = "0px"
        div.style.left = "0px"
        div.style.width = "300px"
        div.style.height = "300px"
        div.style.visibility = "hidden"

        const iframe = document.createElement("iframe")

        iframe.style.width = "100%"
        iframe.style.height = "100%"
        iframe.style.border = "none"

        div.appendChild(iframe)

        document.body.appendChild(div)

        this.dom = div

        this.iframe = iframe

        try {

            // script will not execute until dom is added to the document
            document.body.appendChild(this.dom)

            loadIframe(this.iframe, this.htmlText, this.baseUrl)

            this.docProxy = proxyRAF(this.iframe.contentWindow)
        }
        catch (error) {

            console.error("[HTMLCanvasController.load] Unable to fetch HTML of asset")
        }
    }

    unload() {

        this.dom?.remove()

        this.dom = null

        this.currentCanvas = null

        this.docProxy = null

        this.canvasTimestamp = 0

        this.checkCanvasFPS = 3
    }

    get isPlaying() {

        return this.dom?.parentElement && this.currentCanvas
    }

    async play() {

        if(!this.isPaused || this._badBoy) return

        this.isPaused = false

        // console.log("html play", this.opts.item.data.name)

        return this.onStateChange()
    }

    pause() {

        if (this.isPaused) return

        this.isPaused = true;

        // console.log("html pause", this.opts.item.data.name)

        this.onStateChange()
    }

    async onStateChange() {

        if (!this.isWorldPaused && !this.isPaused ) {

            if(this.dom == null) {

                this.load()
            }
        }
        else {

            this.unload()

            this.emit(Events.HTML_PAUSED, {})
        }
    }

    onPlay = () => {

        this.isWorldPaused = false

        this.onStateChange()
    }

    onPause = () => {

        this.isWorldPaused = true

        this.onStateChange()
    }

    addEvents() {

        // if(this.mesh.parent.wasDisposed) {
        //     throw new Error("videoController, addEvents called after dispose")
        // }

        if(this.enabled) return

        this.enabled = true

        // console.log("videoController.addEvents")

        Emitter.on(Events.PLAY, this.onPlay)

        Emitter.on(Events.PAUSE, this.onPause)

        Emitter.on(Events.PRE_UPDATE, this.update)
    }

    removeEvents() {

        this.enabled = false

        // console.log("videoController.removeEvents")

        Emitter.off(Events.PLAY, this.onPlay)

        Emitter.off(Events.PAUSE, this.onPause)

        Emitter.off(Events.PRE_UPDATE, this.update)
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.unload()

        this.removeEvents()

        this.opts = null

        this.dom = null

        this.iframe = null

        this.docProxy = null

        this.currentCanvas = null
    }
}


/**
 *
 * @param { HTMLElement | SVGElement } element
 * @returns { boolean }
 */
function isVisible(element) {
    return (
        element.style.display != "none" && element.style.visibility != "hidden"
    );
}

/**
 *
 * @param { HTMLIFrameElement } iframe
 */
function eraseIframeContent(iframe) {
    iframe.contentDocument.open();
    iframe.contentDocument.write("");
    iframe.contentDocument.close();
}


/**
 *
 * @param { HTMLIFrameElement } iframe
 * @param { string } html
 * @param { string } baseUrl
 */
function loadIframe(iframe, html, baseUrl) {

    if(baseUrl.endsWith("index.html")) {
        baseUrl = baseUrl.slice(0, baseUrl.length - "index.html".length)
    }

    if (!baseUrl.endsWith("/")) {
        baseUrl = baseUrl + "/";
    }
    // console.log("changing base url", baseUrl);
    // html = html.replace(/\<head\>/i, `<head><base href=${baseUrl} />`);
    iframe.contentDocument.open();
    iframe.contentDocument.write(`<base href=${baseUrl} />`);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    // const base = document.createElement("base");
    // base.setAttribute("href", baseUrl);
    // iframe.contentDocument.body.appendChild(base);
}

/**
 *
 * @param { Window } w
 * @returns
 */
function proxyRAF(w) {
    // @ts-ignore
    let _raf = w.requestAnimationFrame;

    let callbacks = [];

    w.requestAnimationFrame = function (cb) {
        // console.trace("rafProxy", cb)
        callbacks.push(cb)
        return 0;
    };

    return {
        callbacks,
    };
}
