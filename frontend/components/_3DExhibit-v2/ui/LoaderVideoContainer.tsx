import { useEffect, useRef } from "react";

import { vec3 } from "gl-matrix";

import styled from "styled-components";

export function drawStarfield(
    canvas: HTMLCanvasElement,
    width = 0,
    height = 0
) {
    var flr = Math.floor;

    canvas.width = width || canvas.offsetWidth;
    canvas.height = height || canvas.offsetHeight;

    var halfw = canvas.width / 2,
        halfh = canvas.height / 2,
        step = 2,
        warpZ = 12,
        speed = 0.075;

    var stampedDate = new Date();

    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var star = function () {
        var v = vec3.fromValues(
            rnd(0 - halfw, halfw),
            rnd(0 - halfh, halfh),
            rnd(1, warpZ)
        );

        this.x = v[0];
        this.y = v[1];
        this.z = v[2];
        this.color = getColor();

        this.reset = function () {
            v = vec3.fromValues(
                rnd(0 - halfw, halfw),
                rnd(0 - halfh, halfh),
                rnd(1, warpZ)
            );

            this.x = v[0];
            this.y = v[1];
            this.color = getColor();
            vel = this.calcVel();
        };

        this.calcVel = function () {
            return vec3.fromValues(0, 0, 0 - speed);
        };

        var vel = this.calcVel();

        this.draw = function () {
            vel = this.calcVel();
            v = vec3.add(vec3.create(), v, vel);
            var x = v[0] / v[2];
            var y = v[1] / v[2];
            var x2 = v[0] / (v[2] + speed * 0.5);
            var y2 = v[1] / (v[2] + speed * 0.5);

            ctx.strokeStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (x < 0 - halfw || x > halfw || y < 0 - halfh || y > halfh) {
                this.reset();
            }
        };
    };

    var starfield = function () {
        var numOfStars = 250;

        var stars = [];

        function _init() {
            for (var i = 0, len = numOfStars; i < len; i++) {
                stars.push(new star());
            }
        }

        _init();

        this.draw = function () {
            ctx.translate(halfw, halfh);

            for (var i = 0, len = stars.length; i < len; i++) {
                var currentStar = stars[i];

                currentStar.draw();
            }
        };
    };

    var mStarField = new starfield();
    //@ts-ignore
    function rnd(num1, num2) {
        return flr(Math.random() * num2 * 2) + num1;
    }
    //@ts-ignore
    function getColor() {
        return "hsla(200,100%, " + rnd(50, 100) + "%, 1)";
    }

    let dt = 1000 / 30;
    var timeTarget = 0;

    //@ts-ignore
    function draw() {
        if (Date.now() >= timeTarget) {
            timeTarget += dt;

            speed = 0.055;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.fillRect(0, 0, canvas?.width, canvas?.height);

            mStarField.draw();

            if (Date.now() >= timeTarget) {
                timeTarget = Date.now();
            }
        }
    }

    return draw;
}

export default function LoaderVideoContainer({ loading }) {
    const canvas = useRef(null);

    useEffect(() => {
        let handleId;

        // @ts-ignore
        function resize() {
            if (!canvas.current) return;

            canvas.current.width = canvas.current.offsetWidth;
            canvas.current.height = canvas.current.offsetHeight;

            // halfw = canvas.current.width / 2;
            // halfh = canvas.current.height / 2;
        }

        if (canvas.current) {
            // if (canvas.current) {
            const draw = drawStarfield(canvas.current);
            window.addEventListener("resize", resize);

            const start = () => {
                draw();
                handleId = window.requestAnimationFrame(start);
            };

            start();
            // }
        }

        return () => {
            window.removeEventListener("resize", resize);
            window.cancelAnimationFrame(handleId);
        };
    }, []);

    // if (!loading) return null;

    return <Container ref={canvas} />;
}

const Container = styled.canvas`
    position: fixed;
    width: 100%;
    height: 100vh;
    object-fit: fill;

    iframe {
        position: fixed;
        min-width: 100%;
        height: 100vh;
        object-fit: fill;
    }

    video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    @media (max-width: 600px) {
        margin: 0 auto;
        iframe {
            position: fixed;
            right: 0;
            bottom: 0;
            min-width: 100%;
            min-height: 100%;
            transform: translateX(calc((100% - 100vw) / 2));
        }
    }

    & > div {
        position: fixed;
        bottom: 0;
        right: 0;
        color: white;
        z-index: 1;
        background: black;
        padding: 12px;
        font-size: 14px;
    }
`;
