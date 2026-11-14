import { Box3, CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from "three";

import { USERNAME_OFFSET, USERNAME_OFFSET_X } from "../constants";

import {

    CANVAS_SIZE

} from './constants.js'

import {

    SUPPORT_BITMAP_LOADING

} from '@3constants'

import { drawIcon } from "@components/_3DExhibit-v2/three/utils/draw";

class UsernameGenerator {

    constructor(){

        this.CANVAS_SIZE = CANVAS_SIZE
    }

    get( username, avatar, walletId, textOnly = false ) {

        if (username && username.startsWith("Anon-")) {
            username = 'Anon'
        }

        if (username && username == walletId) {

            username = formatWalletAddress(username)
        }

        const canvas = document.createElement("canvas");

        const fontSize = CANVAS_SIZE.fontSize;
        const ctx = canvas.getContext("2d")
        ctx.canvas.width = CANVAS_SIZE.w
        ctx.canvas.height = CANVAS_SIZE.h

        ctx.fillStyle = "#fff";
        ctx.font = `bold ${
            fontSize * 0.5
        }px/${fontSize}px 'SpaceGrotesk', Arial, sans-serif`;
        ctx.shadowColor="rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur=1;
        ctx.lineWidth=2;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        this.ctx = ctx

        this.canvas = canvas

        if( username == undefined ){

            username = ""
        }

        // Anything that isn't a drawable image source (undefined, or a url
        // string that never got loaded) would make drawImage throw — render
        // the label text-only instead
        const isDrawableAvatar =
            avatar != null && typeof avatar === "object"

        if (!isDrawableAvatar) {

            textOnly = true
        }

        let _username = !textOnly && username.length > 18 ? `${username.slice(0, 18)}...` : username;

        // Title

        this.ctx.globalAlpha = 0.0
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1.0

        this.ctx.fillText(
            _username,
            this.ctx.canvas.width / 2,
            this.ctx.canvas.height / 2
        );

        const metrics = ctx.measureText(_username);
        const margin = 10;
        const imgSize = this.ctx.canvas.width / 10;


        if (!textOnly) {

            try {

                let imageXPos = (this.ctx.canvas.width /2) - (metrics.width / 2 + margin)
                let imageYPos = this.ctx.canvas.height / 2 ;

                this.ctx.beginPath()
                this.ctx.arc((this.ctx.canvas.width /2) - (metrics.width / 2 + imgSize / 2 + margin), imageYPos, imgSize / 2, 0, Math.PI * 2, false)
                this.ctx.clip()

                if (SUPPORT_BITMAP_LOADING == true && avatar instanceof ImageBitmap ) {
                    this.ctx.scale(1, -1);
                    this.ctx.drawImage(avatar, imageXPos - imgSize, -imageYPos * 1.5, imgSize, imgSize);

                } else {

                    this.ctx.drawImage(avatar, imageXPos - imgSize, imageYPos- imgSize / 2, imgSize, imgSize)

                }
            }
            catch (err) {

                // A label without the avatar bubble beats a dead scene
                console.error("[UsernameGenerator] failed to draw avatar image", err)
            }
        }


        return this.canvas
    }
}

export default new UsernameGenerator()


