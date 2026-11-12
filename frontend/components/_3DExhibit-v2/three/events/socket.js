// @ts-check

import Augmented from "@3abstract/augmented";

import Events from "@3events"
import { EVENTS } from "walletlink/dist/init";


class Socket extends Augmented {

    init(opts) {

        this.MultiplayerService = opts.MultiplayerService

        this.addEvents();

        this.PAYLOAD_OP_CODE = 1;
    }

    addEvents() {

        if (this.MultiplayerService.roomService?.room) {
            // this.MultiplayerService.roomService.room.onStateChange.once((state) => {
            //     console.log("this is the first room state!", state);
            // });

            // this.MultiplayerService.roomService.room.onStateChange((state) => {
            //     console.log("the room state has been updated:", state);
            // });

            this.MultiplayerService.roomService.room.onStateChange((state) => {

                this.emit(Events.MULTIPLAYER_PACKET, { packet: state })
            });

            this.MultiplayerService.roomService.room.onMessage("*", (data) => {
                console.log("message", data);
            })

            this.MultiplayerService.roomService.room.state.players.onAdd = (player, sessionId) => {
                console.log("player joined", sessionId, player);

                this.emit(Events.PLAYER_JOINED, {sessionId, player})

                // // Later: Only listen to specific field changes
                // player.listen("position", (position) => { // etc
                //     console.log("position changed", position);
                //     this.entities[player.userId] = position;
                // });
            }

            this.MultiplayerService.roomService.room.state.players.onRemove = (player, sessionId) => {

                this.emit(Events.PLAYER_LEAVE, { sessionId: player.sessionId })

                // player.listen("position", (position) => {
                //     console.log("position changed", position);
                // });
            }
        }

        this.on(Events.SEND_PACKET, this.handleSendPayload)
    }

    removeEvents() {

        this.off(Events.SEND_PACKET, this.handleSendPayload)
    }

    handleSendPayload = ({ code, payload}) => {

        // console.log(code, payload);

        if (this.MultiplayerService.roomService?.room) {
            this.MultiplayerService.roomService.room.send(code, payload)
        }
    }


    dispose() {

        this.removeEvents()
    }

}


export default new Socket();
