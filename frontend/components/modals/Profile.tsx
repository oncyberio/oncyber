import { useContext, useState, useEffect, useMemo, ChangeEvent } from "react";
import styled from "styled-components";
import { useRouter } from "next/router";
import { UPDATE_USER_DATA, UserContext } from "../context/UserContext";
import { updateUser } from "../../utils/saveToDb";
import AnimatedModal from "./AnimatedModal";
import { amplitude_logAnalyticsEvent } from "../../utils/analytics";

import Slide from "../Slide";
import { useAssets, UseAssetsData } from "../hooks/useAssets";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import {
    UPDATE_AVATAR,
    UPDATE_USERNAME,
} from "@components/_3DExhibit-v2/three/factory/player/constants";
import { validateUsername } from "@utils/rules/user";
import UIInput, { InputProps as UIInputProps } from "@ui/components/Input";

import { noop } from "@utils/js";
import { formatAvatar } from "@components/_3DExhibit-v2/utils/avatar";
import { NButton } from "@ui/components/NButton";
import IconImg from "@ui/components/IconImg";
import { Input } from "@components/forms/Input";
import { StyledWrapper } from "@ui/components/Input/styles";
import { baseTokens as base } from "@styles/tokens";
import { LinkStatus } from "@components/forms/LinkStatus";
import UploaderAvatar from "./Profile/UploaderAvatar";
import { useCyberTranslation } from "@components/context/I18nContext";
import { isEthereumAddress } from "@utils/getAddrType";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

const ITEMS_COUNT = 5;

const socials = [
    {
        name: "twitter",
        url: "https://twitter.com",
    },
    {
        name: "instagram",
        url: "https://instagram.com",
    },
];

const platforms = [
    {
        name: "superrare",
        startString: "0x",
        url: "https://superrare.co",
    },
    {
        name: "foundation",
        startString: "0x",
        url: "https://foundation.app",
    },
    {
        name: "rarible",
        startString: "0x",
        url: "https://rarible.com/user",
    },
    {
        name: "objkt",
        startString: "tz",
        url: "https://objkt.com/profile",
    },
    // {
    //   name: 'opensea',
    //   url: 'https://opensea.com'
    // },
];

const verified = [
    "0x79fcdef22feed20eddacbb2587640e45491b757f", // cyberkongz vx
    "0x7ea3cca10668b8346aec0bf1844a49e995527c8b", // mfers
    "0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b", // clonex
    "",
];

const formatVerifiedCollections = (assets) => {
    return (assets || []).sort((a, b) => {
        if (
            verified.includes(a.contract_address) &&
            !verified.includes(b.contract_address)
        ) {
            a.verified = true;
            return -1;
        }
        return 1;
    });
};

const sortAssets = (assets, current) => {
    // console.log("CURRENT");
    // console.log(current);
    // console.log(assets);
    return (assets || []).sort((a, b) =>
        a.image_preview_url == current.img ? -1 : 1
    );
};

const mergeAssetsReq = (
    req1: UseAssetsData,
    req2: UseAssetsData
): UseAssetsData => {
    if (req1 == null) return req2;
    if (req2 == null) return req1;

    const state: UseAssetsData["state"] =
        req1.state === "LoadingSuccess" || req2.state === "LoadingSuccess"
            ? "LoadingSuccess"
            : req1.state === "InitialLoading" || req2.state === "InitialLoading"
            ? "InitialLoading"
            : "LoadinError";

    let req: UseAssetsData = {
        state,
        loadMore: noop,
        data: {
            assets: [].concat(req1.data?.assets || [], req2.data?.assets || []),
        },
    };

    return req;
};

const InputWrapper = ({ children }) => {
    return <StyledInputWrapper>{children}</StyledInputWrapper>;
};

