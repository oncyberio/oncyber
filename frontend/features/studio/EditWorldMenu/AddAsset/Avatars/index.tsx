import { useContext, useEffect, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { DRAG_MIMES } from "@3/three/constants";
import { useEditWorld } from "../../context/WorldEditContext";
import { useWalletContext } from "../../context/WalletContext";
import { Pfp } from "@features/studio/StudioMenu/SpaceSettings/Forms/Pfp";
import { PanelEmptyState } from "../shared/PanelContent";
import { formatUploadedAsset } from "../Upload/utils";
import { AddUpload } from "../Upload";
import { AvatarPicker, STUDIO_AVATARS } from "./AvatarPicker";
const avatars = STUDIO_AVATARS;
function warmAvatar(url: string) {
    import("@3/three/factory/artwork/meshes/model/preloadAvatar")
        .then((module) => module.preloadAvatar(url))
        .catch(() => {
            /* Insertion retries a failed warm request. */
        });
}

export function AddAvatars() {
    const [models, setModels] = useState<
        Record<string, Awaited<ReturnType<typeof formatUploadedAsset>>>
    >({});
    const [pending, setPending] = useState<string>(null);
    const { isAnonymous } = useContext(UserContext);
    const { handleAddUpload, handleDragStart } = useEditWorld();
    const { currentWalletId, userProfile } = useWalletContext();
    useEffect(() => {
        let active = true;
        Promise.all(
            avatars.map(async (avatar) => {
                const asset = await formatUploadedAsset(
                    {
                        url: avatar.url,
                        hash: `oncyber-avatar-${avatar.id}`,
                        name: avatar.name,
                        mimeType: "model/gltf-binary",
                    },
                    currentWalletId,
                    userProfile
                );
                return [
                    avatar.id,
                    {
                        ...asset,
                        image_url: avatar.image,
                        image_preview_url: avatar.image,
                    },
                ] as const;
            })
        ).then((entries) => {
            if (active) setModels(Object.fromEntries(entries));
        });
        return () => {
            active = false;
        };
    }, [currentWalletId, userProfile]);
    return (
        <AvatarPicker
            pending={pending}
            available={(avatar) => !!models[avatar.id]}
            onWarm={(avatar) => warmAvatar(avatar.url)}
            uploads={<AddUpload initialFilter="model" />}
            visitors={
                isAnonymous ? (
                    <PanelEmptyState title="Connect a wallet to set visitor defaults" />
                ) : (
                    <Pfp />
                )
            }
            onPick={async (avatar, event) => {
                const keepPlaceholder = event.shiftKey;
                setPending(avatar.id);
                try {
                    await handleAddUpload({
                        asset: models[avatar.id],
                        keepPlaceholder,
                        targetMesh: null,
                        source: "click",
                        autoSelect: true,
                    });
                } finally {
                    setPending(null);
                }
            }}
            onDrag={(avatar, event) =>
                handleDragStart(event as any, DRAG_MIMES.UPLOAD, {
                    previewUrl: avatar.image,
                    previewImg: event.currentTarget.querySelector("img"),
                    asset: models[avatar.id],
                    mime: DRAG_MIMES.UPLOAD,
                })
            }
        />
    );
}
