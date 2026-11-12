// // imagine different types of games:

// import { AbstractGameObject } from "../abstract/AbstractGameObject";

// import { AbstractGamePlayer } from "../abstract/AbstractGamePlayer";

// export type GAME_OBJECT = AbstractGameObject | AbstractGamePlayer;

// const GAME = {
//     win_params: {
//         score: 10,
//         winners: 1,
//     },
//     lose_params: {
//         score: 0,
//     },
//     player: {
//         score: 5,
//     },
//     hit: {
//         enable: true,
//         callbacks: {
//             onInteracting: (target: AbstractGameObject, game: GameManager) => {
//                 // target.setScore(target.getScore() + 10);
//             },
//         },
//     },
//     objects: {
//         "-12.49X-0.10X-9.13X0.00X0.00X0.00": {
//             id: "-12.49X-0.10X-9.13X0.00X0.00X0.00",
//             callbacks: {
//                 onInteracting: (target: GAME_OBJECT, game: GameManager) => {
//                     if (target.isPlayer) {
//                         target.setScore(target.getScore() + 10);
//                     }
//                 },
//             },
//         },
//     },
// };

// export class GameManager {
//     players: GAME_OBJECT[] = [];

//     objects: GAME_OBJECT[] = [];

//     winConditions: any;

//     loseConditions: any;

//     started = false;

//     ended = false;

//     gameProgress: "idle" | "started" | "ended" = "idle";

//     joinAfterGameStarted = false;

//     accumulatedTime = 0;

//     winners: Array<string> = [];

//     timers = {};

//     private callbacks: any = {};

//     constructor(private readonly game_params = GAME) {
//         this.game_params = game_params;

//         // objects.artworks.forEach((key) => {

//         //     const object = objects.getObjectById(key);

//         //     console.log("game manager createdcreatedcreatedcreatedcreated", object);

//         //     this.objects.push(object); // get objects from scene
//         // });
//     }

//     update = (deltaTime: number) => {
//         if (this.gameProgress !== "started") return;

//         this.accumulatedTime += deltaTime;

//         // if (GAME.win_params.winners === this.players.length) {

//         //     this.players.forEach((player) => {
//         //         if (player instanceof AbstractGamePlayer) {

//         //             if (!player.getHasLost()) {
//         //                 this.onWin(player);
//         //             }
//         //         }
//         //     });

//         //     console.log("game manager update", this.players)

//         //     return;
//         // }

//         // if solo, you only need to check the interaction of the current player only with the other objects

//         this.players.forEach((player) => {
//             if (this.game_params.hit.enable) {
//                 // we need to check if current player is interacting any of the other players
//                 this.players.forEach((otherPlayer) => {
//                     // if (otherPlayer.getId() === player.getId()) return;
//                     if (this.game_params.hit.callbacks?.onInteracting) {
//                         player._isInteracting(
//                             this,
//                             otherPlayer,
//                             this.game_params.hit.callbacks
//                         );
//                     }
//                 });
//             }

//             this.objects.forEach((object) => {
//                 // check if player is touching the target

//                 if (
//                     this.game_params.objects[object.getId()].callbacks
//                         ?.onInteracting
//                 ) {
//                     object._isInteracting(
//                         this,
//                         player,
//                         this.game_params.objects[object.getId()].callbacks
//                     );
//                 }
//             });

//             if (player instanceof AbstractGamePlayer) {
//                 this.checkWinConditions(player);
//             }
//         });
//     };

//     checkWinConditions(player: AbstractGamePlayer) {
//         if (player.getScore() >= GAME.win_params.score) {
//             // stop the game we have a win
//             this.onWin(player);
//         }

//         if (player.getScore() <= GAME.lose_params.score) {
//             // stop player from playing since he lost
//             this.onLose(player);
//         }
//     }

//     addEvents = () => {
//         // on Player ready...
//         // check condition of game start
//         // if good then start game and call onGameStart callback
//     };

//     removeEvents = () => {
//         // loop callbacks instead
//         Object.keys(this.game_params.objects).forEach((key) => {
//             // remove event listeners
//             // Emitter.off(Events.KEY_DOWN, this.callbacks[ key + "/" + Events.KEY_DOWN]);
//         });
//     };

//     onWin(player: AbstractGamePlayer) {
//         // broadcast to other players that this player won

//         this.winners.push(player.getId());

//         if (this.winners.length === GAME.win_params.winners) {
//             // stop the game we have winners
//             this.ended = true;
//         }
//     }

//     onLose(player: AbstractGamePlayer) {
//         // broadcast to other players that this player lost

//         player.setHasLost(true);
//     }

//     // we check if the object has any scripting/behavior, if yes then we add to the game manager
//     addObject = (object: GAME_OBJECT) => {
//         const id = object.getId();

//         if (this.game_params.objects[id]) {
//             this.objects.push(object);

//             // add event listeners
//             if (this.game_params.objects[id].callbacks.onKeyPress) {
//                 // this.callbacks[id + "/" + Events.KEY_DOWN] = (e: any) =>
//                 //     this.game_params.objects[id].callbacks.onKeyPress(
//                 //         e,
//                 //         object,
//                 //         this
//                 //     );
//                 // Emitter.on(
//                 //     Events.KEY_DOWN,
//                 //     this.callbacks[id + "/" + Events.KEY_DOWN]
//                 // );
//             }
//         }
//     };

//     addPlayer(player: GAME_OBJECT) {
//         this.players.push(player);
//     }

//     getPlayerById(id: string): GAME_OBJECT {
//         return null;
//     }

//     getObjectById(id: string): GAME_OBJECT {
//         return null;
//     }

//     dispose() {
//         console.log("game manager disposed");
//     }
// }