const Profile = ({ isShowing, toggle, handleSettings }) => {
    const { asPath } = useRouter();

    const { t } = useCyberTranslation();

    const { user, token, userData, dispatch } = useContext(UserContext);

    const world = useWorld();

    const [isShowMore, setShowMore] = useState(false);

    const [username, setUsername] = useState(userData?.username || "");

    const [usernameStatus, setUsernameStatus] = useState<any>("copy");

    const [usernameError, setUsernameError] = useState<any>();

    const [description, setDescription] = useState(userData?.description || "");

    const [avatar, setAvatar] = useState({
        img: userData?.avatar,
        contract_address: userData?.avatarContractAddress || "",
        token_id: userData?.avatarTokenId || "",
    });

    const [userLinks, setUserLinks] = useState(userData?.socials || {});

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    useEffect(() => {
        if (isShowing) {
            amplitude_logAnalyticsEvent("open_edit_profile", {
                source: asPath.includes("create")
                    ? "3dstudio_navbar"
                    : "profilepage_cta",
            });
        }
    }, [isShowing]);

    useEffect(() => {
        setUsername(userData?.username || "");
    }, [userData?.username]);

    useEffect(() => {
        setDescription(userData?.description || "");
    }, [userData?.description]);

    useEffect(() => {
        setUserLinks(userData?.socials || {});
    }, [userData?.socials]);

    useEffect(() => {
        setAvatar({
            img: userData?.avatar || "",
            contract_address: userData?.avatarContractAddress || "",
            token_id: userData?.avatarTokenId || "",
        });
    }, [userData?.avatar]);

    const isEth = isEthereumAddress(user.id);

    const ethAssetsReq = useAssets(user.id, "default", "owned", true);
    const polyAssetsReq = useAssets(user.id, "polygon", "owned", isEth);

    const assetsReq = useMemo(() => {
        const mergedReq = mergeAssetsReq(ethAssetsReq, polyAssetsReq);
        if (mergedReq?.data?.assets) {
            mergedReq.data.assets = sortAssets(
                // formatVerifiedCollections(
                mergedReq.data.assets,
                // )
                {
                    img: userData?.avatar,
                    verified: userData?.avatarVerified,
                }
            );
        }
        return mergedReq;
    }, [
        ethAssetsReq,
        polyAssetsReq,
        userData?.avatar,
        userData?.avatarVerified,
        mergeAssetsReq,
        sortAssets,
    ]);

    async function handleProfileChange() {
        if (!username) {
            setError(t`USERNAME_CANT_BE_EMPTY`);
            return;
        }

        const result = validateUsername(username);

        if (result.success === false) {
            setError(result.error);

            return;
        }

        setError("");
        setLoading(true);

        const usernameChanged = (userData?.username || "").trim() != username;

        const avatarChanged = userData.avatar !== avatar.img;

        let data;

        try {
            if (avatarChanged) {
                avatar.img = await formatAvatar(
                    { ...userData, avatar: avatar.img },
                    dispatch
                );
            }

            const payload: any = {
                description: description,
                socials: userLinks,
                avatar: avatar.img,
                avatarContractAddress: avatar.contract_address,
                avatarTokenId: avatar.token_id,
            };

            if (usernameChanged) {
                payload.username = username.trim();
            }

            data = await updateProfile(payload);
        } catch (err) {
            console.error(err);
        }

        if (!data?.success) {
            // Nothing was saved: the world (and so every other visitor) still
            // shows the saved name and picture.
            setError(data?.message || t`PROFILE_NOT_SAVED`);
            setLoading(false);
            return;
        }

        // Saved: only now show the change on the visitor's avatar, which also
        // sends it to the room.
        if (usernameChanged) {
            world?.current?.updatePlayer({
                type: UPDATE_USERNAME,
                payload: username.trim(),
            });
        }

        if (avatarChanged) {
            world?.current?.updatePlayer({
                type: UPDATE_AVATAR,
                payload: avatar.img,
            });
        }

        amplitude_logAnalyticsEvent("save_profile_edits", {
            edited: [], // no idea what's the best way to do this
        });

        setLoading(false);
        toggle();
    }

    const onSelectAvatar = useEventCallback((index) => {
        const asset = avatars[index];

        console.log("selected avatars", asset);

        setAvatar({
            img: asset?.image_preview_url,
            contract_address: asset?.contract_address,
            token_id: asset?.token_id,
        });
    }, []);

    const updateProfile = async (payload) => {
        const data = await updateUser(token, payload, user.id);

        if (data?.success) {
            dispatch({
                type: UPDATE_USER_DATA,
                payload,
            });
        }

        return data;
    };

    const handleUsernameChange = (value) => {
        if (value) {
            const result = validateUsername(value);

            if (result.success === false) {
                return;
            }
        }

        setUsername(value);
    };

    // The shared dark dialog surface (className="dialog-window").
    const isLight = false;

    const assets = assetsReq?.data?.assets ?? [];

    const avatars = assets.filter((item) => item?.image_preview_url !== null);

    const avatarId = `${avatar?.contract_address}/${avatar?.token_id}`;

    return (
        <AnimatedModal
            hasBackground
            toggle={toggle}
            isBackdrop
            isShowing={isShowing}
            size={"medium"}
            style={{
                ...(IS_MOBILE
                    ? {
                          borderRadius: "0",
                          minWidth: "100%",
                          minHeight: "var(--100-vh)",
                      }
                    : {
                          maxWidth: 500,
                          maxHeight: "calc(100vh - 100px)",
                      }),
            }}
            className="dialog-window"
            noShowClose={true}
            wide={true}
            // isHalfScreen={true}
        >
            <Container isLight={isLight}>
                <Header>
                    <div>
                        <IconImg
                            mode="light"
                            style={{ opacity: 0.5 }}
                            name="user"
                            size={22}
                        />

                        <div>
                            <h3>{t`EDIT_YOUR_PROFILE`}</h3>
                        </div>
                    </div>

                    <div
                        style={{ cursor: "pointer" }}
                        onClick={(e) => toggle()}
                    >
                        <IconImg mode="light" name={"x"} size={20} />
                    </div>
                </Header>

                <UploaderAvatar
                    currentAvatar={avatar.img}
                    onImageReady={async (url) => {
                        const resp = await updateProfile({
                            avatar: url,
                            avatarContractAddress: "0xnotanaddress",
                            avatarTokenId: 1,
                        });

                        if (resp.success) {
                            if (world?.current) {
                                let avatarImg = await formatAvatar(
                                    {
                                        avatar: url,
                                        avatarContractAddress: "0xnotanaddress",
                                        avatarTokenId: 1,
                                    },
                                    dispatch
                                );

                                if (world?.current) {
                                    world.current.updatePlayer({
                                        type: UPDATE_AVATAR,
                                        payload: avatarImg,
                                    });
                                }
                            }
                        }
                    }}
                />

                <Form className="scrollbar-hidden">
                    {assets?.length > 0 && (
                        <AvatarWrapper>
                            <div className="header">
                                <span>{t`CHOOSE_NFT_AVATAR`}</span>
                                <div
                                    className="show"
                                    onClick={() =>
                                        setShowMore((prevState) => !prevState)
                                    }
                                >
                                    <span>
                                        {isShowMore
                                            ? t`SHOW_LESS`
                                            : t`SHOW_MORE`}
                                    </span>
                                    <IconImg
                                        mode="light"
                                        name={
                                            !isShowMore
                                                ? "chevron-down"
                                                : "chevron-up"
                                        }
                                        size={15}
                                        style={{ marginLeft: 8 }}
                                    />
                                </div>
                            </div>

                            <div className="avatars">
                                {assetsReq?.state !== "LoadingSuccess" ? (
                                    <>
                                        <Thumbnail />
                                        <Thumbnail />
                                        <Thumbnail />
                                        <Thumbnail />
                                        <Thumbnail />
                                    </>
                                ) : (
                                    avatars
                                        .slice(
                                            0,
                                            isShowMore
                                                ? avatars.length
                                                : IS_MOBILE
                                                ? ITEMS_COUNT - 1
                                                : ITEMS_COUNT
                                        )
                                        .map(
                                            (
                                                {
                                                    image_preview_url,
                                                    contract_address,
                                                    token_id,
                                                    name,
                                                },
                                                index
                                            ) => {
                                                const id = `${contract_address}/${token_id}`;

                                                return (
                                                    <LegacyCloudinaryNextImage
                                                        key={index}
                                                        width={82}
                                                        height={82}
                                                        style={{
                                                            cursor: "pointer",
                                                            opacity:
                                                                id === avatarId
                                                                    ? "1"
                                                                    : "0.5",
                                                        }}
                                                        onClick={() =>
                                                            onSelectAvatar(
                                                                index
                                                            )
                                                        }
                                                        alt={name}
                                                        src={
                                                            image_preview_url ||
                                                            "/images/opensea-black.png"
                                                        }
                                                    />
                                                );
                                            }
                                        )
                                )}
                            </div>
                        </AvatarWrapper>
                    )}

                    <div>
                        {error ? (
                            <p style={{ color: "var(--danger-color)" }}>
                                {error}
                            </p>
                        ) : null}

                        <p>{t`USERNAME`}</p>
                        <Input
                            hasError={!!usernameError}
                            placeholder={user?.id?.slice?.(0, 12) + "..."}
                            staticText="oncyber.io/@"
                            value={username || ""}
                            maxLength={18}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const value = e.target.value
                                    .toLowerCase()
                                    .replaceAll("oncyber.io/@", "")
                                    .replace(/[^a-zA-Z0-9-_]+/, "");

                                // Disallow invalid URI characters (only A-Z a-z 0-9 - _ . ! ~ * ' ( ) are accepted)
                                // cf https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#description
                                if (encodeURIComponent(value) !== value) return;

                                handleUsernameChange(value);
                            }}
                            overrideTheme="dark"
                            borderColor={
                                usernameError
                                    ? "var(--danger-color)"
                                    : "var(--field-border-color)"
                            }
                            borderRadius="11px"
                            color="var(--title-color)"
                            background="var(--field-bg-color)"
                            staticTextStyle={{
                                background: "transparent",
                                color: "var(--content-color)",
                            }}
                        >
                            <LinkStatus
                                status={usernameStatus}
                                link={
                                    "https://oncyber.io/@" +
                                    (username || user?.id?.toLowerCase?.())
                                }
                                onCopy={() => {
                                    setUsernameStatus("success");
                                    setTimeout(() => {
                                        setUsernameStatus("copy");
                                    }, 2000);
                                }}
                            />
                        </Input>
                    </div>

                    <div>
                        <p>{t`SHORT_DESCRIPTION`}</p>
                        <UIInput
                            overrideTheme="dark"
                            borderColor="var(--field-border-color)"
                            borderRadius="11px"
                            color="var(--title-color)"
                            background="var(--field-bg-color)"
                            value={description}
                            onChange={(e) =>
                                e.target.value.length < 50 &&
                                setDescription(e.target.value)
                            }
                            type="text"
                            placeholder={t`SHORT_DESCRIPTION`}
                            data-cy="edit-profile-description"
                        />
                    </div>
                </Form>

                {/* <div className="categories-wrapper" style={{marginBottom: 0}}>
                        <div className="category">
                            <p>Social Media Handles</p>
                            <Flex>
                                {socials.map((social, index) => (
                                    <InputWrapper key={index}>
                                        <Icon
                                            name={social?.name}
                                            style={{
                                                margin: "10px",
                                                // filter: "invert(1)",
                                            }}
                                            fill="#fff"
                                        />
                                        <UIInput
                                            overrideTheme="light"
                                            placeholder={`${
                                                social.name && social.name
                                            } username`}
                                            onChange={(e) =>
                                                setUserLinks({
                                                    ...userLinks,
                                                    ...{
                                                        [social.name]: {
                                                            url: `${social.url}/${e.target.value}`,
                                                            handle: e.target
                                                                .value,
                                                        },
                                                    },
                                                })
                                            }
                                            value={
                                                userLinks
                                                    ? userLinks[social.name]
                                                          ?.handle
                                                    : userData?.socials?.[
                                                          social.name
                                                      ] || ""
                                            }
                                        />
                                    </InputWrapper>
                                ))}
                            </Flex>
                        </div>
                    </div> */}

                <Footer>
                    <NButton
                        size="small"
                        outline={true}
                        overrideTheme="dark"
                        style={{ marginRight: 8 }}
                        onClick={(e) => toggle()}
                        data-cy="edit-profile-save"
                    >
                        {t`CANCEL`}
                    </NButton>

                    <NButton
                        size="small"
                        overrideTheme="dark"
                        onClick={(e) => !loading && handleProfileChange()}
                        data-cy="edit-profile-save"
                    >
                        {loading ? t`LOADING` + "…" : t`SAVE`}
                    </NButton>
                </Footer>
            </Container>
        </AnimatedModal>
    );
};

