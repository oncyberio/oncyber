import styled from "styled-components";

import React, { useState } from "react";

import { KitbashList } from "./KitbashList";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { showConfirm } from "@components/Dialogs";
import InlineError from "@ui/components/InlineError";

import { EMPTY_ROOM } from "@utils/emptyRoom";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { KitbashAssets } from "./KitbashAssets";
import { useUserKits } from "@features/studio/EditWorldMenu/hooks/useUserKits";

//
export function Kits3DTab() {
    //
    const kitsQuery = useUserKits();

    const hasManyKits = kitsQuery.kits?.length > 1;

    // console.log("slData", kits, error, isLoading);

    const { exhibit, destination, handleApplyKit } = useEditWorld();

    const room = exhibit.info.room;

    const [query, setQuery] = useState("");

    const [currentKit, setCurrentKit] = useState(room);

    const [showKitAssets, setShowKitAssets] = useState(
        destination.isFuture && currentKit !== EMPTY_ROOM.slug
    );

    // The kit that failed to apply, with the choice the visitor made, so
    // Retry applies it again without asking twice (docs/feedback.md).
    const [failedKit, setFailedKit] = useState<{
        kit: any;
        applyStylekit: boolean;
    }>(null);

    const applyKit = useEventCallback(async (kit, applyStylekit: boolean) => {
        //
        setFailedKit(null);

        const res = await handleApplyKit({
            kit: {
                id: kit.slug,
            },
            applyStylekit,
        });

        if (res) {
            //
            setCurrentKit(kit.slug);

            if (kit.slug !== EMPTY_ROOM.slug) {
                //
                setShowKitAssets(true);
            }
        } else {
            setFailedKit({ kit, applyStylekit });
        }
    }, []);

    const handleSelecKit = useEventCallback(async (kit) => {
        //
        const isEmptyKit = kit.slug === EMPTY_ROOM.slug;

        if (exhibit.info.room === kit.slug) {
            //
            if (!isEmptyKit) {
                //
                setShowKitAssets(true);
            }
        } else {
            //
            let opts: any = {
                type: "Warning",
            };

            let style = {
                display: "flex",
                flexDirection: "column",
                gap: "12px",
            } as const;

            let msg: React.ReactNode;

            if (isEmptyKit) {
                msg = (
                    <div style={style}>
                        <div>
                            This will reset all content in your current room!
                        </div>
                        <div>Do you want to reset to an empty room?</div>
                    </div>
                );

                opts.title = "Reset to empty room";

                opts.yes = "Reset";

                opts.no = "Cancel";
            } else {
                msg = (
                    <div style={style}>
                        {currentKit !== EMPTY_ROOM.slug && (
                            <div>
                                This will replace all content in your current
                                room!
                            </div>
                        )}
                        <div>Do you want to apply the default stylekit?</div>
                    </div>
                );

                opts.title = `Apply ${kit.name}`;

                opts.yes = "Apply Stylekit";

                opts.no = "Start Empty";

                opts.cancel = "Cancel";
            }

            const applyStylekit = await showConfirm(msg, opts);

            if (applyStylekit == null) return;

            await applyKit(kit, applyStylekit);
        }
    }, []);

    return (
        <Container>
            {destination.isFuture &&
                false &&
                currentKit != EMPTY_ROOM.slug &&
                hasManyKits && (
                    <div className="kit-path">
                        <span
                            onClick={() => {
                                kitsQuery.revalidate();
                                setShowKitAssets(false);
                            }}
                        >
                            3D kits
                        </span>
                        <span className="kit-sep">/</span>
                        <span
                            onClick={() => {
                                setShowKitAssets(true);
                            }}
                        >
                            {currentKit}
                        </span>
                    </div>
                )}
            <InlineError
                message={
                    failedKit &&
                    `Couldn't apply ${
                        failedKit.kit.name || failedKit.kit.slug
                    }.`
                }
                onRetry={() => applyKit(failedKit.kit, failedKit.applyStylekit)}
            />
            {showKitAssets ? (
                <KitbashAssets key="kit-assets" kit={currentKit} />
            ) : (
                <KitbashList
                    key="kit-list"
                    kitsQuery={kitsQuery}
                    current={currentKit}
                    onKitClick={handleSelecKit}
                />
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;

    & .kit-path {
        display: flex;
        gap: 0.5em;

        & > span {
            font-weight: 500;
            font-size: 11px;
            text-transform: uppercase;
            color: #ffffff;
            cursor: pointer;
        }
    }
`;
