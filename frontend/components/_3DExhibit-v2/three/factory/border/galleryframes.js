// @ts-check

import {

    BoxGeometry,
    CanvasTexture,
    Color,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    Vector3,

} from "three"

import InstancedGeometry from "@3abstract/instancedgeometry"

import InstancedPipelineMesh from "@3abstract/instancedpipelinemesh.js"

import PipeLineMesh from "@3abstract/pipelinemesh"

import { artworkDepth } from "@3utils/spaceutils"

import GalleryFrameMaterial from "./galleryframematerial"

import {

    LABEL_CORNER,
    galleryFrameLayout,
    galleryLabelText,
    galleryMouldingColor,

} from "./galleryFrame"

const PLATE_COLOR = "#f3f1ec"

const _v = new Vector3()

/**
 * Every gallery frame in a space, drawn as one instanced mesh of boxes
 * (moulding, mat, backing and label plate of every framed artwork), so a
 * room of framed art costs one draw call plus one per wall label's text.
 */
export class GalleryFrames {

    constructor() {

        /** @type { any } InstancedPipelineMesh: its `add` takes instances, not children */
        this.mesh = null

        /** @type { Map<any, { wrappers: any[], label: any, labelKey: string }> } */
        this.entries = new Map()

        /** @type { import("three").Object3D | null } */
        this.parent = null
    }

    /**
     * @param { import("three").Object3D } parent
     */
    attachTo(parent) {

        this.parent = parent

        if(this.mesh) parent.add(this.mesh)
    }

    getMesh() {

        if(this.mesh == null) {

            this.mesh = new InstancedPipelineMesh(

                new InstancedGeometry(new BoxGeometry(1, 1, 1), {
                    max: 16,
                    color: true,
                    scale: true,
                    rotation: true,
                    useNormal: true,
                    border: true,
                }),

                new GalleryFrameMaterial(),

                {
                    type: "INSTANCED_GALLERY_FRAME",

                    occlusionMaterial: new GalleryFrameMaterial(),
                }
            )

            this.mesh.name = "galleryFrames"

            this.parent?.add(this.mesh)
        }

        return this.mesh
    }

    /**
     * Lays out (or removes) the frame of `artwork` from its current size,
     * transform and `galleryFrame` settings.
     *
     * @param { any } artwork a SpaceArtwork
     */
    set(artwork) {

        const frame = artwork.galleryFrame

        const userData = artwork.mesh?.userData

        const width = userData?.artworkWidth

        const height = userData?.artworkHeight

        if(!frame || !(width > 0) || !(height > 0)) {

            this.remove(artwork)

            return
        }

        const artworkData = artwork.artworkData || {}

        const labelText = frame.label ? galleryLabelText(artworkData, frame.credit) : null

        const layout = galleryFrameLayout({
            width,
            height,
            depth: artworkDepth(artwork.opts?.roomParameters || {}),
            scale: artwork.scale,
            frame,
            withLabel: labelText != null,
            creditLabel: labelText?.credit != null,
            roundedLabel: frame.labelRounded,
        })

        const mesh = this.getMesh()

        let entry = this.entries.get(artwork)

        if(entry == null) {

            entry = { wrappers: [], label: null, labelKey: "" }

            this.entries.set(artwork, entry)
        }

        const boxes = layout.boxes

        while(entry.wrappers.length > boxes.length) {

            mesh.remove(entry.wrappers.pop())
        }

        while(entry.wrappers.length < boxes.length) {

            entry.wrappers.push(mesh.add({
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                color: new Color(),
                border: 0,
            }))
        }

        const moulding = galleryMouldingColor(artworkData.borderColor)

        const quaternion = artwork.quaternion

        const position = artwork.position

        for(let i = 0; i < boxes.length; i++) {

            const box = boxes[i]

            const wrapper = entry.wrappers[i]

            _v.set(box.x, box.y, box.z).applyQuaternion(quaternion).add(position)

            wrapper.updateCoords(_v, quaternion, { x: box.w, y: box.h, z: box.d })

            const color = box.part === "frame" ? moulding :
                box.part === "mat" ? frame.matColor :
                box.part === "label" ? (labelText?.credit ? "#ffffff" : PLATE_COLOR) :
                // the backing shows through transparent images
                frame.mat ? frame.matColor : moulding

            wrapper.setColor(color)

            wrapper.setBorder(box.part === "frame" ? 1 : 0)
        }

        this.setLabel(artwork, entry, layout.label, labelText, frame.labelRounded)
    }