export default Profile;

const AvatarWrapper = styled.div`
    display: flex;
    width: 100%;
    margin-top: 25px;
    flex-direction: column;

    & > .header {
        width: 100%;
        height: 40px;
        display: flex;
        align-items: center;
        flex-direction: row;
        justify-content: space-between;

        span {
            font-weight: 500;
            font-size: 14px;
            line-height: 24px;
            color: var(--content-color);
            cursor: pointer;
        }
    }

    .show {
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }

    & > .avatars {
        display: flex;
        gap: 16px 0px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
    }
`;

const Container = styled.div<{
    isLight: boolean;
}>`
    padding: 8px 16px 8px 16px;
    background: ${({ isLight }) => (isLight ? "#fff" : "transparent")};
    color: ${({ isLight }) => (isLight ? "#000" : "var(--title-color)")};
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
`;

const Flex = styled.div`
    display: flex;
`;

const Form = styled.div`
    margin: 0 0;
    width: 100%;
    text-align: left;
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 330px;

    & > img {
        padding: 1px;
        border-radius: 100%;
    }

    & > div {
        margin: 16px 0;

        p {
            margin: 8px 0 4px 0;
            font-weight: 500;
            font-size: 14px;
            line-height: 24px;

            color: var(--content-color);
        }

        p span {
            font-size: 0.8em;
            opacity: 0.8;
        }
    }

    p {
        // margin: 16px 0 8px 0;
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 18px;
        color: var(--content-color);
    }

    /* Fields: the dialog inset, with a visible focus. */
    ${StyledWrapper}:focus-within {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: 1px;
    }
    ${StyledWrapper} svg path[stroke="#18191C"] {
        stroke: var(--content-color);
    }
    input::placeholder {
        color: ${base.color.muted};
    }

    @media (max-width: 800px) {
        p {
            font-size: 14px;
            margin: 8px 0 0 0;
        }
    }
`;

