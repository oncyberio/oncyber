// @ts-check
import { LabelAbstract } from "./abstract"

import {
    Group,
    SpriteMaterial,
    CanvasTexture,
    Sprite,
    Vector3,
    Mesh,
    Object3D,
    MeshBasicMaterial,

} from "three"


import gsap from "gsap"

import { LABEL_STATES } from "./constants"


const tmpVec3 = new Vector3()

export const OPENING_TEXT = ""

import Emitter from '@3emitter'


import Events from '@3events'

import Smoothstep from '@3utils/math/smoothstep'

import { IS_FIRST_PERSON, IS_MOBILE, IS_TOUCH } from "../../constants"

import { SpaceItem } from "../../factory/abstract/spaceitem"

import Players from "@3factory/player"

import camera from "../../camera"

export class SpaceLabel extends LabelAbstract {

    constructor(opts) {

        super(opts);

    }

    async setState(state, opts) {

        console.log("label/setState", state, opts)

        switch (state) {

            case LABEL_STATES.ATTACHED:

                if(opts.parent && this.parent != opts.parent) {

                    opts.parent.add(this)
                }

                if (opts.isElevator) {

                    this.elevatorLabel = true;

                    console.log("IN THE FIRST STATE")
                    console.log(opts)

                    this.setElevator(opts.levels, opts.currentLevel, opts.currentActive)
                } else {

                    this.elevatorLabel = false;

                    this.set(opts.message, opts.iconUrl, opts.flipY)
                }

                if(opts.mesh) {

                    this.attachLabelTo(opts.mesh)
                }
                else if(opts.target) {

                    this.setCoordsFromTarget(opts.target, opts.distance)
                }

                break

            case LABEL_STATES.DETACHED:

                this.hide(opts?.force)

                break

        }
    }


    async setElevator (levels, currentLevel, currentActive) {

        this.intersects = [];

        this.ctx.save();

        const x = 25;

        const fontSize = 9;

        this.ctx.font = "bold 12px 'SpaceGrotesk', Arial, sans-serif";

        const max = "Floor 3: Observation circle".length;

        const metrics = this.ctx.measureText("Floor 3: Observation circle");

        const sprite = this.sprite

        const itemHeight = 100;

        const canvasWidth = (42)
        // const canvasWidth = (20 + 12 + metrics.width + 20 + 20)

        const canvasHeight = itemHeight * levels.length;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        this.roundRect(0, 0, canvasWidth * 2, itemHeight * levels.length, 10);

        this.ctx.clip()

        for (let i = 0; i < levels.length; i++) {

            this.item({
                posY: itemHeight * i,
                height: itemHeight,
                isStart: i === 0,
                width: canvasWidth * 2,
                isEnd: i === levels.length - 1,
                isActive: currentActive === levels[i].id,
                isCurrent: currentLevel ===levels[i].id
            })

            this.intersects.push({
                level: levels[i],
                posY: (itemHeight * i) / canvasHeight
            })
        }

        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

        this.ctx.scale(2, 2)

        const y = (itemHeight) / 2;

        for (let i = 0; i < levels.length; i++) {

            const yPos = y * (i + 1) - itemHeight / 4;

            const xPos = x - 11;

            let color = "rgba(255, 255, 255, 1)";

            if ( currentActive === levels[i].id ) {
                color = "rgba(255, 255, 255, 0.2)";
            } else if ( currentLevel ===levels[i].id ) {
                color = "rgba(255, 255, 255, 0.1)";
            }

            this.drawBox(this.ctx, (levels[i].level).toString(), xPos, yPos, color)
        }

        // for (let i = 0; i < levels.length; i++) {

        //     const yPos = y * (i + 1) - itemHeight / 4;

        //     const xPos = x * 3.5;

        //     const text = levels[i].name;

        //     const dText = text.length > max ? text.slice(0, max) + "..." : text;

        //     let color = "rgba(255, 255, 255, 1)";

        //     if ( currentActive === levels[i].id ) {
        //         color = "rgba(255, 255, 255, 1)";
        //     } else if ( currentLevel ===levels[i].id ) {
        //         color = "rgba(255, 255, 255, 0.1)";
        //     }

        //     this.ctx.fillStyle = color;

        //     this.ctx.textAlign = "center"

        //     this.ctx.fillText(dText, xPos, yPos);
        // }

        this.ctx.restore();

        const texture = sprite.material.map

        texture.image = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

        texture.generateMipmaps = true

        texture.needsUpdate = true

        sprite.material.needsUpdate = true

        sprite.scale.set(2, 2, 2)
    }

