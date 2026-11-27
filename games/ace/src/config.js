// World units are metres. x runs sideline to sideline, z runs baseline to
// baseline (the human plays the near half, z > 0), y is up. The net is z = 0.

export const COURT = {
    halfLength: 11.885,
    halfWidth: 4.115, // singles
    doublesHalfWidth: 5.485,
    serviceLine: 6.4,
    netCenter: 0.914,
    netPost: 1.07,
    postX: 5.03,
};

export const BALL_RADIUS = 0.034;
export const GRAVITY = 9.81;

/**
 * Shot recipes. `spin` adds to gravity in flight (topspin dips, slice floats),
 * `bounce` is vertical restitution, `skid` keeps horizontal speed after the
 * bounce, `time` is the flight time to the first bounce at power 0 and 1.
 */
export const SHOTS = {
    // Regular shot (J): fast and fairly flat.
    flat: {
        spin: 4,
        bounce: 0.7,
        skid: 0.9,
        time: [1.08, 0.68],
        color: 0x3ddc84,
        clear: 0.4,
    },
    // Topspin (K): higher arc, dives late and kicks up off the bounce.
    topspin: {
        spin: 11,
        bounce: 0.86,
        skid: 0.84,
        time: [1.3, 0.9],
        color: 0xff5a3c,
        clear: 1.0,
    },
    // Drop shot (H+K): soft, just over the net, dies after the bounce.
    drop: {
        spin: -1,
        bounce: 0.6,
        skid: 0.5,
        time: [1.7, 1.5],
        color: 0xff7ad9,
        clear: 0.3,
    },
    slice: {
        spin: -2.8,
        bounce: 0.5,
        skid: 0.72,
        time: [1.32, 0.98],
        color: 0x3fa4ff,
        clear: 0.22,
    },
    lob: {
        spin: 0.8,
        bounce: 0.7,
        skid: 0.8,
        time: [2.25, 1.85],
        color: 0xffd23c,
        clear: 3.2,
    },
    serve: {
        spin: 4.5,
        bounce: 0.7,
        skid: 0.84,
        time: [0.86, 0.5],
        color: 0xc56bff,
        clear: 0.12,
    },
    stretch: {
        spin: 1.5,
        bounce: 0.62,
        skid: 0.78,
        time: [1.45, 1.25],
        color: 0xffffff,
        clear: 0.9,
    },
};

/** CPU opponents. Speeds are m/s, reaction in seconds, error in metres. */
export const DIFFICULTY = {
    rookie: {
        label: "Rookie",
        unforced: 0.1,
        pressure: 0.55,
        speed: 5.4,
        reaction: 0.26,
        error: 1.15,
        power: [0.15, 0.55],
        aggression: 0.25,
        reach: 1.45,
        serve: 0.35,
    },
    pro: {
        label: "Pro",
        unforced: 0.05,
        pressure: 0.42,
        speed: 6.4,
        reaction: 0.15,
        error: 0.7,
        power: [0.35, 0.8],
        aggression: 0.5,
        reach: 1.6,
        serve: 0.6,
    },
    ace: {
        label: "Ace",
        unforced: 0.025,
        pressure: 0.3,
        speed: 7.3,
        reaction: 0.08,
        error: 0.42,
        power: [0.55, 1.0],
        aggression: 0.75,
        reach: 1.75,
        serve: 0.85,
    },
};

export const PLAYER = {
    speed: 7.0,
    chargeSpeed: 0.42, // movement multiplier while charging
    reach: 1.75, // racket reach from body centre
    sweetLateral: 0.85,
    sweetHeight: 0.95,
    maxCharge: 0.9, // seconds of hold for full power
};

export const POINT_NAMES = ["0", "15", "30", "40"];