    /**
     * The label's words, as a textured plane on the plate. A child of the
     * artwork, so it follows the artwork's transform.
     */
    setLabel(artwork, entry, rect, text, rounded = false) {

        if(rect == null || text == null) {

            this.disposeLabel(artwork, entry)

            return
        }

        const key = JSON.stringify(text) + (rounded ? "|r" : "")

        if(entry.label == null || entry.labelKey !== key) {

            this.disposeLabel(artwork, entry)

            if(text.credit) loadLabelFont()

            const draw = () => text.credit ? drawCreditLabel(text.credit, rounded) : drawLabel(text, rounded)

            const texture = new CanvasTexture(draw())

            texture.anisotropy = 4

            texture.colorSpace = SRGBColorSpace

            const label = new PipeLineMesh(

                new PlaneGeometry(1, 1),

                // A rounded plate is the label itself, its corners cut out of the texture.
                new MeshBasicMaterial({ map: texture, transparent: rounded || !text.credit, toneMapped: false, fog: false }),

                { visibleOnOcclusion: false }
            )

            label.name = "galleryLabel"

            entry.label = label

            entry.labelKey = key

            artwork.add(label)

            // Credit labels are set in Open Sans: redraw once it has loaded.
            if(text.credit && !labelFontReady) {

                loadLabelFont().then((ok) => {

                    if(!ok || entry.label !== label) return

                    texture.image = draw()

                    texture.needsUpdate = true
                })
            }
        }

        const scale = artwork.scale

        const label = entry.label

        // the plate's face, in the artwork's (scaled) space
        label.position.set(
            rect.x / scale.x,
            rect.y / scale.y,
            (rect.z + rect.h * 0.01) / (scale.z || 1)
        )

        label.scale.set(rect.w / scale.x, rect.h / scale.y, 1)
    }

    disposeLabel(artwork, entry) {

        if(entry.label == null) return

        const label = entry.label

        label.parent?.remove(label)

        label.geometry.dispose()

        label.material.map?.dispose()

        label.material.dispose()

        entry.label = null

        entry.labelKey = ""
    }

    /**
     * @param { any } artwork
     */
    remove(artwork) {

        const entry = this.entries.get(artwork)

        if(entry == null) return

        for(const wrapper of entry.wrappers) this.mesh?.remove(wrapper)

        this.disposeLabel(artwork, entry)

        this.entries.delete(artwork)
    }

    dispose() {

        for(const artwork of [...this.entries.keys()]) this.remove(artwork)

        if(this.mesh) {

            this.mesh.parent?.remove(this.mesh)

            this.mesh.dispose()

            this.mesh.geometry.dispose()

            this.mesh = null
        }

        this.parent = null
    }
}

/**
 * Title (and artist) on a transparent canvas, dark ink for a light plate.
 *
 * @param { { title: string, artist: string } } text
 * @param { boolean } rounded draw the plate too, with rounded corners
 */
function drawLabel({ title, artist }, rounded = false) {

    const canvas = document.createElement("canvas")

    canvas.width = 512

    canvas.height = 232

    const ctx = canvas.getContext("2d")

    // square plates are boxes drawn behind this transparent text
    if(rounded) fillPlate(ctx, canvas, PLATE_COLOR, true)

    const pad = 34

    const maxWidth = canvas.width - pad * 2

    ctx.fillStyle = "#1d1d1d"

    ctx.textBaseline = "top"

    ctx.font = "600 40px 'Helvetica Neue', Arial, sans-serif"

    const lines = wrap(ctx, title, maxWidth, 2)

    let y = pad

    for(const line of lines) {

        ctx.fillText(line, pad, y)

        y += 48
    }

    if(artist) {

        ctx.fillStyle = "#555555"

        ctx.font = "400 30px 'Helvetica Neue', Arial, sans-serif"

        ctx.fillText(fit(ctx, artist, maxWidth), pad, y + 10)
    }

    return canvas
}

const LABEL_FONT = "'Open Sans', 'Helvetica Neue', Arial, sans-serif"

/** @type { Promise<boolean> | null } */
let labelFont = null

let labelFontReady = false

/** Loads the label face (self-hosted Open Sans 400/700) once. */
function loadLabelFont() {

    if(labelFont) return labelFont

    if(typeof FontFace === "undefined" || typeof document === "undefined") {

        return (labelFont = Promise.resolve(false))
    }

    const faces = [
        ["400", "/fonts/OpenSans/OpenSans-Regular.woff2"],
        ["700", "/fonts/OpenSans/OpenSans-Bold.woff2"],
    ].map(([weight, url]) => new FontFace("Open Sans", `url(${url}) format("woff2")`, { weight }))

    labelFont = Promise.all(faces.map((face) => face.load()))
        .then((loaded) => {

            for(const face of loaded) document.fonts.add(face)

            labelFontReady = true

            return true
        })
        .catch(() => false)

    return labelFont
}

/**
 * A gallery credit, laid out like a museum wall label: the artist's name
 * large and bold, their location, the artwork title in bold, then a gap and
 * the X handle and website with small icons. Drawn on white, so the plate
 * reads as a printed card. Empty fields are left out and the rest close up.
 *
 * @param { { artist: string, location: string, title: string, x: string, website: string } } credit
 * @param { boolean } rounded draw the card with rounded corners
 */
