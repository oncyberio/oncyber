import { useState, useContext, useMemo, useEffect } from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UploadAsset } from "./UploadContent";
import Spinner from "@ui/components/Spinner";
import { useWalletContext } from "../../context/WalletContext";
import useSWR from "swr";
import {
    formatUploadedAsset,
    getSWRUploadKey,
    getUploader,
    UserAsseUpload,
} from "./utils";
import { PreviewGrid } from "../shared/Preview";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { MimeFilterDropdown, MimeFilterOpt } from "./MimeFilterDropdown";
import { UploadPreview } from "./UploadPreview";
import { useEditWorld } from "../../context/WorldEditContext";
import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { UploadAction } from "./UploadActions";
import { UploadOpt } from "../shared/AssetTypes";
import { PanelButton, PanelEmptyState } from "../shared/PanelContent";

import { LibrarySearch } from "../shared/Library";

const swrOptions = {
    revalidateOnFocus: false,
    refreshInterval: 0,
};

export function AddUpload({
    initialFilter = "all",
}: { initialFilter?: MimeFilterOpt } = {}) {
    //
    const { isAnonymous } = useContext(UserContext);

    const uploader = useMemo(() => {
        //
        return getUploader(isAnonymous);
        //
    }, [isAnonymous]);

    const { currentWalletId, userProfile } = useWalletContext();

    const {
        handleAddUpload,
        handleDragStart,
        placedAssets,
        baseAnalyticsEvent,
        addTogglerRef,
    } = useEditWorld();

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<MimeFilterOpt>(initialFilter);

    const { exhibit, user, token } = useContext(UserContext);

    const [loading, setLoading] = useState(false);

    const userUploads = useSWR(
        getSWRUploadKey(user?.id),
        () => uploader.fetchUploads(),
        swrOptions
    );

    const [dragAssets, setDragAssets] = useState<
        Record<string, Awaited<ReturnType<typeof formatUploadedAsset>>>
    >({});
    useEffect(() => {
        let active = true;
        setDragAssets({});
        Promise.all(
            (userUploads.data || []).map(async (upload) => {
                try {
                    return [
                        upload.hash,
                        await formatUploadedAsset(
                            upload,
                            currentWalletId,
                            userProfile
                        ),
                    ] as const;
                } catch {
                    return [upload.hash, null] as const;
                }
            })
        ).then((entries) => {
            if (active) setDragAssets(Object.fromEntries(entries));
        });
        return () => {
            active = false;
        };
    }, [userUploads.data, currentWalletId, userProfile]);

    const shownUploads = useMemo(() => {
        //
        if (!userUploads?.data || userUploads.error) return null;

        return userUploads.data.filter(
            (it) =>
                (filter === "all" || it.mimeType.startsWith(filter)) &&
                it.name.toLowerCase().includes(search.trim().toLowerCase())
        );
    }, [userUploads.data, userUploads.error, filter, search]);

    const handleUploadFinished = async ({
        url,
        name,
        hash,
        mimeType,
        keepPlaceholder = false,
    }) => {
        //
        // Insert the new upload into the cached list instead of re-reading the
        // whole library (which cost up to MAX_UPLOADS doc reads on every upload).
        // Dedupe by hash so re-uploading an existing file just moves it to top.
        userUploads.mutate((current: UserAsseUpload[] = []) => {
            const without = current.filter((it) => it.hash !== hash);
            const entry = {
                name,
                hash,
                url,
                mimeType,
                createdAt: Date.now(),
                lastModified: Date.now(),
            } as UserAsseUpload;
            return [entry, ...without];
        }, false);

        let asset = await formatUploadedAsset(
            { url, name, hash, mimeType },
            currentWalletId,
            userProfile
        );

        amplitude_logAnalyticsEvent("hang_custom_artwork", {
            user_id: user.id,
            exhibitId: exhibit.id,
            destination: exhibit?.info?.room,
            ownerId: exhibit.owner,
            image: url,
            title: asset?.name,
        });
    };

    const handleAssetClick = useEventCallback(
        async (upload, e: React.MouseEvent) => {
            //

            const asset = await formatUploadedAsset(
                upload,
                currentWalletId,
                userProfile
            );

            handleAddUpload({
                asset,
                keepPlaceholder: e.shiftKey,
                source: "click",
                autoSelect: true,
            });
        },
        []
    );

    const handleDrag = useEventCallback(
        (upload, previewUrl: string, e: React.DragEvent) => {
            // Native drag data must be installed before dragstart returns.
            const asset = dragAssets[upload.hash];
            if (!asset) {
                e.preventDefault();
                return;
            }
            handleDragStart(e as any, DRAG_MIMES.UPLOAD, {
                previewUrl,
                asset,
                mime: DRAG_MIMES.UPLOAD,
            });
        },
        []
    );

    return (
        <Container>
            <div className="library">
                <LibrarySearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search uploads"
                >
                    <MimeFilterDropdown
                        value={filter}
                        onChange={setFilter}
                        addTogglerRef={(el) =>
                            addTogglerRef(UploadOpt.value, el)
                        }
                    />
                </LibrarySearch>
                <PreviewGrid columns={3} className="upload-grid">
                    <UploadAsset onUploadFinished={handleUploadFinished} />
                    {userUploads.error ? (
                        <div className="library-error">
                            <PanelEmptyState title="Couldn't load uploads" />
                            <PanelButton
                                type="button"
                                onClick={() => userUploads.mutate()}
                            >
                                Try again
                            </PanelButton>
                        </div>
                    ) : !userUploads.data ? (
                        <SpinnerWrapper>
                            <Spinner isLightTheme={false} width={18} />
                        </SpinnerWrapper>
                    ) : shownUploads?.length ? (
                        <>
                            {shownUploads.map((upload) => {
                                //
                                const isPlaced =
                                    placedAssets[`/${upload.hash}`];

                                return (
                                    <UploadPreview
                                        key={upload.hash}
                                        upload={upload}
                                        dragReady={!!dragAssets[upload.hash]}
                                        onClick={(e) =>
                                            handleAssetClick(upload, e)
                                        }
                                        onChange={(
                                            action: UploadAction,
                                            upload: UserAsseUpload
                                        ) => {
                                            //
                                            if (action === "rename") {
                                                //
                                                userUploads.mutate(
                                                    userUploads.data.map(
                                                        (it) => {
                                                            //
                                                            if (
                                                                it.hash !==
                                                                upload.hash
                                                            )
                                                                return it;

                                                            return upload;
                                                        }
                                                    )
                                                );

                                                amplitude_logAnalyticsEvent(
                                                    "rename_custom_asset",
                                                    {
                                                        ...baseAnalyticsEvent,
                                                        asset: {
                                                            mime: upload.mimeType,
                                                            name: upload.name,
                                                            url: upload.url,
                                                        },
                                                    }
                                                );
                                                //
                                            } else if (action === "delete") {
                                                //
                                                userUploads.mutate(
                                                    userUploads.data.filter(
                                                        (it) => {
                                                            //
                                                            return (
                                                                it.hash !==
                                                                upload.hash
                                                            );
                                                        }
                                                    )
                                                );

                                                amplitude_logAnalyticsEvent(
                                                    "delete_custom_asset",
                                                    {
                                                        ...baseAnalyticsEvent,
                                                        asset: {
                                                            mime: upload.mimeType,
                                                            name: upload.name,
                                                            url: upload.url,
                                                        },
                                                    }
                                                );
                                            }
                                        }}
                                        onDrag={handleDrag}
                                        isPlaced={isPlaced}
                                        isOptimized={upload.d_optimized_files}
                                    />
                                );
                            })}
                        </>
                    ) : (
                        <div className="empty-library">
                            <PanelEmptyState
                                title={
                                    filter === "all" && !search
                                        ? "No uploads yet"
                                        : "No matching files"
                                }
                            >
                                Images, video, audio and 3D models.
                            </PanelEmptyState>
                        </div>
                    )}
                </PreviewGrid>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;

    & > .library {
        min-width: 0;
    }
    .upload-grid {
        margin-top: 12px;
        /* A failure takes a whole row after the card it is about; dense
           placement lets the next cards fill that card's row first, so
           the message sits right under it. With no message every card is
           one cell and the order is unchanged. */
        grid-auto-flow: row dense;
    }
    .upload-grid > [role="alert"] {
        grid-column: 1 / -1;
    }
    .upload-grid:has(> .empty-library) > :first-child {
        grid-column: 1 / -1;
        min-height: 180px;

        .prompt {
            font-size: 12px;
        }
        .upload-symbol {
            width: 44px;
            height: 44px;
        }
    }
    .empty-library,
    .library-error {
        grid-column: 1 / -1;
    }
    .library-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-bottom: 8px;
    }
`;

const SpinnerWrapper = styled.div`
    grid-column: 1 / -1;
    padding: 24px;
    padding-top: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
`;