    roundRect( left, top, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(left + radius, top);
        this.ctx.lineTo(left + width - radius, top);
        this.ctx.arcTo(left + width, top, left + width, top + radius, radius);
        this.ctx.lineTo(left + width, top + height - radius);
        this.ctx.arcTo(left + width, top + height, left + width - radius, top + height, radius);
        this.ctx.lineTo(left + radius, top + height);
        this.ctx.arcTo(left, top + height, left, top + height - radius, radius);
        this.ctx.lineTo(left, top + radius);
        this.ctx.arcTo(left, top, left + radius, top, radius);
        this.ctx.closePath();
    }

    drawBox(ctx, number, x, y, fill) {

        ctx.save();

        ctx.font = "bold 10px 'SpaceGrotesk', Arial, sans-serif";

        const metrics = ctx.measureText(number)

        const boxSize = 14;

        const _y = y - (5 * 1.7);

        const _x = x;

        ctx.fillStyle = fill;

        ctx.beginPath();

        this.roundRect(_x, _y, boxSize, boxSize, 2);

        ctx.fill();

        ctx.fillStyle = "black";

        ctx.translate(_x, _y);

        ctx.fillText(number, (boxSize / 2) - ( metrics.width / 2), boxSize / 1.3);

        ctx.restore();
    }

    item({
        posY = 0,
        height = 80,
        width = 300,
        borderHeight = 25,
        isStart = false,
        isEnd = false,
        isActive = false,
        isCurrent = false
    }) {

        this.ctx.beginPath();

        const lineWidth = 2;

        if (!isStart) {
            posY += lineWidth;
        }

        if (!isStart) {
            this.ctx.lineWidth = lineWidth;

            this.ctx.lineTo(0, posY);

            this.ctx.lineTo((width / 2) - borderHeight, posY);

            this.ctx.lineTo((width / 2), posY - borderHeight);

            this.ctx.lineTo((width / 2) + borderHeight, posY);

            this.ctx.lineTo(width, posY);

            this.ctx.strokeStyle = "#626161";

            this.ctx.stroke();
        }

        if (isEnd) {

            this.ctx.moveTo(0, posY);

            this.ctx.lineTo(0, posY + height);

            this.ctx.lineTo(width, posY + height);

            this.ctx.lineTo(width, posY);

        } else {

            this.ctx.moveTo(0, posY);

            this.ctx.lineTo(0, posY + height);

            this.ctx.lineTo(0, posY);

            this.ctx.lineTo(0, posY + height);

            this.ctx.lineTo((width / 2) - borderHeight, posY + height);

            this.ctx.lineTo((width / 2), posY - borderHeight + height);

            this.ctx.lineTo((width / 2) + borderHeight, posY + height);

            this.ctx.lineTo(width, posY + height);

            this.ctx.lineTo(width, posY);
        }

        if (isCurrent) {

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
        } else {

            this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
        }

        this.ctx.fill();
    }

    addEvents = () => {
        super.addEvents();

        Emitter.on(Events.CLICK, this.onClick);

    }

    removeEvents = () => {
        super.removeEvents();

        Emitter.off(Events.CLICK, this.onClick);
    }

    onClick = () => {

        Emitter.emit(Events.CURRENT_LABEL_CLICKED, {

            type: Events.CURRENT_LABEL_CLICKED,

            value: { current: this.currentIntersect }

        })
    }


    raycastCallBack = (e) => {

        if (!this.elevatorLabel) return;

        let current = null;

        if (e.active) {

            // -1 because it is translated of x, check geometry

            const y = (e.intersect.object.parent.position.y - e?.intersect?.point?.y + 1) / 2;

            for (let i = 0; i < this.intersects.length; i++) {

                if (this.intersects[i].posY <= y) {

                    current = this.intersects[i];
                }
            }

            if (current) {

                current = current;

            }

        }

        this.currentIntersect = current

        Emitter.emit(Events.CUSTOM, {

            type: Events.CURRENT_LABEL_HOVERED,

            value: { isHovered: e.active, current }

        })
    }

