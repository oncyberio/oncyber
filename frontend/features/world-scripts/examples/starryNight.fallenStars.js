// name: Fallen stars
// Starry Night. Seven stars have fallen along the way down to the house.
// Catch one and a lantern lights; catch them all and the way is lit.
//
// Written for the space built on thestarrynight_skydome: the points below
// are that world's ground, from where a visitor starts to the first house.
//
// tokens-ok-file: the colours are paint for things in a 3D world.

// The way down: [x, groundHeight, z] every few metres, start to house.
const WAY = [
    [-3.54, -5.54, -7.33],
    [0.77, -6.41, -11.98],
    [5.08, -7.38, -16.63],
    [9.39, -8.87, -21.27],
    [13.7, -11.4, -25.92],
    [18.01, -13.1, -30.56],
    [22.32, -14.05, -35.21],
    [26.63, -15.86, -39.86],
    [30.94, -18.2, -44.5],
    [35.25, -20.14, -49.15],
];
// Lantern posts, to the left and right of it in turn.
const POSTS = [
    [-3.29, -6.06, -11.42],
    [4.83, -7.08, -12.53],
    [5.33, -7.69, -20.72],
    [13.45, -10.8, -21.83],
    [13.95, -11.61, -30.01],
    [22.07, -13.82, -31.12],
    [29.03, -18.17, -46.27],
];
// This world is about 2.3 times life size: a person stands 4 units tall
// here, and its doors are over 5. Everything below is sized from that.
const TALL = 4;
const POST = TALL * 1.3;
const REACH = TALL * 0.6;
// Where the stars fell: beside the way at chest height, one for each lantern.
const FALLEN = [0, 1, 3, 4, 6, 7, 9].map((i, n) => {
    const p = WAY[i];
    const side = n % 2 ? 2 : -2;
    return [p[0] + side, p[1] + TALL * 0.55, p[2] + side * 0.6];
});

// Painted like the world: these are built from parts (world.build), which a
// painted world draws as brush strokes, the way the room in the house is.
// The tones are the room's own.
const IRON = ["#17296a", "#1f3a86", "#12205a", "#2b4a9e", "#0e1844"];
const GLASS = ["#9fb4b0", "#b4c6c0", "#8aa3a6", "#c5d2c8"];
const FLAME = ["#fff3a8", "#ffe26a", "#fff8cc"];
const STAR = ["#f6d94a", "#e2b53a", "#edc552", "#fff3a0"];
const HALO = ["#fff3a0", "#f6d94a", "#e9e4b4", "#8db6e6"];
const DARK = "#1c1830";
const game = keep("game", { caught: [], done: false });

// A ring of short strokes around [0, y, 0], as the stars in the sky have.
function ring(model, radius, y, dashes, width) {
    const step = (Math.PI * 2) / dashes;
    for (let k = 0; k < dashes; k++) {
        const a = k * step;
        const b = a + step * 0.62;
        model.line(
            [Math.cos(a) * radius, y + Math.sin(a) * radius, 0],
            [Math.cos(b) * radius, y + Math.sin(b) * radius, 0],
            [0, 0, 1],
            { color: HALO[k % HALO.length], width, glow: true }
        );
    }
}

// A gas lamp on an iron post: foot, shaft, a six-sided glass and its roof.
function drawLantern(model, lit) {
    const h = POST / 5.8;
    const iron = {
        color: IRON[0],
        colors: IRON,
        under: DARK,
        fine: 0.09,
        flow: Math.PI / 2,
    };
    model
        .clear()
        .prism([0, 0], 0.46, 0, 0.3 * h, { ...iron, topRadius: 0.36 })
        .prism([0, 0], 0.34, 0.3 * h, 0.95 * h, { ...iron, topRadius: 0.15 })
        .prism([0, 0], 0.14, 0.95 * h, 4.05 * h, { ...iron, topRadius: 0.11 })
        .prism([0, 0], 0.27, 4.05 * h, 4.2 * h, { ...iron, top: true })
        .prism([0, 0], 0.26, 4.2 * h, 5.05 * h, {
            color: lit ? FLAME[0] : GLASS[0],
            colors: lit ? FLAME : GLASS,
            under: lit ? STAR[1] : DARK,
            sides: 6,
            topRadius: 0.44,
            fine: 0.08,
            glow: lit,
        })
        .prism([0, 0], 0.56, 5.05 * h, 5.5 * h, {
            ...iron,
            sides: 6,
            topRadius: 0.07,
            top: true,
        })
        .prism([0, 0], 0.07, 5.5 * h, 5.78 * h, { ...iron, top: true });
    // The bars of the glass, drawn dark as an outline.
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const out = [Math.cos(a), 0, Math.sin(a)];
        model.line(
            [out[0] * 0.26, 4.2 * h, out[2] * 0.26],
            [out[0] * 0.44, 5.05 * h, out[2] * 0.44],
            out,
            { color: DARK, width: 0.06 }
        );
    }
    if (!lit) return;
    // Its light, as two rings of strokes, seen from the road either way.
    for (const yaw of [0, Math.PI / 2])
        model.place([0, 0, 0], yaw, (halo) => {
            ring(halo, 0.95, 4.62 * h, 9, 0.11);
            ring(halo, 1.45, 4.62 * h, 13, 0.09);
        });
}

