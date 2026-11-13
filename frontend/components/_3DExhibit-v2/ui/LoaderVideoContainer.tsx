import { useEffect, useRef } from "react";

import styled from "styled-components";

/**
 * One star of the loading star field, in CSS pixels from the centre of the
 * view (y grows downwards) at depth `z`, so it shows at (x / z, y / z).
 * `lightness` is the HSL lightness of its blue-white colour, 0.5 to 1.
 */
export type LoadingStar = {
    x: number;
    y: number;
    z: number;
    lightness: number;
};

/** Stars start this far away and fly SPEED per 30 fps frame. */
const WARP_Z = 24;
const SPEED = 0.08;
const STAR_COUNT = 400;

/**
 * Draws the warp-speed loading star field on a 2D canvas. Call the returned
 * function every animation frame; `draw.stars()` reads where the stars are
 * now, so the 3D engine can carry on the same field when it takes over
 * (three/modules/starfield).
 */
export function drawStarfield(
    canvas: HTMLCanvasElement,
    width = 0,
    height = 0
) {
    canvas.width = width || canvas.offsetWidth;
    canvas.height = height || canvas.offsetHeight;

    const halfw = canvas.width / 2;
    const halfh = canvas.height / 2;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // A whole number in [from, from + 2 * span).
    const rnd = (from: number, span: number) =>
        Math.floor(Math.random() * span * 2) + from;

    const spawn = (star: LoadingStar) => {
        star.x = rnd(-halfw, halfw);
        star.y = rnd(-halfh, halfh);
        star.z = rnd(1, WARP_Z / 2);
        // Lightness 50% to 249%, so three stars in four come out white.
        star.lightness = Math.min(1, rnd(50, 100) / 100);
        return star;
    };

    const stars: LoadingStar[] = [];
    for (let i = 0; i < STAR_COUNT; i++)
        stars.push(spawn({ x: 0, y: 0, z: 0, lightness: 1 }));

    const dt = 1000 / 30;
    let timeTarget = 0;

    function draw() {
        if (Date.now() < timeTarget) return;
        timeTarget += dt;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(halfw, halfh);

        for (const star of stars) {
            star.z -= SPEED;
            const x = star.x / star.z;
            const y = star.y / star.z;
            const x2 = star.x / (star.z + SPEED * 1.1);
            const y2 = star.y / (star.z + SPEED * 1.1);

            ctx.strokeStyle = `hsla(200,100%,${star.lightness * 100}%,1)`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (
                star.z <= 0 ||
                x < -halfw ||
                x > halfw ||
                y < -halfh ||
                y > halfh
            )
                spawn(star);
        }

        if (Date.now() >= timeTarget) timeTarget = Date.now();
    }

    return Object.assign(draw, {
        stars: (): LoadingStar[] => stars.map((star) => ({ ...star })),
    });
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