function drawCreditLabel(credit, rounded = false) {

    const canvas = document.createElement("canvas")

    // 278 × 159 reference plate, drawn at ~2.75×
    canvas.width = 768

    canvas.height = Math.round(768 * 0.58)

    const ctx = canvas.getContext("2d")

    fillPlate(ctx, canvas, "#ffffff", rounded)

    const pad = 46

    const maxWidth = canvas.width - pad * 2

    ctx.fillStyle = "#111111"

    ctx.textBaseline = "alphabetic"

    let y = pad

    if(credit.artist) {

        ctx.font = `700 72px ${LABEL_FONT}`

        y += 62

        ctx.fillText(fit(ctx, credit.artist, maxWidth), pad - 3, y)
    }

    if(credit.location) {

        ctx.font = `400 42px ${LABEL_FONT}`

        y += credit.artist ? 50 : 40

        ctx.fillText(fit(ctx, credit.location, maxWidth), pad, y)
    }

    if(credit.title) {

        ctx.font = `700 42px ${LABEL_FONT}`

        for(const line of wrap(ctx, credit.title, maxWidth, 2)) {

            y += y === pad ? 40 : 54

            ctx.fillText(line, pad, y)
        }
    }

    const links = [

        credit.x ? { icon: drawXIcon, text: "@" + credit.x } : null,

        credit.website ? { icon: drawGlobeIcon, text: credit.website } : null,

    ].filter(Boolean)

    // links sit at the foot of the card, as in the reference
    const step = 50

    let ly = canvas.height - pad + 4 - (links.length - 1) * step

    ly = Math.max(ly, y + 84)

    ctx.font = `400 36px ${LABEL_FONT}`

    for(const link of links) {

        if(ly > canvas.height - 12) break

        link.icon(ctx, pad, ly - 28, 30)

        ctx.fillStyle = "#222222"

        ctx.fillText(fit(ctx, link.text, maxWidth - 46), pad + 46, ly)

        ly += step
    }

    return canvas
}

/** The X logo in a `size` square at (x, y). */
function drawXIcon(ctx, x, y, size) {

    const s = size / 24

    ctx.save()

    ctx.translate(x, y)

    ctx.scale(s, s)

    ctx.fillStyle = "#111111"

    ctx.fill(new Path2D("M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"))

    ctx.restore()
}

/** A line globe in a `size` square at (x, y). */
function drawGlobeIcon(ctx, x, y, size) {

    const r = size / 2 - 1.5

    const cx = x + size / 2

    const cy = y + size / 2

    ctx.save()

    ctx.strokeStyle = "#111111"

    ctx.lineWidth = 2.6

    ctx.beginPath()

    ctx.arc(cx, cy, r, 0, Math.PI * 2)

    ctx.moveTo(cx - r, cy)

    ctx.lineTo(cx + r, cy)

    ctx.moveTo(cx - r * 0.88, cy - r * 0.48)

    ctx.lineTo(cx + r * 0.88, cy - r * 0.48)

    ctx.moveTo(cx - r * 0.88, cy + r * 0.48)

    ctx.lineTo(cx + r * 0.88, cy + r * 0.48)

    ctx.stroke()

    ctx.beginPath()

    ctx.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2)

    ctx.stroke()

    ctx.restore()
}

/**
 * The plate's face: the whole canvas, or a rounded card whose corners stay
 * transparent.
 */
function fillPlate(ctx, canvas, color, rounded) {

    ctx.fillStyle = color

    if(!rounded) {

        ctx.fillRect(0, 0, canvas.width, canvas.height)

        return
    }

    const r = canvas.height * LABEL_CORNER

    ctx.beginPath()

    ctx.roundRect(0, 0, canvas.width, canvas.height, r)

    ctx.fill()
}

function fit(ctx, text, maxWidth) {

    if(ctx.measureText(text).width <= maxWidth) return text

    let cut = text

    while(cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) {

        cut = cut.slice(0, -1)
    }

    return cut.trimEnd() + "…"
}

function wrap(ctx, text, maxWidth, maxLines) {

    const words = text.split(" ")

    const lines = []

    let line = ""

    for(const word of words) {

        const next = line ? line + " " + word : word

        if(ctx.measureText(next).width <= maxWidth || !line) {

            line = next
        }
        else {

            lines.push(line)

            line = word
        }
    }

    if(line) lines.push(line)

    if(lines.length > maxLines) {

        const kept = lines.slice(0, maxLines)

        kept[maxLines - 1] = fit(ctx, lines.slice(maxLines - 1).join(" "), maxWidth)

        return kept
    }

    return lines.map((it) => fit(ctx, it, maxWidth))
}
