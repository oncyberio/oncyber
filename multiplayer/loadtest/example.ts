import { Room, Client } from "colyseus.js";

import shortid from "shortid";

export function requestJoinOptions(this: Client, i: number) {
    const userId = shortid.generate();

    return {
        label: "okeyokey",
        username: userId,
        avatar: "https://res.cloudinary.com/oncyber-io/image/upload/c_limit,fl_keep_dar,h_256,w_256,c_fit,c_fill/v1656092761/assets/mfer_zdplb7_g6kqrq.jpg",
        userId: userId,
        token: "",
        position: { x: "0", y: "0", z: "0" },
        rotationY: "0",
        currentSpace: "zzrKXHefD7DbCaUhSakJ",
        VRM: "/models/PEPE.vrm",
    };
}

export function onJoin(this: Room) {
    // console.log(this.sessionId, "joined.");

    const userId = shortid.generate();

    // this.send("init", [
    //     0,
    //     0,
    //     0,
    //     0,
    //     1,
    //     "hub",
    //     userId,
    //     "https://res.cloudinary.com/oncyber-io/image/upload/c_limit,fl_keep_dar,h_256,w_256,c_fit,c_fill/v1656092761/assets/mfer_zdplb7_g6kqrq.jpg",
    //     userId,
    //     2.3,
    //     false,
    // ]);

    let time = 0;

    let x = 0;
    let z = 0;

    setInterval(() => {
        time += 1;

        x += (Math.random() - Math.random()) * 2;
        const y = 0;
        z += (Math.random() - Math.random()) * 2;
        const rot = Math.random() * 0.1;

        this.send("move", [x, y, z, rot, 1, true, Date.now()]);
    }, Math.floor(Math.random() * 9001) + 1000);

    this.onMessage("*", (type, message) => {
        // console.log(this.sessionId, "received:", type, message);
    });
}

export function onLeave(this: Room) {
    console.log(this.sessionId, "left.");
}

export function onError(this: Room, err: any) {
    console.log(this.sessionId, "!! ERROR !!", err.message);
}

export function onStateChange(this: Room, state: any) {
    // console.log(this.sessionId, "new state:", state);
}
