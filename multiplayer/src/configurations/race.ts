import {
    AbstractGameManager,
    GAME_OBJECT,
} from "../rooms/game/abstract/AbstractGameManager";

const CLIENT = false;

// reset
// when someone wins or loses stop getting next coin

function onInteractingWithPortal(
    current: GAME_OBJECT,
    target: GAME_OBJECT,
    game: AbstractGameManager,
    id: string
) {
    if (target.isPlayer) {
        const nextPortal = game.getObjectById(id);

        const position = nextPortal.getPosition();

        target.setPosition(position.x, position.y, position.z);

        current.playSound(
            "https://res.cloudinary.com/oncyber-io/video/upload/v1677664773/public/game/Swooch_jzafqh.wav"
        );
    }
}

function onInteractingWithCoin(
    current: GAME_OBJECT,
    target: GAME_OBJECT,
    game: AbstractGameManager,
    nextCoinId: string
) {
    if (target.isPlayer && !target.getHasWon() && !target.getHasLost()) {
        if (CLIENT) {
            current.setVisible(false);

            current.setActive(false);

            const nextCoin = game.getObjectById(nextCoinId);

            nextCoin.setVisible(true);

            nextCoin.setActive(true);

            current.playSound(
                "https://res.cloudinary.com/oncyber-io/video/upload/v1677663684/public/game/coin_r7of3q.wav"
            );

            // this will run the !CLIENT version of this function in the server
            game.multiplayer.broadcast("interact", current.getId());
        } else {
            const score = target.getScore();

            target.setScore(score + 1);
        }
    }
}

const objects = {
    "23.24X-30.20X336.12X0.00X0.00X0.00": {
        name: "portal-10-1.glb",
        id: "23.24X-30.20X336.12X0.00X0.00X0.00",
        radius: 6,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithPortal(
                    current,
                    target,
                    game,
                    "58.96X-30.08X435.33X0.00X0.00X0.00"
                ),
            // onKeyPress: (e, current: GAME_OBJECT, game: AbstractGameManager) => {
            //     if (e.key === "e") {
            //         console.log("currentcurrentcurrentcurrentcurrent", current);
            //         // make it a child of the player
            //     }
            // }
        },
    },
    "58.96X-30.08X435.33X0.00X0.00X0.00": {
        name: "portal-10-2.glb",
        id: "58.96X-30.08X435.33X0.00X0.00X0.00",
        radius: 6,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) => {},
        },
    },
    "99.91X1.12X-1.19X0.00X1.57X0.00": {
        name: "coin-1.glb",
        id: "99.91X1.12X-1.19X0.00X1.57X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "308.50X6.39X17.77X0.00X0.00X0.00"
                ),
            onKeyPress: (
                key: any,
                current: GAME_OBJECT,
                game: AbstractGameManager
            ) => {
                if (key === "e") {
                    // make it a child of the player
                }
            },
        },
    },
    "308.50X6.39X17.77X0.00X0.00X0.00": {
        name: "coin-2.glb",
        id: "308.50X6.39X17.77X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "321.96X-7.93X-86.43X0.00X0.00X0.00"
                ),
        },
    },
    "321.96X-7.93X-86.43X0.00X0.00X0.00": {
        name: "coin-3.glb",
        id: "321.96X-7.93X-86.43X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "202.57X-39.08X-115.57X0.00X0.00X0.00"
                ),
        },
    },
    "202.57X-39.08X-115.57X0.00X0.00X0.00": {
        name: "coin-4.glb",
        id: "202.57X-39.08X-115.57X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "152.24X-55.49X93.34X0.00X0.00X0.00"
                ),
        },
    },
    "152.24X-55.49X93.34X0.00X0.00X0.00": {
        name: "coin-5.glb",
        id: "152.24X-55.49X93.34X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "197.40X-26.91X291.99X0.00X0.00X0.00"
                ),
        },
    },
    "197.40X-26.91X291.99X0.00X0.00X0.00": {
        name: "coin-6.glb",
        id: "197.40X-26.91X291.99X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "125.03X-17.91X345.46X0.00X0.00X0.00"
                ),
        },
    },
    "125.03X-17.91X345.46X0.00X0.00X0.00": {
        name: "coin-7.glb",
        id: "125.03X-17.91X345.46X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "93.70X-28.38X271.95X0.00X0.00X0.00"
                ),
        },
    },
    "93.70X-28.38X271.95X0.00X0.00X0.00": {
        name: "coin-8.glb",
        id: "93.70X-28.38X271.95X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "12.54X-19.48X267.62X0.00X0.00X0.00"
                ),
        },
    },
    "12.54X-19.48X267.62X0.00X0.00X0.00": {
        name: "coin-9.glb",
        id: "12.54X-19.48X267.62X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "31.60X-11.29X533.24X0.00X0.00X0.00"
                ),
        },
    },
    "31.60X-11.29X533.24X0.00X0.00X0.00": {
        name: "coin-10.glb",
        id: "31.60X-11.29X533.24X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-47.32X-17.93X515.42X0.00X0.00X0.00"
                ),
        },
    },
    "-47.32X-17.93X515.42X0.00X0.00X0.00": {
        name: "coin-11.glb",
        id: "-47.32X-17.93X515.42X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-166.06X-20.15X197.90X0.00X0.00X0.00"
                ),
        },
    },
    "-166.06X-20.15X197.90X0.00X0.00X0.00": {
        name: "coin-12.glb",
        id: "-166.06X-20.15X197.90X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-236.33X-18.01X2.74X0.00X0.00X0.00"
                ),
        },
    },
    "-236.33X-18.01X2.74X0.00X0.00X0.00": {
        name: "coin-13.glb",
        id: "-236.33X-18.01X2.74X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-257.32X-2.56X-87.28X0.00X0.00X0.00"
                ),
        },
    },
    "-257.32X-2.56X-87.28X0.00X0.00X0.00": {
        name: "coin-14.glb",
        id: "-257.32X-2.56X-87.28X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-179.17X11.92X-122.08X0.00X0.00X0.00"
                ),
        },
    },
    "-179.17X11.92X-122.08X0.00X0.00X0.00": {
        name: "coin-15.glb",
        id: "-179.17X11.92X-122.08X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "-143.72X4.81X-16.53X0.00X0.00X0.00"
                ),
        },
    },
    "-143.72X4.81X-16.53X0.00X0.00X0.00": {
        name: "coin-16.glb",
        id: "-143.72X4.81X-16.53X0.00X0.00X0.00",
        visible: false,
        active: false,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithCoin(
                    current,
                    target,
                    game,
                    "99.91X1.12X-1.19X0.00X1.57X0.00"
                ),
        },
    },
    "-60.08X-17.34X492.56X0.00X0.00X0.00": {
        name: "portal-20-1.glb",
        id: "-60.08X-17.34X492.56X0.00X0.00X0.00",
        radius: 6,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) =>
                onInteractingWithPortal(
                    current,
                    target,
                    game,
                    "-78.03X-20.08X437.97X0.00X0.00X0.00"
                ),
        },
    },
    "-78.03X-20.08X437.97X0.00X0.00X0.00": {
        name: "portal-20-2.glb",
        id: "-78.03X-20.08X437.97X0.00X0.00X0.00",
        radius: 6,
        callbacks: {
            onInteracting: (
                current: GAME_OBJECT,
                target: GAME_OBJECT,
                game: AbstractGameManager
            ) => {},
        },
    },
};

