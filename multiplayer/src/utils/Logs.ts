import colors from "colors/safe";

import { Client } from "colyseus";
// import { Player } from "../schema/CyberPlayerState";

const colorsProxy = new Proxy(colors, {
    get: (target, prop) => {
        if (process.env.NODE_ENV === "development") {
            return (val: string) => "";
        }
        // @ts-ignore
        return target[prop];
    },
});

export const LOGS = {
    routeOnCreate: (opts: { username: string; userId: string; roomType: string }) => {
        // return;
        // console.log(
        //     colorsProxy.green(`[ ${opts.userId} USER ] created room`),
        //     opts.roomType
        // );
    },

    routeOnJoin: (opts: { username: string; userId: string; roomType: string }) => {
        // return;
        // console.log(
        //     colorsProxy.green(`[ ${opts.userId} USER ] joined room`),
        //     opts.roomType
        // );
    },

    routeFailedToJoin: (opts: { username: string; userId: string; error: string }) => {
        // return;
        // console.log(
        //     colorsProxy.red(`[ ${opts.userId} USER ] failed join room`),
        //     opts.error
        // );
    },

    roomOnJoin: (player: any, roomType: string) => {
        // return;
        // console.log(
        //     colorsProxy.cyan(`[ ${player.userId} USER JOINED ]`),
        //     roomType
        // );
    },

    roomOnLeave: (player: any) => {
        // return;
        // console.log(colorsProxy.cyan(`[ ${player.userId} USER LEFT ]`));
    },

    roomOnDispose: ({ metadata, clients, roomId }: { metadata: Metadata; clients: Client[]; roomId: string }) => {
        // return;
        // console.log(
        //     colorsProxy.bgCyan(
        //         `DISPOSED ROOM ${metadata.spaceId + "-" + roomId} WITH ${
        //             clients.length
        //         } USERS LEFT`
        //     )
        // );
    },

    stateOnAddPlayer: ({ player, currentOnlineUsers }: { player: any; currentOnlineUsers: number }) => {
        // return;
        // console.log(
        //     colorsProxy.blue(`[ ${player.userId} USER ADDED TO STATE ]`),
        //     currentOnlineUsers
        // );
    },

    stateOnRemovePlayer: ({ player, currentOnlineUsers }: { player: any; currentOnlineUsers: number }) => {
        // return;
        // console.log(
        //     colorsProxy.blue(`[ ${player.userId} USER REMOVED FROM STATE ]`),
        //     currentOnlineUsers
        // );
    },

    duplicateRemovePlayer: ({ player, source }: { player: any; source: string }) => {
        // return;

        console.log(colorsProxy.magenta(`[ ${player.userId} USER duplicate Disconnected from ${source} ]`));
    },

    stateValidation: ({ property, propertyType, value, player }: { property: string; propertyType: string; value: any; player: any }) => {
        return;

        console.log(colorsProxy.red(`[ ${player.userId} USER RECEIVED ${typeof value} FOR ${property} ] ${value} is not a ${propertyType}`));
    },
};
