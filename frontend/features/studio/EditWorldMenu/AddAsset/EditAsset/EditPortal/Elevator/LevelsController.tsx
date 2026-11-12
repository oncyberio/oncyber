import { useContext, useState } from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@features/studio/components/StudioButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useSelectedPortal } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { AddPortal } from "../../../Portal";

export default function LevelsController() {
    //

    const { exhibit, handleAddPortal } = useEditWorld();

    const selectedMesh = useSelectedPortal();

    const { user } = useContext(UserContext);

    const portal = exhibit.portals?.[selectedMesh.userData.id];

    const [isAdding, setIsAdding] = useState(false);

    async function handleDelete(level) {
        //
        const placeholderId = selectedMesh.userData.id;

        const portalId = placeholderId;

        const levels = exhibit.portals[portalId].levels;

        const newLevels = levels
            .filter((portal) => portal.level !== level)
            .map((portal, index) => {
                portal.level = index;
                return portal;
            });

        // @ts-ignore
        selectedMesh.switchLevel({
            exhibitId: newLevels[0].exhibitId,
            cHeroImg: newLevels[0].cHeroImg,
            cHeroImg360: newLevels[0].cHeroImg360,
        });

        const update: any = {
            type: "SET_PORTAL",
            payload: {
                ...exhibit.portals[portalId],
                exhibitId: newLevels[0].exhibitId,
                cHeroImg: newLevels[0].cHeroImg || "",
                cHeroImg360: newLevels[0].cHeroImg360 || "",
                exhibitIds: newLevels,
            },
        };

        const coords = exhibit.info.coords || null;

        const editorAction = {
            type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
            placeholderId,
            exhibitId: exhibit.id,
            coords,
            keepPlaceholder: false,
            isElevator: true,
        };

        await databaseHandler(update, {
            ...editorAction,
            remotePayload: update.payload,
        });

        amplitude_logAnalyticsEvent("add_portal", {
            user_id: user.id,
            owner: exhibit.owner,
            exhibit_id: exhibit.id,
            target_exhibit_id: exhibit?.id,
            reuse_placeholder: false,
            target_exhibit_destination: exhibit?.info?.room,
            target_exhibit_owner: exhibit?.owner,
            target_exhibit_headline: exhibit?.info?.headline,
            is_owner:
                exhibit?.owner?.toLowerCase?.() === user?.id?.toLowerCase?.(),
            isElevator: true,
        });
    }

    return (
        <Container>
            <NButton
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                onClick={() => setIsAdding((state) => !state)}
            >
                {!isAdding ? "Add" : "Back"}
            </NButton>

            {isAdding ? (
                <div>
                    <AddPortalWrapper>
                        <AddPortal isElevator />
                    </AddPortalWrapper>
                </div>
            ) : (
                portal.levels.map(
                    ({ exhibitId, cHeroImg, level, cHeroImg360 }, index) => {
                        return (
                            <ExhibitContainer
                                key={index}
                                onClick={() => {
                                    // @ts-ignore
                                    selectedMesh.switchLevel({
                                        exhibitId,
                                        cHeroImg,
                                        cHeroImg360,
                                    });
                                }}
                            >
                                {portal.levels.length > 1 ? (
                                    <IconWrapper
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(level);
                                        }}
                                    >
                                        <IconImg size={16} name="trash" />
                                    </IconWrapper>
                                ) : null}

                                <img src={cHeroImg} />
                                <div>
                                    <p>{exhibitId}</p>
                                    <p>Level {index}</p>
                                </div>
                            </ExhibitContainer>
                        );
                    }
                )
            )}

            <div></div>
        </Container>
    );
}

const Container = styled.div``;

const AddPortalWrapper = styled.div`
    margin-top: 18px;
`;

const ExhibitContainer = styled.div`
    display: flex;
    gap: 12px;
    width: 100%;
    margin-top: 21px;
    cursor: pointer;
    position: relative;

    img {
        width: 60px;
        height: 60px;
        object-fit: cover;
    }

    p {
        margin: 0;
    }

    p:first-child {
        font-weight: 500;
    }

    p:last-child {
        font-weight: 500;
        font-size: 14px;
        color: #6c6c7f;
        margin-top: 4px;
    }
`;

const IconWrapper = styled.div`
    position: absolute;
    top: 5px;
    right: 5px;
`;
