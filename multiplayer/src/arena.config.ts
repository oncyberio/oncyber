import dotenv from "dotenv";

dotenv.config({
    path: process.env.NODE_ENV !== "production" ? "development.env" : "arena.env",
});

import { registerCrowdRoom } from "./rooms/crowd/join";

import { CyberRoom } from "./rooms/cyber";

import * as colyseus from "colyseus";

import { LobbyRoom } from "colyseus";

import { GameRoom } from "./rooms/game";

import { Server, RedisPresence } from "colyseus";

import { WebSocketTransport } from "@colyseus/ws-transport";

import rateLimit from "express-rate-limit";

import express from "express";

import fs from "fs";

import https from "https";

// const PORT = Number(process.env.PORT) || 2567;

import cors from "cors";

import { createServer } from "http";

import path from "path";

import { initializeExpress } from "./express";

// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
//     standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//     legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// });

const app = express();

app.use(cors());

// app.use(limiter);
app.use(express.static(path.join(__dirname, "../public"), { dotfiles: "allow" }));

app.use(express.json());

initializeExpress(app);

function getServer() {
    if (true || process.env.NODE_ENV !== "production") {
        return createServer(app);
    } else {
        // Certificate
        // const privateKey = fs.readFileSync("/etc/letsencrypt/live/mmo3.oncyber.io/privkey.pem", "utf8");
        // const certificate = fs.readFileSync("/etc/letsencrypt/live/mmo3.oncyber.io/cert.pem", "utf8");
        // const ca = fs.readFileSync("/etc/letsencrypt/live/mmo3.oncyber.io/chain.pem", "utf8");
        // const credentials = {
        //     key: privateKey,
        //     cert: certificate,
        //     ca: ca,
        // };
        // return https.createServer(credentials, app);
    }
}

const gameServer = new Server({
    presence: new colyseus.LocalPresence(),
    transport: new WebSocketTransport({
        server: getServer(),
    }),
    // driver: new colyseus.MongooseDriver(),
});

registerCrowdRoom(gameServer);

gameServer.define("lobby", LobbyRoom);

gameServer.define("cyber", CyberRoom);

gameServer.define("game", GameRoom);

gameServer.listen(2567).then(() => {
    console.log(`Listening on ws://localhost:${2567}`);
});
