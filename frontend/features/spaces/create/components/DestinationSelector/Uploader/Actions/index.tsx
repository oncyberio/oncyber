import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { ThreeDotSpinner } from "@ui/icons/ThreeDot";
import { amplitude_logAnalyticsEvent, getCookie } from "@utils/analytics";
import { useUploader } from "../UploaderProvider";
import useOuterClick from "@components/hooks/useOuterClick";
import { useRooms } from "../../useRooms";
import { showConfirm, showError } from "@components/Dialogs";
import { noop, selectFile } from "@utils/js";
import { Destination } from "@uitypes/destinations";
import { deleteCinematic, deleteStylekit } from "@utils/saveToDb";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";

type RoomAction =
    | "view"
    | "edit_glb"
    | "edit"
    | "delete"
    | "cancel_review"
    | "edit_submit"
    | "delete"
    | "create_space";

export type RoomMenuState = "Idle" | "Submitting" | "Expanded";

export function ActionMenu({
    destination,
    onStateChange = noop,
    blacklist = [],
    triggerLabel,
}: {
    destination: Destination;
    triggerLabel?: string;
    blacklist?: RoomAction[];
    onStateChange?: (state: RoomMenuState) => unknown;
}) {
    //

    const router = useRouter();

    const { token } = useContext(UserContext);

    const { deleteRoom, updateRoom, handleCreateSpace } = useRooms();

    const {
        editPhysics,
        submitForReview,
        cancelReviewSubmission,
        reSubmission,
        isModal,
    } = useUploader();

    const { _id, slug, status } = destination;

    const [state, _setState] = useState<RoomMenuState>("Idle");

    const setState = (s: RoomMenuState) => {
        _setState(s);
        onStateChange(s);
    };

    const innerRef = useOuterClick(() => {
        _setState((state) => {
            if (state === "Expanded") {
                return "Idle";
            }
            return state;
        });
    });

    const handleViewDestination = useEventCallback(() => {
        //
        setState("Idle");

        amplitude_logAnalyticsEvent("visit_destination_clicked", {
            sessionId: getCookie("uploader"),
        });

        window.open(`/destinations/${slug}`, "_blank");
    }, []);

    const handleCancelReviewSubmission = useEventCallback(async () => {
        try {
            setState("Submitting");

            const ok = await showConfirm(
                "Are you sure you want to cancel review submission?",
                { type: "Question" }
            );

            if (ok) {
                await cancelReviewSubmission(_id);

                updateRoom(slug);
            }

            //
        } catch (err) {
            //
            console.error(err);

            showError("Failed to cancel review submission, Please try later");
        } finally {
            setState("Idle");
        }
    }, []);

    const handleReSubmission = useEventCallback(async () => {
        try {
            setState("Submitting");

            const ok = await showConfirm("Are you sure you want to resubmit?", {
                type: "Question",
            });

            if (ok) {
                await reSubmission(_id);

                updateRoom(slug);
            }

            //
        } catch (err) {
            //
            console.error(err);

            showError("Resubmission failed, try later.");
        } finally {
            setState("Idle");
        }
    }, []);

    const handleEdit3DModel = useEventCallback(async () => {
        //
        try {
            setState("Submitting");

            const file = await selectFile({
                description: "GLB/GLTF 3D models",
                mime: "model/gltf",
                extensions: [".glb", ".gltf"],
            });

            if (file != null) {
                //
                setState("Idle");

                const fileURL = URL.createObjectURL(file);

                const uPath = {
                    fileURL,
                };

                editPhysics(destination, uPath, (destination) => {
                    //
                    updateRoom(destination || slug);
                });
            }
            //
        } catch (err) {
            //
            console.error(err);
        } finally {
            //
            setState("Idle");
        }

        setState("Idle");

        // TODO
    }, []);

    const handleEditDestinationPhysics = useEventCallback(() => {
        //
        setState("Idle");

        if (!isModal) {
            //
            const pathname = `/destinations/${destination.slug}/edit`;

            router.push(pathname, {
                pathname,
            });
        } else {
            editPhysics(destination, null, (destination) => {
                //
                updateRoom(destination || slug);
            });
        }
    }, []);

    const handleDeleteDestination = useEventCallback(async () => {
        try {
            //
            setState("Submitting");

            const ok = await showConfirm(
                "Are you sure you want to delete this destination?",
                { type: "Danger" }
            );

            if (ok) {
                try {
                    await Promise.all([
                        deleteCinematic(slug),
                        deleteStylekit(token, slug),
                    ]);
                } catch (error) {
                    console.log(error);
                }

                //
                await deleteRoom(destination._id);
            }
        } catch (err) {
            //
            console.log("err", err);

            showError("Failed to delete destination, Please try later");
        } finally {
            setState("Idle");
        }
    }, []);

    const handleEditSubmitData = useEventCallback(() => {
        submitForReview(destination, () => {
            updateRoom(slug);
        });
    }, []);

    const handleUseNow = useEventCallback(async () => {
        try {
            setState("Submitting");

            const success = await handleCreateSpace(destination);

            if (success) {
                window.open("/studio", "_blank");
            }
        } finally {
            setState("Idle");
        }
    }, []);

    const showMenu = status !== "verified" && status !== "failed";

    const isBusy = state === "Submitting";

    const canUse = (action) => !blacklist.includes(action);

    return (
        <Actions ref={innerRef as any}>
            {showMenu && (
                <button
                    className="menu"
                    aria-label={triggerLabel || "Destination actions"}
                    aria-expanded={state === "Expanded"}
                    disabled={isBusy}
                    onClick={() => {
                        if (state === "Idle") {
                            setState("Expanded");
                        } else if (state === "Expanded") {
                            setState("Idle");
                        }
                    }}
                >
                    {triggerLabel && <span>{triggerLabel}</span>}
                    <ThreeDotSpinner fill="#070707" loading={isBusy} />
                </button>
            )}
            {state === "Expanded" && (
                <div className="items">
                    {canUse("view") && (
                        <RoundButton onClick={handleViewDestination}>
                            View
                        </RoundButton>
                    )}

                    {canUse("edit_glb") && (
                        <RoundButton onClick={handleEdit3DModel}>
                            Update 3D Model
                        </RoundButton>
                    )}

                    {canUse("edit") && (
                        <RoundButton onClick={handleEditDestinationPhysics}>
                            Edit Scene
                        </RoundButton>
                    )}

                    {/* {destination.params.isFuture && (
                        <RoundButton onClick={handleEditDestinationKitbash}>
                            Edit Kitbash
                        </RoundButton>
                    )} */}

                    {status === "rejected" && (
                        <>
                            <RoundButton onClick={handleReSubmission}>
                                Resubmit
                            </RoundButton>
                        </>
                    )}

                    {status === "tested" && canUse("delete") && (
                        <>
                            <RoundButton onClick={handleDeleteDestination}>
                                Delete
                            </RoundButton>
                        </>
                    )}
                    {status === "submitted" && canUse("cancel_review") && (
                        <RoundButton onClick={handleCancelReviewSubmission}>
                            Cancel review
                        </RoundButton>
                    )}

                    {status === "submitted" && canUse("edit_submit") && (
                        <RoundButton onClick={handleEditSubmitData}>
                            Edit Submit Data
                        </RoundButton>
                    )}

                    {canUse("create_space") && (
                        <RoundButton onClick={handleUseNow}>
                            Use Now
                        </RoundButton>
                    )}
                </div>
            )}
        </Actions>
    );
}

const Actions = styled.div`
    position: relative;

    & > .spinner {
        width: 24px;
        height: 24px;
        user-select: none;
    }

    & > .menu {
        width: 36px;
        height: 36px;
        display: flex;
        cursor: pointer;
        align-items: center;
        border-radius: 200px;
        justify-content: center;
        background: transparent;
        border: 1px solid #e0e0e0;
    }

    & > .items {
        width: 161px;
        z-index: 999;
        padding: 10px 0px;
        height: auto;
        right: 0;
        margin-top: 4px;
        position: absolute;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
            0px 12px 28px rgba(0, 0, 0, 0.11);

        & > button {
            font-style: normal;
            font-weight: 500;
            font-size: 14px;
            line-height: 24px;
            color: #3d3f46;
            height: 40px;
            width: 100%;
            padding: 0 15px;
            border-radius: 0px;
            display: flex;
            justify-content: flex-start;

            @media (max-width: 830px) {
                font-size: 12px;
            }

            &:hover {
                background: #f5f5f5;
            }
        }
    }
`;
