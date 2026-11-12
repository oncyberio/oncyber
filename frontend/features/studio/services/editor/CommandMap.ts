import { eachKey } from "@utils/js";
import { AbstractCommand } from "./AbstractCommand";
import { AddArtworkBulkCommand } from "./AddArtworkBulkCommand";
import { AddArtworkCommand } from "./AddArtworkCommand";
import { ChangeAnimationsCommand } from "./ChangeAnimationsCommand";
import { ChangeAudioOptCommand } from "./ChangeAudioOptCommand";
import { ChangeColliderCommand } from "./ChangeColliderCommand";
import { ChangeDimensionsCommand } from "./ChangeDimensionsCommand";
import { ChangeEnvmapCommand } from "./ChangeEnvmapCommand";
import { ChangeFrameCommand } from "./ChangeFrameCommand";
import { ChangeHTMLViewCommand } from "./ChangeHTMLViewCommand";
import { ChangeTextCommand } from "./ChangeTextCommand";
import { ChangeTransformCommand } from "./ChangeTransformCommand";
import { ChangeVideoOptCommand } from "./ChangeVideoOptCommand";
import { RefreshArtworkCommand } from "./RefreshArtworkCommand";
import { RemoveArtworksCommand } from "./RemoveArtworkCommand";
import { RemovePortalsCommand } from "./RemovePortalCommand";
import { SetPortalCommand } from "./SetPortalCommand";
import { ChangeLockCommand } from "./ChangeLockCommand";
import { DuplicateArtworksCommand } from "./DuplicateArtworksCommand";
import { AddKitbashCommand } from "./AddKitbashCommand";
import { RemoveKitbashCommand } from "./RemoveKitbashCommand";
import { MultiCommand } from "./MultiCommand";
import { RemoveItemsCommand } from "./RemoveItemsCommand";
import { DuplicateKitbashCommand } from "./DuplicateKitbashCommand";
import { DuplicateItemsCommand } from "./DuplicateItemsCommand";

export const CommandMap = {
    AddArtwork: AddArtworkCommand,
    AddArtworkBulk: AddArtworkBulkCommand,
    ChangeAnimations: ChangeAnimationsCommand,
    ChangeAudio: ChangeAudioOptCommand,
    ChangeDimensions: ChangeDimensionsCommand,
    ChangeEnvmap: ChangeEnvmapCommand,
    ChangeFrame: ChangeFrameCommand,
    ChangeHTML: ChangeHTMLViewCommand,
    ChangeText: ChangeTextCommand,
    ChangeTransform: ChangeTransformCommand,
    ChangeCollider: ChangeColliderCommand,
    ChangeVideo: ChangeVideoOptCommand,
    RefreshArtwork: RefreshArtworkCommand,

    RemoveArtworks: RemoveArtworksCommand,
    RemovePortals: RemovePortalsCommand,

    DuplicateArtwork: DuplicateArtworksCommand,
    DuplicateKitbash: DuplicateKitbashCommand,
    DuplicateItems: DuplicateItemsCommand,

    SetPortal: SetPortalCommand,
    ChangeLock: ChangeLockCommand,
    AddKitbash: AddKitbashCommand,
    RemoveKitbash: RemoveKitbashCommand,

    RemoveItems: RemoveItemsCommand,
    Multi: MultiCommand,
} as const;

export type CommandType = keyof typeof CommandMap;

export type CommandOptsMap = {
    [K in CommandType]: ConstructorParameters<typeof CommandMap[K]>[1];
};

export type CommandInstanceMap = {
    [K in CommandType]: InstanceType<typeof CommandMap[K]>;
};

export type CommandTypeMap = {
    [K in CommandType]: K;
};

export const Commands: CommandTypeMap = eachKey(
    CommandMap,
    (_, key) => key
) as any;