    // updateMatrixWorld(force) {

    //     super.updateMatrixWorld(force)
    // }

    /**
     * @param { gsap.core.Tween } tween
     */
    onComplete(tween) {

        if(this.tween != tween) return

        if (this.currentState === LABEL_STATES.SHOWING) {

            this.currentState = LABEL_STATES.ATTACHED
        }
        else if (this.currentState === LABEL_STATES.HIDING) {

            this.currentState = LABEL_STATES.DETACHED

            this.setVisible(false)
        }
    }

    /**
     * @param { Mesh } mesh
     */
    attachLabelTo(mesh) {

        if (this.currentState === LABEL_STATES.ATTACHED || this.currentState === LABEL_STATES.SHOWING) {

            if (this.mesh === mesh) {

                return
            }
        }

        this.tween?.kill()

        this.currentState = LABEL_STATES.SHOWING

        this.mesh = mesh

        this.setVisible(true)

        this.opacity = 0

        this.tween = this.animateMaterialTo({ opacity: 1 })

        if(this.mesh?.geometry) {

            this.mesh.getWorldQuaternion(this.quaternion)

            this.mesh.getWorldPosition(this.position)

            this.mesh.getWorldScale(tmpVec3)

            if(this.mesh.geometry.boundingBox == null) {

                this.mesh.geometry.computeBoundingBox()
            }

            this.translateX(this.mesh.geometry.boundingBox.max.x * tmpVec3.x + 0.3, 0, 0.5)
        }
    }

    /**
     * @param { Object3D } target
     * @param { number } distance
     */
    setCoordsFromTarget(target, distance) {

        this.tween?.kill()

        this.tween = null

        this.mesh = null

        this.currentState = LABEL_STATES.ATTACHED

        var cameraDirection = new Vector3()
        var cameraPosition = new Vector3()

        target.getWorldDirection(cameraDirection)
        target.getWorldPosition(cameraPosition)

        cameraDirection.normalize()

        this.position
            .copy(cameraDirection)
            .multiplyScalar(distance)
            .add(cameraPosition)

        this.position.y = cameraPosition.y

        if(this.sprite.geometry.boundingBox == null) {

            this.sprite.geometry.computeBoundingBox()
        }

        this.quaternion.copy(target.quaternion)

        this.sprite.visible = true

        this.setVisible(true);

        this.opacity = 1;

    }

    hide(force = false) {

        // forcing hidding the label
        if (force) {
            this.tween?.kill()

            this.tween = this.animateMaterialTo({ opacity: 0 })

            this.currentState = LABEL_STATES.DETACHED

            this.mesh = null

            this.tween = null

            return;
        }

        if(this.currentState === LABEL_STATES.HIDING) return

        this.tween?.kill()

        if (this.currentState === LABEL_STATES.ATTACHED) {

            this.currentState = LABEL_STATES.HIDING

            this.tween = this.animateMaterialTo({ opacity: 0 })
        }
        else {

            this.currentState = LABEL_STATES.DETACHED

            this.mesh = null

            this.tween = null
        }
    }

    animateMaterialTo(target) {

        const onComplete = () => this.onComplete(tween)

        if( this.animateTween ){

            this.animateTween.kill()

            this.animateTween = null
        }


        const tween = gsap.to(this, {
            ...target,

            duration: 0.350,

            onComplete
        })

        this.animateTween  = tween

        return tween;
    }


    update(){

        let distance = 0;

        if (IS_FIRST_PERSON) {

            distance = camera.current.position.distanceTo(this.position)
        } else {

            distance = Players.main.position.distanceTo(this.position)
        }


        const op = this.opacity * Smoothstep(25.0, 10.0, distance)

        this.sprite.material.opacity = op;

        this.visible = op > 0
    }


    dispose() {


        // disposeObject3D(this);

        // if (this.parent) {

        //     this.parent.remove(this);
        // }
    }
}