// A five-pointed star with a bright heart and two rings of light.
function drawStar(model) {
    const size = TALL * 0.24;
    const at = (k, radius) => {
        const a = Math.PI / 2 + (k * Math.PI) / 5;
        return [Math.cos(a) * radius, Math.sin(a) * radius, 0];
    };
    const paint = {
        color: STAR[0],
        colors: STAR,
        under: STAR[1],
        fine: 0.08,
        flow: ["around", 0, 0],
        glow: true,
    };
    for (let k = 0; k < 10; k += 2)
        model.poly(
            [
                [0, 0, 0],
                at(k - 1, size * 0.42),
                at(k, size),
                at(k + 1, size * 0.42),
            ],
            paint
        );
    model.poly(
        [0, 2, 4, 6, 8].map((k) => {
            const p = at(k + 1, size * 0.34);
            return [p[0], p[1], 0.03];
        }),
        { ...paint, color: FLAME[0], colors: FLAME }
    );
    ring(model, size * 1.4, 0, 10, 0.1);
    ring(model, size * 1.9, 0, 14, 0.08);
}

const lanterns = POSTS.map((p, i) => {
    const lantern = world.build({ id: "lantern-" + i, position: p });
    drawLantern(lantern, false);
    return lantern;
});

const stars = FALLEN.map((p, i) => {
    const star = world.build({ id: "star-" + i, position: p });
    drawStar(star);
    star.data.home = p[1];
    return star;
});

function light(i) {
    if (lanterns[i]) drawLantern(lanterns[i], true);
}
function show() {
    const n = game.caught.length;
    ui.hud("score", "Stars " + n + "/" + stars.length, "top-left");
    ui.hud(
        "goal",
        game.done
            ? "The way is lit. The house at the bottom of the road is open."
            : "Stars fell along the road. Catch them to light the way down to the house.",
        "top"
    );
    ui.hud(
        "again",
        game.done ? "Press R to scatter the stars again" : null,
        "bottom"
    );
}

// A change to this script while someone plays keeps what they caught.
for (const i of game.caught) {
    stars[i].visible = false;
    light(game.caught.indexOf(i));
}
show();

world.onUpdate((dt, time) => {
    const me = world.player.position;
    stars.forEach((star, i) => {
        if (!star.visible) return;
        star.rotation.y += dt * 1.6;
        star.position.y = star.data.home + Math.sin(time * 1.8 + i) * 0.3;
        // Feet to star: within reach on the ground, and not from a floor
        // above or below.
        const dx = star.position.x - me.x,
            dz = star.position.z - me.z;
        if (dx * dx + dz * dz > REACH * REACH) return;
        if (Math.abs(star.position.y - me.y) > TALL * 1.4) return;
        star.visible = false;
        light(game.caught.length);
        game.caught.push(i);
        sound.play("coin", 0.7);
        if (game.caught.length === stars.length) {
            game.done = true;
            ui.banner("The way is lit", 4);
            sound.play("win", 0.8);
        } else ui.toast("A lantern lights", 2);
        show();
    });
});

input.onKeyDown((e) => {
    if (e.code === "KeyR" && game.done) {
        game.caught.length = 0;
        game.done = false;
        world.restart();
    }
});
