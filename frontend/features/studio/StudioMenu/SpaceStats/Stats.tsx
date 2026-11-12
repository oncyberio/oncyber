import {
    studioAction,
    studioHeading,
} from "@features/studio/styles/primitives";
import { useContext, useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
    DeleteField,
    getAnalytics,
    updateExhibit,
    deleteAsset,
} from "@utils/saveToDb";
import { cloudinary, resize } from "@utils/urlUtils";
import { UserContext } from "@context/UserContext";
import { Metrics } from "./Metrics";
import Input from "@ui/components/Input";
import { NButton } from "@features/studio/components/StudioButton";
import Table from "@ui/components/Table";
import Search from "@ui/icons/Search";
import Trash from "@ui/icons/Trash";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import styled from "styled-components";
import { ArtworkData, Experience } from "@uitypes/experience";
import { Asset } from "@uitypes/Asset";
import useSWR from "swr";
import { useEventCallback } from "@components/hooks/useEventCallback";
import InlineError from "@ui/components/InlineError";
import { removeKey } from "@utils/js";
import IconImg from "@ui/components/IconImg";
import { useEditorService } from "@features/studio/context/ExhibitEditorContext";
import { Commands } from "@features/studio/services/editor/CommandMap";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";

const columns = [
    {
        field: "thumbnail",
        headerName: "Thumbnail",
        textAlign: "left",
        width: 130,
    },
    { field: "name", headerName: "Name", textAlign: "left", width: 276 },
    { field: "clicks", headerName: "Opens", textAlign: "center", width: 320 },
    // {
    //     field: "redirect",
    //     headerName: "Redirect to marketplace",
    //     type: "number",
    //     width: 300,
    //     textAlign: "center",
    // },
    {
        field: "remove",
        type: "action",
        headerName: "Action",
        textAlign: "center",
        onClick: () => {
            console.log("Buy now");
        },
    },
];

const formatArtworks = (artworks: Experience["artworks"]) => {
    //
    let assets: Record<string, Asset> = {};

    Object.values(artworks || {}).forEach((artwork) => {
        const { data } = artwork;

        // if (!assets[data.token_id + "_" + data.token_address]) {
        assets[data.id] = data;
        // }
    });
    return Object.values(assets);
};

const swrOptions = {
    revalidateOnFocus: false,
    refreshInterval: 0,
};

