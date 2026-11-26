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

const GOLD = "#ffd76a";
const NIGHT = "#2a3358";
const game = keep("game", { caught: [], done: false });

const lanterns = POSTS.map((p, i) => {
    const post = world.add({
        id: "lantern-" + i,
        shape: "cylinder",
        size: [0.22, POST, 0.22],
        position: [p[0], p[1] + POST / 2, p[2]],
        color: NIGHT,
        look: "matte",
    });
    post.add({
        id: "lantern-" + i + ".arm",
        shape: "box",
        size: [1, 0.13, 0.13],
        position: [0.4, POST / 2 - 0.2, 0],
        color: NIGHT,
        look: "matte",
    });
    const lamp = post.add({
        id: "lantern-" + i + ".lamp",
        shape: "lathe",
        size: [0.85, 1, 0.85],
        profile: [
            [0.1, -0.5],
            [0.42, -0.3],
            [0.5, 0.1],
            [0.3, 0.42],
            [0.08, 0.5],
        ],
        position: [0.85, POST / 2 - 0.8, 0],
        color: "#6b7396",
        look: "matte",
    });
    return { post, lamp };
});

const stars = FALLEN.map((p, i) => {
    const star = world.add({
        id: "star-" + i,
        shape: "star",
        points: 5,
        depth: 0.4,
        size: [1.4, 1.4, 1.4],
        position: p,
        color: GOLD,
        look: "glow",
        glow: true,
    });
    // A thin hoop around it, so it reads from up the road.
    star.add({
        id: "star-" + i + ".halo",
        shape: "torus",
        size: [2.2, 2.2, 0.3],
        color: GOLD,
        look: "glow",
        opacity: 0.7,
    });
    star.data.home = p[1];
    return star;
});

function light(i) {
    const lamp = lanterns[i] && lanterns[i].lamp;
    if (!lamp) return;
    lamp.set({ color: GOLD, look: "glow", glow: true });
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
