import { AgoraVoiceChatProvider } from "./AgoraVoiceChatProvider";
import { VoiceChatProvider } from "./VoiceChatProvider";

class VoiceChat {
    instance: VoiceChatProvider;

    get() {
        console.log("test deployement");
        if (this.instance == null) {
            let instance = new AgoraVoiceChatProvider();
            this.instance = instance;
        }

        return this.instance;
    }
}

export default new VoiceChat();