export function Stats({
    exhibit,
    onClose,
}: {
    exhibit: Experience;
    onClose: () => unknown;
}) {
    //
    // The asset whose removal failed, shown above the table with a Retry
    // that removes it again (docs/feedback.md).
    const [failedRemove, setFailedRemove] = useState<{
        artwork: any;
        name: string;
    }>(null);

    const editorService = useEditorService();

    const { baseAnalyticsEvent } = useCurrentExhibit();

    const [isSearching, setSearching] = useState(false);

    const { token } = useContext(UserContext);

    const [search, setSearch] = useState<string>();

    const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>(
        {}
    );

    const query = useSWR(
        ["stats", exhibit.id, exhibit.artworks],
        async (_, id) => {
            //

            let assets = formatArtworks(exhibit?.artworks || {});

            let start = moment(new Date(exhibit?.createdAt));
            let now = moment();
            let daysSince = now.diff(start, "days");

            let data = await getAnalytics(token, exhibit.id);

            if (data.analytics) data.analytics.daysSince = daysSince;

            return {
                stats: data?.analytics,
                artworks: assets.sort(
                    (a, b) =>
                        (data?.analytics?.details_artwork?.[b.token_id] || 0) -
                        (data?.analytics?.details_artwork?.[a.token_id] || 0)
                ),
            };
        },
        swrOptions
    );

    useEffect(() => {
        // query.mutate()
    }, [exhibit?.artworks]);

    useEffect(() => {
        //
        amplitude_logAnalyticsEvent("visit_stats", baseAnalyticsEvent);
        //
    }, []);

    const handleRemove = useEventCallback(async (artwork, name?: string) => {
        //
        setFailedRemove(null);

        try {
            setRemoveLoading((s) => {
                return {
                    ...s,
                    [artwork.id]: true,
                };
            });

            const cmd = editorService.getCommand(Commands.RemoveArtworks, {
                targetMeshIds: [artwork.id],
            });

            await cmd.run();

            editorService.pushCommand(cmd);

            query.mutate({
                ...query.data,
                artworks: query.data.artworks.filter(
                    (it) => it.id !== artwork.id
                ),
            });

            amplitude_logAnalyticsEvent("remove_artwork", {
                ...baseAnalyticsEvent,
                mesh_id: artwork.id,
                chain: artwork.blockchain,
                marketplace: artwork.marketplace,
                source: "stats",
            });

            //
        } catch (err) {
            //
            console.error(err);

            setFailedRemove({ artwork, name });
            //
        } finally {
            setRemoveLoading((s) => removeKey(artwork.id, s));
        }
    }, []);

    const loading = !query.data;
    const error = query.error;

    const artworks = query.data?.artworks;
    const stats = query.data?.stats;

    const rows = useMemo(() => {
        const rows = [];

        if (!artworks) return rows;

        let name = null;

        const previewStyle = {
            borderRadius: 4,
            width: "56px",
            height: "56px",
            minWidth: 56,
            minHeight: 56,
        };

        artworks?.forEach((artwork, index) => {
            //

            if (
                artwork.mime_type === "cyber/triggerzone" ||
                artwork.mime_type === "cyber/globalstream"
            )
                return;

            const isText = artwork.mime_type?.includes("cyber/text");

            const isGLTF = artwork.mime_type?.includes("model/gltf");

            name = isText
                ? artwork.text || ""
                : artwork?.name
                ? artwork?.name
                : artwork.collection?.name
                ? artwork?.collection?.name + ` #${artwork?.token_id}`
                : "";

            let filter = search?.trim();

            if (
                filter &&
                !name?.toLowerCase().includes?.(filter.toLowerCase())
            ) {
                //
                return;
            }

            let preview = null;

            if (artwork.mime_type?.includes("video")) {
                let url =
                    artwork.dcompressed_animation_url ||
                    artwork.compressed_animation_url ||
                    artwork.animation_url;

                if (url) {
                    url = resize(url, 100);
                    preview = (
                        <video style={previewStyle}>
                            <source src={url} />
                        </video>
                    );
                }
            }

            if (preview == null) {
                let url =
                    artwork.dcompressed_image_url ||
                    artwork.image_preview_url ||
                    artwork.image_url;

                if (url) {
                    url = resize(url, 100);
                    preview = <img style={previewStyle} src={url} />;
                }
            }

            if (isGLTF) {
                preview = (
                    <img
                        style={previewStyle}
                        src={
                            "https://cyber.mypinata.cloud/ipfs/QmXb5QwKsPYTgJLqjUiPFhdJuVez6SJJzcDeEHM54gBEkE?filename=objectIcon_zzteca.png"
                        }
                    />
                );
            }

            if (isText) {
                preview = (
                    <img
                        style={previewStyle}
                        src={"/images/preview-immersive-text.png"}
                    />
                );
            }

            // `name` is shared by every row; the button keeps its own.
            const rowName = name;

            rows.push({
                _id: artwork.id,
                thumbnail: preview,
                name,
                clicks: stats?.details_artwork?.[artwork.token_id] || 0,
                // redirect: stats?.click_opensea?.[artwork.token_id] || 0,
                remove: (
                    <button
                        className="table-action"
                        onClick={() => handleRemove(artwork, rowName)}
                        disabled={removeLoading[artwork.id]}
                    >
                        {" "}
                        {removeLoading[artwork.id] ? "Removing..." : "Remove"}
                    </button>
                ),
            });
        });

        return rows;
    }, [query, removeLoading, search]);

    return (
        <Container data-studio-surface>
            <div className="header">
                <h2>Stats & performance</h2>
                <button
                    type="button"
                    aria-label="Close statistics"
                    className="close"
                    onClick={onClose}
                >
                    <IconImg name="x" size={20} mode="light" />
                </button>
            </div>
            <Metrics
                spaceVisits={loading ? "..." : stats?.click_start_show || 0}
                daysSinceCreation={loading ? "..." : stats?.daysSince || 0}
                score={exhibit.analytics?.score}
            />

            {loading ? (
                <p className="status" role="status">
                    Loading statistics…
                </p>
            ) : artworks.length == 0 ? (
                <p className="status">No assets placed</p>
            ) : (
                <>
                    <TopBar>
                        <div className="title">
                            <h3>Asset stats</h3>
                            <button
                                type="button"
                                className="search"
                                aria-label="Search assets"
                                aria-expanded={isSearching}
                                onClick={() => {
                                    setSearching(!isSearching);
                                }}
                            >
                                <Search strokeColor="currentColor" />
                            </button>
                        </div>
                        {isSearching && (
                            <Input
                                borderWidth="0"
                                overrideTheme="dark"
                                placeholder="Search for asset"
                                iconPosition="left"
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                }}
                            ></Input>
                        )}
                    </TopBar>

                    <InlineError
                        className="remove-failure"
                        message={
                            failedRemove &&
                            !removeLoading[failedRemove.artwork.id] &&
                            (failedRemove.name
                                ? `Couldn't remove “${failedRemove.name}”.`
                                : "Couldn't remove this asset.")
                        }
                        onRetry={() =>
                            handleRemove(
                                failedRemove.artwork,
                                failedRemove.name
                            )
                        }
                    />

                    <Table
                        className="stats-table scrollbar-hidden"
                        rows={rows}
                        columns={columns}
                    />
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    left: calc(10vw + 8px);
    top: calc(10vh - 8px);
    z-index: 4000;

    display: flex;
    flex-direction: column;

    width: 80vw;
    height: 80vh;
    background: var(--panel-bg);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    border-radius: var(--radius-panel);
    color: var(--panel-text-primary);
    padding: 20px 24px 8px;

    & > .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 20px;

        h2 {
            ${studioHeading}
        }

        .close {
            ${studioAction}
            flex-shrink: 0;
            width: 38px;
            height: 38px;
            margin: 0;
            padding: 0;
        }
    }

    & > .remove-failure {
        margin-bottom: 12px;
    }

    & > .status {
        margin: 20px 0;
        font: 400 13px/20px var(--studio-font, sans-serif);
        color: var(--studio-muted);
    }

    & .stats-table {
        flex: 1 1 0;
        overflow: auto;

        & thead,
        & thead > tr,
        & thead > tr > th {
            background: var(--studio-surface);
        }

        tbody > tr {
            border-bottom: 1px solid var(--studio-line);
        }

        th {
            color: var(--studio-muted);
        }

        th,
        td {
            text-align: center;
            font-weight: 500;
            font-size: 12px;
            line-height: 24px;
            color: var(--panel-text-primary);

            img,
            video {
                max-width: 100px;
                max-height: 100px;
                height: 100px;
                width: 100px;
                object-fit: cover;
                margin: 0 auto;
            }
        }

        & .table-action {
            border: none;
            background: none;
            font-weight: 500;
            font-size: 12px;
            line-height: 24px;
            text-align: right;
            text-decoration-line: underline;
            color: var(--panel-text-primary);
            cursor: pointer;
        }
    }

    button {
        margin: 0 auto;
    }

    @media (max-width: 600px) {
        left: 16px;
        width: calc(100vw - 32px);
        padding: 16px 16px 8px;

        & > .header .close {
            width: 44px;
            height: 44px;
        }
    }
`;

const TopBar = styled.div`
    flex: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin-bottom: 16px;

    & .title {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        margin: 12px 0;

        & > h3 {
            margin: 0;
            font: 400 16px/22px var(--studio-font, sans-serif);
        }

        & > .search {
            ${studioAction}
            width: 38px;
            margin: 0;
            padding: 0;
            color: var(--studio-muted);

            svg {
                width: 18px;
                height: 18px;
            }

            @media (max-width: 600px) {
                width: 44px;
                min-height: 44px;
            }
        }
    }

    input {
        margin: 0;
        height: 40px;
    }
`;
