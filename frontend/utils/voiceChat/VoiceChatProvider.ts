import { Result } from "@utils/js";
import { IRemoteAudioTrack } from "agora-rtc-sdk-ng";

export enum VoiceChatState {
    Disconnected,
    Connecting,
    Connected,
}

export interface VoiceChatProvider {
    //
    readonly state: VoiceChatState;

    readonly streams: Record<string, IRemoteAudioTrack>;

    onUserEnter?: (uid: string, stream: IRemoteAudioTrack) => void;

    onUserLeave?: (uid: string) => void;

    onLoopbackStopped?: () => void;

    onVolumeIndicator?: (
        volumes: Array<{ uid: string; level: number }>
    ) => void;

    getToken(
        channel: string,
        uid: string,
        spaceId: string,
        isPublisher?: boolean
    ): Promise<Result<string>>;

    join(
        channel: string,
        uid: string,
        spaceId: string,
        token: string,
        callbacks: {
            "user-published": (uid: string) => void;
            "user-unpublished": (uid: string) => void;
            "speaking-users": (
                volumes: {
                    level: number;
                    uid: any;
                }[]
            ) => void;
        }
    ): Promise<boolean>;

    enableVoice(token: string): Promise<void>;

    disableVoice(): Promise<void>;

    isMuted(): boolean;

    setMuted(b: boolean): Promise<void>;

    isVoiceEnabled(): boolean;

    leave(): Promise<void>;

    updateVoiceRange(
        spaceId: string,
        range: number,
        token: string
    ): Promise<Result<null>>;
}
