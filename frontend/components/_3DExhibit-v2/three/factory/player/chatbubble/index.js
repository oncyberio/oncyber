// @ts-check

import { Box3, CanvasTexture, LinearFilter, Sprite, SpriteMaterial, Vector3 } from "three";
import { CHAT_OFFSET } from "../constants";
import PipeLineSprite from '@3abstract/pipelinesprite'
import emojies from "@components/_3DExhibit-v2/ui/Chat/emojies.json"
import imageCache from "@3/three/utils/imagecache";
import { nodeEnv } from "@env";
const GLOBAL_SCALE = 0.02

const imgWidth = 40;
const margin = 8;

export class ChatBubble {

    constructor() {
        this.params = {
            textHeight: 3,
            color: "white",
            backgroundColor: "rgba(33, 33, 33, .95)",
            padding: [16, 8],
            font: "Aeonik",
            fontSize: 45,
            fontWeight: "normal",
            borderRadius: 14,
        }

    }

    dispose( bubble ){

        this.instance.material.dispose()

        this.instance.material.map.dispose()

        this.instance.dispose()

        this.instance = null
    }

    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image at URL: ${url}`));
            };
            img.src = url;
        });
    }

    async get(opts) {

        // const texture = this.getTexture(opts.userId)


        const material = new SpriteMaterial({

            transparent: true,

            depthWrite: false,

        });

        const occlusionMaterial = new SpriteMaterial({

            transparent: true,

            depthWrite: false,

            color: 0x000000

        });


        this.message = {

            text: "test",

            date: "00:00"
        }

        this.instance = new PipeLineSprite(material, {
            visibleOnOcclusion: true,
            visibleOnMirror: false,
            occlusionMaterial: occlusionMaterial
        });

        this.instance.renderOrder = 100000;

        this.instance.geometry.computeBoundingBox();

        // this.instance.position.set(
        //     0,
        //     opts.modelCapsule.max.y + opts.modelCapsule.max.y * CHAT_OFFSET,
        //     0
        // );

        // this.originalY = opts.modelCapsule.max.y + opts.modelCapsule.max.y * CHAT_OFFSET

        this.instance.name = "chat";

        this.instance.visible = false;

        // this.modelCapsule = opts.modelCapsule;

        const { scale, texture } = await this.getTexture(this.message.text)

        this.instance.material.map = texture;

        this.instance.occlusionMaterial.map = texture

        this.instance.scale.copy(scale.multiplyScalar(2))

        this.instance.visible = true;

        return this.instance
    }



    set opacity(val) {

        this.instance.material.opacity = val
    }

    get opacity() {

        return this.instance.material.opacity
    }


    set = async (opts) => {

        this.message = {

            text: opts.text,

            date: opts.date,

            acc_date: opts.acc_date
        }

        if (this.instance.material.map) {

            this.instance.material.map.dispose();
        }

        this.instance.visible = false;

        const { scale, texture } = await this.getTexture(this.message.text)
        
        this.instance.material.map = texture;

        scale.multiplyScalar(0.8);

        this.instance.scale.copy(scale);

        this.instance.visible = true;

    }

    wordWrap(text, maxWidth) {

        let words = text.split(/\s/)
        let lines = [];
        let currentLine = '';
        let sumWords = 0

        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            let wordLength = word.length;

            // Handle words that start with "::"
            if (word.startsWith("::")) {
                wordLength = 2;
            }

            if (sumWords + wordLength <= maxWidth) {
                sumWords += wordLength;
                currentLine += (currentLine === '' ? '' : ' ') + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
                sumWords = 0;
            }
        }

        lines.push(currentLine);

        return lines;
    }

    testWhite(x) {
        var white = new RegExp(/^\s$/);
        return white.test(x.charAt(0));
    };

    getMaxLineWidth(ctx, lines) {
        return Math.max(
            ...lines.map((line) =>
                line.split(/\s/).reduce((acc, cur) =>
                    acc + (cur.startsWith('::') ? imgWidth : ctx.measureText(cur).width + margin),
                    0
                )
            )
        );
    };


    async getTexture(_text = "") {

        const canvas = document.createElement("canvas");

        const ctx = canvas.getContext("2d");

        const texture = new CanvasTexture(canvas);

        texture.minFilter = LinearFilter;

        texture.magFilter = LinearFilter;

        texture.generateMipmaps = true;

        let lines = this.wordWrap(_text, 50);

        const borderRadius = Array.isArray(this.params.borderRadius)
            ? this.params.borderRadius
            : [
                this.params.borderRadius,
                this.params.borderRadius,
                this.params.borderRadius,
                this.params.borderRadius,
            ];

        const relBorderRadius = borderRadius.map(
            (b) => b * this.params.fontSize * 0.1
        );

        const padding = Array.isArray(this.params.padding)
            ? this.params.padding
            : [this.params.padding, this.params.padding];

        const relPadding = padding.map((p) => p * this.params.fontSize * 0.1);

        const font = `${this.params.fontWeight} ${this.params.fontSize}px ${this.params.font}`;

        ctx.font = font;

        const innerWidth = this.getMaxLineWidth(ctx, lines)

        const innerHeight = this.params.fontSize * lines.length;

        canvas.width = innerWidth + relPadding[0] * 2;
        canvas.height = innerHeight + relPadding[1] * 2;

        // paint background
        if (this.params.backgroundColor) {
            ctx.fillStyle = this.params.backgroundColor;
            if (!this.params.borderRadius) {

                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {

                // fill with rounded corners
                ctx.beginPath();
                ctx.moveTo(0, relBorderRadius[0]);

                // t
                ctx.quadraticCurveTo(0, 0, relBorderRadius[0], 0);
                ctx.lineTo(canvas.width - relBorderRadius[1], 0);

                // R
                ctx.quadraticCurveTo(canvas.width, 0, canvas.width, relBorderRadius[1]);
                ctx.lineTo(canvas.width, canvas.height - relBorderRadius[2]);

                // b
                ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - relBorderRadius[2], canvas.height);
                ctx.lineTo(relBorderRadius[3], canvas.height);

                // b
                ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - relBorderRadius[3]);
                ctx.lineTo(0, relBorderRadius[0]);

                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.translate(0, 0);
        ctx.translate(relPadding[0], relPadding[1]);

        // paint text
        ctx.font = font; // Set font again after canvas is resized, as context properties are reset
        ctx.fillStyle = this.params.color;
        ctx.textBaseline = "bottom";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const lineY = (i + 1) * this.params.fontSize;
            const words = line.split(/\s/);

            let posX = 0;

            for (let j = 0; j < words.length; j++) {
                const word = words[j];

                if (word.startsWith('::')) {
                    const id = word.replace('::', '')

                    const emoji = emojies.find((item) => item?.id === id);

                    const source = emoji?.src
                        ? nodeEnv.PINATA_BASE_UPLOAD + emoji.src
                        : "/emojis/spritesheet.png";

                    const image = await this.loadImage(source)

                    if (emoji?.sx && emoji?.sy) {
                        ctx.drawImage(
                            image,
                            emoji.sx,
                            emoji.sy,
                            29,
                            30,
                            posX,
                            lineY - imgWidth,
                            imgWidth,
                            imgWidth
                        )
                    } else {
                        ctx.drawImage(image, posX, lineY - imgWidth, imgWidth, imgWidth);
                    }

                    posX += imgWidth

                } else {
                    ctx.fillText(word, posX, lineY);
                    posX += ctx.measureText(word).width
                }

                if(j !== words.length - 1) {
                    posX += 8
                }

            }
        }


        const yScale = this.params.textHeight * lines.length + padding[1] * 2;

        return {
            scale: new Vector3(
                GLOBAL_SCALE * (yScale * canvas.width) / canvas.height,
                GLOBAL_SCALE * yScale,
                0
            ),
            texture
        }
    }
}

