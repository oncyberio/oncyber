// @ts-check
import Emitter from '@3emitter'

import Events from "@3events"

import Camera from '@3camera'

import { EDIT_MODE, IS_FIRST_PERSON, IS_TOUCH } from '@components/_3DExhibit-v2/three/constants'

import Players from "@components/_3DExhibit-v2/three/factory/player";

import { SitZoneSpaceArtwork } from './zones/sitzonespaceartwork';

import Root from "@components/_3DExhibit-v2/three/root";

import Scene from '@3scene'

export class TriggerManager {

    constructor() {
        this.objects = []

        this.addEvents()

        this.closestZone = null;
    }

    add(object) {

        this.objects.push(object)
    }


    update = () => {

        // if (EDIT_MODE) return;

        if (this.objects.length === 0) return;

        if (Players.main.isSitting) return;

        const position = IS_FIRST_PERSON ? Camera.current.position : Camera.currentControls.world?.thirdPersonPos

        let closestZoneDistance = Infinity;

        let closestZone = null;

        for (let i = 0; i < this.objects.length; i++) {

            const object = this.objects[i]

            if (!Camera.isEditing) {

                const currentDistance = object.position.distanceTo( position )

                if ( object instanceof SitZoneSpaceArtwork) {

                    if (currentDistance < closestZoneDistance) {

                        closestZoneDistance = currentDistance;

                        closestZone = object;
                    }
                }

                object.canInteract = false;
            }

            object.visible = Camera.isEditing;
            // object.visible = true;
        }

        if (Camera.isEditing) return;

        this.closestZone = closestZone;

        if (!this.closestZone || closestZoneDistance > this.closestZone.triggerDistance ) {

            Root.billboardLabel.hide();

            return;
        };

        if (
            closestZone && closestZoneDistance < closestZone.triggerDistance && !closestZone.canInteract
        ) {

            Root.billboardLabel.show(
                {
                    ...closestZone.msg,

                    parent: Scene,

                    mesh: closestZone.object,

                    distance: closestZone.triggerDistance
                }
            )

            closestZone.canInteract = true;
        }
    }

    onKeyPress = (e) => {

        if (e.key === "e") {

            if (this.closestZone && this.closestZone.canInteract) {

                Players.main.sit({

                    mesh: this.closestZone,
                })
            }
        }
    }

    // called in artworkcontainer.js for the moment
    onClick = (e) => {

        if (this.closestZone && this.closestZone.canInteract) {

            Players.main.sit({

                mesh: this.closestZone,

            })
        }
    }

    addEvents = ()  => {

        if (IS_TOUCH) {

            Emitter.on(Events.CLICK, this.onClick)
        }
        else  {

            Emitter.on(Events.KEY_DOWN, this.onKeyPress)
        }

        Emitter.on(Events.UPDATE, this.update)
    }

    removeEvents = () => {

        if (IS_TOUCH) {

            Emitter.off(Events.CLICK, this.onClick)
        }
        else {

            Emitter.off(Events.KEY_DOWN, this.onKeyPress)
        }

        Emitter.off(Events.UPDATE, this.update)
    }

    dispose() {

        this.closestZone = null;

        this.removeEvents()

        this.objects = []
    }
}
