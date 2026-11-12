import React, { useContext, useState } from "react";
import styled, { css } from "styled-components";
import Avatar from "@ui/components/Avatar";
import Spinner from "@components/Spinner";
import IconImg from "@ui/components/IconImg";
import { UserContext } from "@components/context/UserContext";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useCyberTranslation } from "@components/context/I18nContext";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { usePanel } from "../../context/PanelProvider";
import { DropFile } from "./DropFile";
import AvatarChoice from "./AvatarChoice";
import { scoreMap } from "../constants";
import Slider from "@ui/components/Slider";
import {
    useVrm,
    DEFAULT_VRMS,
    SLIDER_STEP,
} from "@components/context/VrmContext";
import Uploaded from "./Uploaded";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import AccountDashboard from "@components/modals/AccountDashboard";
import { showModal } from "@components/Dialogs";

const DISPLAY_ITEMS_COUNT = 20;
const CUSTOM_VRM_DISPLAY_ITEMS_COUNT = 7;

export default function Profile({ allowUpload = true }) {
    const { user: _user, userData } = useContext(UserContext);

    const [showMore, setShowMore] = useState({
        owned: false,
        default: false,
        uploaded: false,
    });

    const { t } = useCyberTranslation();

    const { toggleAuth, selectedUser } = usePanel();

    const {
        uploadedVrms,
        activeVrm,
        loadingUpload,
        loading,
        ownedVrms,
        loadingOwned,
        defaultScale,
        onScale,
        onUploadVrm,
        onSelectVrm,
    } = useVrm();

    const avatarUrl =
        (selectedUser?.userId
            ? selectedUser?.userData?.avatar
            : userData?.avatar) || DEFAULT_PLAYER_AVATAR_PICTURE;

    const user = selectedUser?.userId
        ? {
              id: selectedUser?.userData?.walletId,
          }
        : _user;

    const walletId = user?.id?.slice(0, 4) + "..." + user?.id?.slice(-4);

    const username = selectedUser?.userId
        ? selectedUser?.userData?.username || walletId
        : userData?.username || walletId;

    const isAnon =
        (!_user?.id && !selectedUser?.userId) ||
        (selectedUser?.userData &&
            selectedUser?.userData?.username ===
                selectedUser?.userData?.walletId);

    const perfScore = activeVrm?.score?.perfScore;

    function handleOpenAccountSettings() {
        amplitude_logAnalyticsEvent("account_settings_opened");
        showModal(<AccountDashboard defaultStep="connections" />);
    }

    function fallbackSrc(e) {
        e.target.srcset = "/images/opensea-black.png";
        e.onerror = null;
    }

    return (
        <Container>
            <div className="profile-container">
                <AvatarWrapper>
                    <Avatar
                        src={avatarUrl}
                        size="large"
                        style={{ border: "none" }}
                    />
                    <div className="details">
                        <h4>{isAnon ? "Guest" : username}</h4>
                        <span>
                            {isAnon ? "Make yourself at home" : walletId}
                        </span>
                    </div>
                </AvatarWrapper>
                <button
                    className="account-action"
                    type="button"
                    onClick={isAnon ? toggleAuth : handleOpenAccountSettings}
                >
                    {isAnon ? t`LOGIN` : t`EDIT`}
                </button>
            </div>

            <div className="avatars-container">
                <Vrm>
                    <div className="active-vrm" aria-label="Current avatar">
                        <div className="avatar">
                            {loading ? (
                                <AvatarLoading />
                            ) : (
                                <>
                                    <div className="verified">
                                        <IconImg
                                            mode="dark"
                                            size={14}
                                            name="white-circle-check"
                                        />
                                    </div>
                                    <LegacyCloudinaryNextImage
                                        src={
                                            activeVrm?.image ||
                                            "/images/opensea-black.png"
                                        }
                                        alt={activeVrm?.name}
                                        width={80}
                                        height={80}
                                        onError={fallbackSrc}
                                    />
                                </>
                            )}
                        </div>
                        <div className="vrm-info">
                            {loading || activeVrm?.isOwnedMetadataNotLoaded ? (
                                <Thumbnail>
                                    <div />
                                    <div />
                                    <div />
                                    <div />
                                </Thumbnail>
                            ) : (
                                <>
                                    <span className="title scrollbar-hidden">
                                        {activeVrm?.name}
                                    </span>
                                    <p
                                        className="scrollbar-hidden"
                                        style={{
                                            maxHeight: perfScore
                                                ? "30px"
                                                : "55px",
                                        }}
                                    >
                                        {activeVrm?.description ||
                                            "Ready to explore"}
                                    </p>
                                    {perfScore && (
                                        <span className="perf-score">
                                            {t`PERFORMANCE_SCORE`}:{" "}
                                            <b>{t(scoreMap[perfScore])}</b>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <h4 className="vrm-default-uploaded">Avatar size</h4>

                    <div style={{ marginBottom: "20px" }}>
                        <div className="slider">
                            <Slider
                                min={0}
                                max={1.0}
                                mode="dark"
                                step={SLIDER_STEP}
                                isLimitless={false}
                                value={
                                    // Round the displayed control only; the stored scale
                                    // changes only when the user adjusts it.
                                    Math.round(
                                        (typeof activeVrm?.scale === "number"
                                            ? activeVrm.scale
                                            : defaultScale) * 100
                                    ) / 100
                                }
                                onChange={(e) => {
                                    onScale(parseFloat(e.target.value || 0));
                                }}
                            />
                        </div>
                    </div>

                    {user?.id && (
                        <>
                            <h4 className="vrm-default-uploaded">{t`UPLOADED`}</h4>
                            <DropFileWrapper
                                iconOnly={uploadedVrms?.length > 0}
                            >
                                {allowUpload &&
                                    (loadingUpload ? (
                                        <Spinner
                                            borderWidth={3}
                                            width={60}
                                            height={60}
                                            className="drop-spinner"
                                        />
                                    ) : (
                                        <DropFile
                                            iconOnly={uploadedVrms?.length > 0}
                                            onFileSelect={onUploadVrm}
                                        />
                                    ))}
                                {uploadedVrms
                                    .slice(
                                        0,
                                        !showMore.uploaded
                                            ? CUSTOM_VRM_DISPLAY_ITEMS_COUNT
                                            : uploadedVrms.length
                                    )
                                    .map(({ id, image, name }) => (
                                        <Uploaded
                                            id={id}
                                            key={id}
                                            name={name}
                                            image={image}
                                            isActive={id === activeVrm?.id}
                                        />
                                    ))}
                            </DropFileWrapper>
                        </>
                    )}

                    {uploadedVrms?.length > CUSTOM_VRM_DISPLAY_ITEMS_COUNT && (
                        <RoundButton
                            className="expand"
                            isLight={true}
                            onClick={() =>
                                setShowMore((prevState) => ({
                                    ...prevState,
                                    uploaded: !prevState.uploaded,
                                }))
                            }
                            style={{
                                marginTop: "0px",
                                marginBottom: "10px",
                            }}
                        >
                            {!showMore.uploaded
                                ? t`SEE_ALL_MODELS`
                                : t`SEE_LESS_MODELS`}
                        </RoundButton>
                    )}

                    {(loadingOwned || ownedVrms?.length > 0) && (
                        <h4 className="vrm-default-title">{t`OWNED`}</h4>
                    )}

                    {loadingOwned ? (
                        <Spinner
                            borderWidth={3}
                            width={26}
                            height={26}
                            className="spinner-owned"
                        />
                    ) : (
                        ownedVrms?.length > 0 && (
                            <>
                                <div className="vrm-models scrollbar-hidden">
                                    {ownedVrms
                                        .slice(
                                            0,
                                            !showMore.owned
                                                ? CUSTOM_VRM_DISPLAY_ITEMS_COUNT +
                                                      1
                                                : ownedVrms.length
                                        )
                                        .map(({ image, id, name }) => (
                                            <AvatarChoice
                                                key={id}
                                                name={name}
                                                image={image}
                                                selected={id === activeVrm?.id}
                                                onSelect={() =>
                                                    onSelectVrm(id, "OWNED")
                                                }
                                            />
                                        ))}
                                </div>

                                {ownedVrms?.length >
                                    CUSTOM_VRM_DISPLAY_ITEMS_COUNT + 1 && (
                                    <RoundButton
                                        className="expand"
                                        isLight={true}
                                        onClick={() =>
                                            setShowMore((prevState) => ({
                                                ...prevState,
                                                owned: !prevState.owned,
                                            }))
                                        }
                                        style={{
                                            marginTop: "10px",
                                            marginBottom: "10px",
                                        }}
                                    >
                                        {!showMore.owned
                                            ? t`SEE_ALL_MODELS`
                                            : t`SEE_LESS_MODELS`}
                                    </RoundButton>
                                )}
                            </>
                        )
                    )}

                    <h4
                        className="vrm-default-title"
                        style={{ marginTop: "12px" }}
                    >{t`DEFAULT`}</h4>

                    <div className="vrm-models scrollbar-hidden">
                        {DEFAULT_VRMS.filter(({ hidden }) => !hidden)
                            .slice(
                                0,
                                !showMore.default
                                    ? DISPLAY_ITEMS_COUNT
                                    : DEFAULT_VRMS.length
                            )
                            .map(({ image, id, name }) => (
                                <AvatarChoice
                                    key={id}
                                    name={name}
                                    image={image}
                                    selected={id === activeVrm?.id}
                                    onSelect={() => onSelectVrm(id, "DEFAULT")}
                                />
                            ))}
                    </div>
                    {DEFAULT_VRMS?.length > DISPLAY_ITEMS_COUNT && (
                        <RoundButton
                            className="expand"
                            isLight={true}
                            onClick={() =>
                                setShowMore((prevState) => ({
                                    ...prevState,
                                    default: !prevState.default,
                                }))
                            }
                        >
                            {!showMore.default
                                ? t`SEE_ALL_MODELS`
                                : t`SEE_LESS_MODELS`}
                        </RoundButton>
                    )}
                </Vrm>
            </div>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    .spinner-owned {
        margin-bottom: 20px;
    }
    .slider {
        position: relative;
    }
    .slider .input {
        border: 1px solid var(--oc-line-strong, #ffffff24);
        border-radius: 12px;
        background: var(--oc-canvas, #101010);
        color: var(--oc-ink, #f3f3f1);
        text-align: center;
        height: 36px;
        width: 60px;
        flex-shrink: 0;
    }
    .drop-spinner {
        margin: 8px auto;
    }
    > .profile-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        margin-bottom: 20px;
        background: var(--oc-surface, #242424);
        border-radius: 12px;
    }
    .account-action {
        flex-shrink: 0;
        padding: 7px 10px;
        border: 1px solid var(--oc-line-strong, #ffffff24);
        border-radius: 8px;
        background: transparent;
        color: var(--oc-ink, #f3f3f1);
        font-size: 12px;
    }
    .account-action:hover {
        background: var(--oc-hover, #2c2c2c);
    }
    > .avatars-container {
        display: flex;
        flex-direction: column;
    }
`;

const AvatarWrapper = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
    .ds-avatar {
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
        min-height: 36px !important;
    }
    .details {
        min-width: 0;
    }
    h4 {
        margin: 0;
        font-size: 13px;
        line-height: 20px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .details > span {
        display: block;
        font-size: 11px;
        line-height: 16px;
        color: var(--oc-muted, #93938e);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const Vrm = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 0;
    .vrm-default-title,
    .vrm-default-uploaded {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        color: var(--oc-secondary, #c2c2bd);
    }
    .vrm-models {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin: 0 -5px 12px;
    }
    > .expand {
        width: 100%;
        min-height: 36px;
        height: auto;
        margin: 8px 0 16px;
        padding: 8px 12px;
        background: var(--oc-surface, #242424);
        border: 1px solid var(--oc-line, #ffffff12);
        border-radius: 12px;
        color: var(--oc-secondary, #c2c2bd);
        font-size: 12px;
        line-height: 18px;
    }
    > .expand:hover {
        background: var(--oc-hover, #2c2c2c);
    }
    .active-vrm {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 20px;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--oc-line, #ffffff12);
    }
    .active-vrm > .avatar {
        position: relative;
        width: 72px;
        height: 72px;
        flex-shrink: 0;
        border-radius: 12px;
        overflow: hidden;
        background: var(--oc-surface, #242424);
    }
    .active-vrm img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .verified {
        position: absolute;
        bottom: 5px;
        right: 5px;
        z-index: 1;
        width: 14px;
        height: 14px;
    }
    .vrm-info {
        min-width: 0;
    }
    .vrm-info > .title {
        display: block;
        font-size: 14px;
        line-height: 22px;
        font-weight: 500;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .vrm-info > p {
        margin: 3px 0;
        font-size: 11px;
        line-height: 16px;
        color: var(--oc-muted, #93938e);
        overflow: hidden;
    }
    .perf-score {
        display: block;
        font-size: 10px;
        line-height: 16px;
        color: var(--oc-muted, #93938e);
    }
    .perf-score b {
        font-weight: 400;
    }
`;

const Thumbnail = styled.div`
    width: 170px;
    > div {
        width: 90%;
        height: 8px;
        margin-bottom: 6px;
        border-radius: 4px;
        background: var(--oc-surface, #242424);
    }
    > div:first-child {
        height: 12px;
        width: 70%;
        margin-bottom: 10px;
    }
    > div:last-child {
        width: 45%;
    }
`;

const DropFileWrapper = styled.div<{ iconOnly?: boolean }>`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0 -5px 12px;
    ${({ iconOnly }) =>
        !iconOnly &&
        css`
            grid-template-columns: 1fr;
            margin: 0 0 12px;
        `}
`;

const AvatarLoading = styled.div`
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background: var(--oc-surface, #242424);
`;
