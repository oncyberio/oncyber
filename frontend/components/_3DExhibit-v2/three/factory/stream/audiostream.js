// @ts-check


import Multiplayer from "@3factory/multiplayer"
import { USER_INTERACTED, VOICE_ROLLOFF_FACTOR } from "../../constants"
import { StreamAudioPlayer } from "../artwork/controllers/players"
import { PseudoAudioController } from "../artwork/controllers/pseudoaudiocontroller"


export class AudioStream {

    /**
     *
     * @param { { id: string, stream: import("./streamcontainer").ShareStream } } opts
     */
    constructor({ id, stream }) {

        const player = Multiplayer.players[id]

        if(player == null) {

            throw new Error("Player not found " + id)
        }

        /** @type { import("./streamcontainer").ShareStream } */
        this.stream = stream

        this.audioTrack = stream.getAudioTracks()[0]

        this.audioController = new PseudoAudioController({
            mesh: player,
            audioPlayer: new StreamAudioPlayer(stream),
            volume: player.voiceRange,
            rolloffFactor: VOICE_ROLLOFF_FACTOR
        })

        // this.audioController.showVolumeRange()

        USER_INTERACTED.then(() => {
            this.audioController.play()
        })
    }

    dispose() {

        if(this.wasDisposed) return

        this.wasDisposed = true

        this.audioController?.dispose()

        this.audioTrack?.stop()

        this.stream = null

        this.audioController = null
    }
}