const Header = styled.div`
    padding: 8px 0;
    padding: 20px 0px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    width: 100%;

    display: flex;
    align-items: center;
    justify-content: space-between;
    align-items: flex-end;

    h3 {
        margin: 0;
        font-size: 20px;
        margin-left: 16px;
        font-weight: 500;
        color: var(--title-color);
        text-align: left;
    }

    h4 {
        margin: 0 8px 0px 0;
        font-weight: 500;
        font-size: 14px;
        text-align: right;
        opacity: 0.7;

        &:hover {
            opacity: 0.5;
        }
    }

    button {
        height: 35px;
        border-radius: 30px;
        font-size: 13px;

        background: black;
        color: white;

        font-weight: 500;
        padding: 8px 0px;
    }

    img {
        width: 36px;
        filter: invert(1);
    }

    & > div {
        display: flex;
        align-items: center;
    }

    @media (max-width: 800px) {
        padding: 16px 20px;

        img {
            width: 32px;
        }

        grid-template-columns: 4fr 1fr;

        & > span {
            img {
                width: 14px;
            }
        }

        h3 {
            font-size: 18px;
            margin-left: 8px;
        }
    }
`;

const Footer = styled.div`
    padding: 24px 0 16px 0;
    margin-top: 16px;
    border-top: 1px solid var(--border-color);
    width: 100%;

    display: flex;
    align-items: flex-end;
    justify-content: space-between;

    h3 {
        margin: 0;
        font-size: 20px;
        // margin-left: 20px;
        font-weight: 500;
        text-align: left;
    }

    h4 {
        margin: 0 8px 0px 0;
        font-weight: 500;
        font-size: 14px;
        text-align: right;
        opacity: 0.9;
        padding: 0 4px;

        &:hover {
            opacity: 0.5;
        }
    }

    /* The buttons are NButton on the shared action spec. */

    img {
        width: 36px;
        filter: invert(1);
    }

    & > div {
        display: flex;
        align-items: center;
    }

    @media (max-width: 800px) {
        padding: 16px 0 8px 0;

        img {
            width: 32px;
        }

        grid-template-columns: 4fr 1fr;

        & > span {
            img {
                width: 14px;
            }
        }

        h3 {
            font-size: 16px;
            margin-left: 8px;
        }
    }
`;

const Thumbnail = styled.div`
    width: 82px;
    height: 82px;
    opacity: 0.7;
    animation: skeleton-loading 1s linear infinite alternate;

    @keyframes skeleton-loading {
        0% {
            background-color: ${base.color.line.subtle};
        }

        100% {
            background-color: ${base.color.line.strong};
        }
    }
`;

const StyledInputWrapper = styled.div`
    display: flex;
    margin: 0rem 0 0rem 0;
    width: 100%;
    position: relative;

    .checker {
        position: absolute;
        height: 20px;
        width: 20px;
        right: 10px;
        top: 6px;
    }
`;
