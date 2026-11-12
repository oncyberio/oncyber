import type { ModelSpaceArtwork } from "@3/three/factory/artwork/meshes/model/modelspaceartwork";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { ModelAnimationsView } from "./ModelAnimationsView";
export function ModelAnimations() {
    const selectedMesh = useSelectedArtwork() as unknown as ModelSpaceArtwork;
    const { exhibit, handleChangeAnimations } = useEditWorld();
    const animations =
        exhibit.artworks[selectedMesh.userData.id].animations ??
        selectedMesh.activeAnimations ??
        {};
    return (
        <ModelAnimationsView
            names={(selectedMesh.animations || []).map((clip, index) =>
                String(clip.name || index + 1)
            )}
            animations={animations}
            avatarOptions={
                selectedMesh.isAvatarModel
                    ? selectedMesh.avatarAnimationOptions
                    : undefined
            }
            onChange={(animations) => handleChangeAnimations({ animations })}
        />
    );
}