export const RACE_GAME = {
    win_params: {
        score: 17,
    },
    lose_params: {
        score: 0,
    },
    start_params: {
        readyPlayers: 2,
        onPlayersReady: async (game: AbstractGameManager) => {
            game.players.forEach((player) => {
                if (player.isPlayer) {
                    player.deactivateControls();

                    player.setPosition(0, 0, 0);

                    player.setScore(0);
                }
            });

            if (!CLIENT) {
                await game.countdown(3, 1000, true);
            }
        },
        onGameStart: (game: AbstractGameManager) => {
            game.players.forEach((player) => {
                if (player.isPlayer) {
                    player.activateControls();
                }
            });

            const object = game.getObjectById(
                "99.91X1.12X-1.19X0.00X1.57X0.00"
            );

            if (object) {
                object.setVisible(true);

                object.setActive(true);
            }
        },
        onGameEnd: (game: AbstractGameManager) => {
            // game.reset();
        },
    },
    player: {
        score: 5,
    },
    hit: {
        enable: true,

        callbacks: {
            onInteracting: (target: GAME_OBJECT, game: AbstractGameManager) => {
                // target.setScore(target.getScore() + 10);
            },
            onWin: async (target: GAME_OBJECT, game: AbstractGameManager) => {
                if (!CLIENT) {
                    if (target.isPlayer && game.winners.length === 0) {
                        target.setHasWon(true);
                        game.winners.push(target.getId());
                    }

                    // if (game.winners.length === 0) {
                    // wait 30s for other players to finish
                    // await game.wait(30);

                    game.players.forEach((player) => {
                        if (player.isPlayer) {
                            if (!player.getHasWon()) {
                                player.setHasLost(true);
                            }
                        }
                    });

                    // then end game and reset
                    //     game.gameProgress = "ended";

                    //     return;
                    // }

                    game.gameProgress = "ended";

                    // if (game.winners.length === game.players.size) {
                    //     // end game and reset
                    // }
                }
            },
        },
    },
    objects,
};
