import { AgoraVoiceChatProvider } from "./AgoraVoiceChatProvider";
import { VoiceChatProvider } from "./VoiceChatProvider";
import { RelayedVoiceProvider } from "@features/worlds/relayedVoice";
import { worldDocument } from "@features/worlds/worldDocument";

class VoiceChat {
    instance: VoiceChatProvider;

    get() {
        if (this.instance == null) {
            // In the site's frame the page holds the microphone and plays
            // every voice; the world's voice service is a relay to it.
            const framed = worldDocument();
            this.instance = (framed
                ? new RelayedVoiceProvider(framed)
                : new AgoraVoiceChatProvider()) as unknown as VoiceChatProvider;
        }

        return this.instance;
    }
}

export default new VoiceChat();
