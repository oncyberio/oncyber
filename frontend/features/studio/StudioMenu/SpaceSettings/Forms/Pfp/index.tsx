import { useState } from "react";
import styled from "styled-components";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useUserAvatars } from "@components/hooks/useUserAvatars";
import {
    LibraryCard,
    LibraryGrid,
    LibrarySearch,
} from "@features/studio/EditWorldMenu/AddAsset/shared/Library";
import {
    PanelEmptyState,
    PanelNote,
} from "@features/studio/EditWorldMenu/AddAsset/shared/PanelContent";
import { Toggle } from "@features/studio/components/Toggle";
import UploadService from "@api/uploader/_api";
import InlineError from "@ui/components/InlineError";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export function Pfp() {
    //
    const [query, setQuery] = useState("");

    // The picture that failed to save, kept so Retry can save it again.
    // The message sits above the picker. See docs/feedback.md.
    const [failedPick, setFailedPick] = useState(null);

    const { exhibit, exhibitStore, userRole, baseAnalyticsEvent } =
        useCurrentExhibit();

    const params = exhibit.params || {};

    const [currentPfp, setCurrentPfp] = useState(params.pfp);

    const [isSubmitting, setSubmitting] = useState(false);

    const assetsReq = useUserAvatars();

    const [isEnabled, setEnabled] = useState(params.pfp != null);

    const canEdit = userRole === "owner" || userRole === "admin-curator";

    const handleToggle = useEventCallback((enabled: boolean) => {
        //

        if (!canEdit) return;

        if (!enabled) {
            //
            setEnabled(false);

            setCurrentPfp(null);

            setFailedPick(null);

            exhibitStore.updateExhibitParams({
                pfp: undefined,
            });

            amplitude_logAnalyticsEvent(
                "disable_space_pfp",
                baseAnalyticsEvent
            );
            //
        } else {
            //
            setEnabled(true);

            amplitude_logAnalyticsEvent("enable_space_pfp", baseAnalyticsEvent);
        }
        //
    }, []);

    const handleChange = useEventCallback(async (data) => {
        //
        if (isSubmitting || !canEdit || !isEnabled) return;

        try {
            setSubmitting(true);

            setFailedPick(null);

            const publicId = `${data.contract_address}/${
                data.token_id
            }/${new Date().getTime()}`;

            const mimeType = "image/jpeg";

            const result = await UploadService.uploadMedia({
                publicId,
                url: data.img,
                mimeType,
            });

            const pfp = {
                avatar: result.secure_url,
                avatarContractAddress: data.contract_address,
                avatarTokenId: data.token_id,
            };

            setCurrentPfp(pfp);

            //
            exhibitStore.updateExhibitParams({
                pfp,
            });

            amplitude_logAnalyticsEvent("change_space_pfp", {
                ...baseAnalyticsEvent,
                pfp,
            });
            //
        } catch (err) {
            //
            console.error(err);

            setFailedPick(data);
        } finally {
            setSubmitting(false);
        }
    }, []);

    const assets = assetsReq?.data?.assets;

    const shownAssets = (assets || []).filter(
        (asset) =>
            asset.image_preview_url &&
            (asset.name || "")
                .toLowerCase()
                .includes(query.trim().toLowerCase())
    );

    return (
        <Container aria-busy={isSubmitting}>
            <div className="setting-row">
                <div>
                    <h3>Visitor appearance</h3>
                    <p>Use a shared profile picture.</p>
                </div>
                <Toggle
                    label="Use a shared visitor picture"
                    disabled={!canEdit || isSubmitting}
                    value={isEnabled}
                    onChange={handleToggle}
                />
            </div>
            {currentPfp?.avatar && (
                <div className="current-pfp">
                    <img
                        src={currentPfp.avatar}
                        alt="Current visitor profile picture"
                    />
                    <div>
                        <span>Current default</span>
                        <PanelNote>
                            {isSubmitting
                                ? "Saving…"
                                : "Shown to visitors when they arrive."}
                        </PanelNote>
                    </div>
                </div>
            )}
            {isEnabled ? (
                <>
                    <InlineError
                        message={
                            failedPick &&
                            !isSubmitting &&
                            "Couldn't update the visitor picture."
                        }
                        onRetry={() => handleChange(failedPick)}
                    />
                    <LibrarySearch
                        value={query}
                        onChange={setQuery}
                        placeholder="Search your collection"
                    />
                    {assetsReq?.state === "InitialLoading" ? (
                        <PanelEmptyState title="Loading your collection…" />
                    ) : assetsReq?.state === "LoadinError" ? (
                        <PanelEmptyState title="Couldn't load your collection">
                            Try reopening this panel.
                        </PanelEmptyState>
                    ) : (
                        <>
                            <LibraryGrid>
                                {shownAssets.map((asset) => (
                                    <LibraryCard
                                        key={`${asset.contract_address}/${asset.token_id}`}
                                        name={
                                            asset.name || `#${asset.token_id}`
                                        }
                                        image={asset.image_preview_url}
                                        selected={
                                            currentPfp?.avatarContractAddress ===
                                                asset.contract_address &&
                                            currentPfp?.avatarTokenId ===
                                                asset.token_id
                                        }
                                        disabled={!canEdit || isSubmitting}
                                        onClick={() =>
                                            handleChange({
                                                img: asset.image_preview_url,
                                                contract_address:
                                                    asset.contract_address,
                                                token_id: asset.token_id,
                                            })
                                        }
                                    />
                                ))}
                            </LibraryGrid>
                            {!shownAssets.length && (
                                <PanelEmptyState
                                    title={
                                        query
                                            ? "No matching artwork"
                                            : "No artwork in your wallet"
                                    }
                                >
                                    Choose an NFT from your collection as the
                                    visitor default.
                                </PanelEmptyState>
                            )}
                        </>
                    )}
                </>
            ) : (
                <PanelEmptyState title="Visitors use their own profile picture">
                    Enable a shared picture to choose one from your collection.
                </PanelEmptyState>
            )}
            {isSubmitting && !currentPfp?.avatar && (
                <PanelNote role="status">Saving…</PanelNote>
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    min-width: 0;
    .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border-radius: var(--studio-radius-card);
        border: 1px solid var(--studio-line);
        background: var(--studio-inset);
    }
    h3 {
        margin: 0;
        font: 500 13px/20px var(--studio-font);
        color: var(--studio-ink);
    }
    p {
        margin: 4px 0 0;
        font: 400 12px/18px var(--studio-font);
        color: var(--studio-muted);
    }
    .setting-row > button::before {
        content: "";
        position: absolute;
        inset: -12px -4px;
    }
    .setting-row > button {
        position: relative;
    }
    .current-pfp {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px;
        font: 400 12px/18px var(--studio-font);
    }
    .current-pfp img {
        width: 48px;
        height: 48px;
        object-fit: cover;
        border-radius: 8px;
    }
`;
