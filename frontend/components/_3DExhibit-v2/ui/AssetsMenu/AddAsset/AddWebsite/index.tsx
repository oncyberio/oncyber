import { nodeEnv } from "@env";
import axios from "axios";
import styled from "styled-components";
import { database } from "@utils/firebase";
import { useAssetsContext } from "@components/context/AssetsContext";
import { useSnackbar } from "@components/Snackbar";
import { useAssetsMenuContext } from "../../context/useAssetsMenuContext";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "@components/context/UserContext";
import Input from "@ui/components/Input";
// import Link from "@ui/icons/Link";
import Search from "@ui/icons/Search";
import { DEFAULT_SNACKBAR_DURATION } from "@components/Snackbar/useSnackbar";
import useSWR from "swr";
import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import IframeContent from "./iframeContent";
import DownArea from "./downArea";
import ButtonArea from "./buttonsArea";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import IconImg from "@ui/components/IconImg";
import {
    onValue,
    query,
    ref,
    orderByKey,
    limitToLast,
    set,
    push,
} from "firebase/database";

export async function updatePreview(q: string): Promise<any> {
    q = q?.trim();
    let b = (await getDoc(q)) || null;
    if (b == null) throw "Error";
    return formatWebsiteAsset(b, q);
}

const getDoc = async (url) =>
    fetch(`${nodeEnv.PUBLIC_API}/api/proxy?url=${url}`)
        .then(function (response) {
            return response.json();
        })
        .then(function ({ html, blocked }) {
            if (blocked) return null;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            return doc;
        })
        .catch(function (err) {
            return null;
        });

async function formatWebsiteAsset(data, url) {
    if (data == null) return null;

    return {
        name: data?.querySelector("title")?.innerHTML || url || "Website Name",
        description: url || "Website",
        token_id: `${url}`,
        mime_type: "embed/html/website",
        image_preview_url:
            data?.head?.querySelector("[property~=image][content]")?.content ||
            "https://cyber.mypinata.cloud/ipfs/QmaKJaq9fgYAJ3XgqkHDh9w4WQvEhBcZ1kmJ2Xjnvq7gMn?filename=PNG_4_ptzniu.png",
        image_url:
            data?.head?.querySelector("[property~=image][content]")?.content ||
            "https://cyber.mypinata.cloud/ipfs/QmeiBuhgVbvtohKDdwzXRXkGcaCZkFjLrRGNUb4nVF8qzn?filename=websiteDefaultIcon_d0k2bo.png",
        animation_url: url,
        blockchain: null,
        scale: 0.5,
        size: 600,
        dimensions: [1980 / 3, 1080 / 3],
        type: "website",
    };
}

// TODO: make initial size independent from image url - 1980x1080
// TODO: artwork info bulle

export function AddWebsite() {
    const { user, exhibit, token } = useContext(UserContext);

    const { selectedMesh, databaseHandler } = useAssetsMenuContext();

    const { currentWalletId } = useAssetsContext();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const [query, setQuery] = useState("");

    const debouncedQuery = useDebouncedValue(query, 1000);

    const q = debouncedQuery?.trim();

    const world = useWorld();

    const { data, error } = useSWR(q, updatePreview);

    let content = <ButtonArea disabled={true} />;
    const handleAddWebsiteEmbed = async (
        item: any,
        name: string,
        keepPlaceholder = false
    ) => {
        closeSnackbar();

        try {
            if (name) item.name = name;
            amplitude_logAnalyticsEvent("hang_artwork", {
                user_id: user.id,
                token_id: item?.token_id,
                asset_type: item?.mime_type,
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                collab: exhibit?.editors?.length > 1,
            });

            const { data, rotation, position, envmap, version } =
                await world.current.edit({
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: selectedMesh.userData.id,
                    asset: item,
                    keepPlaceholder,
                });

            let assetId = data.id;

            const payload = {
                data: {
                    ...data,
                    addedBy: currentWalletId.toLocaleLowerCase(),
                },
                rotation,
                position,
                addedBy: currentWalletId.toLowerCase(),
            };

            let realtimeEvent = {
                type: "ADD_ARTWORK",
                payload,
                walletId: user.id,
                meshId: assetId,
                timestamp: new Date().getTime() + 1000 * 10,
            };

            push(ref(database, "/exhibits/" + exhibit.id), realtimeEvent);

            // database.ref("/exhibits/" + exhibit.id).push(realtimeEvent);

            let currentWallet = currentWalletId.toLowerCase();
            await databaseHandler({
                type: "ADD_ARTWORK",
                payload: {
                    data: {
                        ...data,
                        addedBy: currentWallet,
                    },
                    rotation,
                    position,
                    addedBy: currentWallet,
                },
            });

            openSnackbar(
                "Successfully added website frame",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "success"
            );
        } catch (err) {
            amplitude_logAnalyticsEvent("failed_hang_artwork", {
                user_id: user.id,
                asset_type: item?.mime_type,
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                websiteName: data?.name,
                websiteUrl: q,
            });

            console.error(err);
            openSnackbar(
                "Failed to add website frame",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "error"
            );
        }
    };

    if (error) {
        content = (
            <Preview>
                <PreviewTitle>{"Can't load this website"}</PreviewTitle>
                <ButtonArea disabled={true} />
            </Preview>
        );
    } else if (!data) {
        content =
            q == "" ? null : (
                <Preview>
                    <PreviewTitle>{"Loading…"}</PreviewTitle>
                    <ButtonArea disabled={true} />
                </Preview>
            );
    } else if (!(q.includes("https://") && q.includes("."))) {
        content =
            q == "" ? (
                <Preview>
                    <div
                        style={{
                            height: "30px",
                        }}
                    ></div>
                    <ButtonArea disabled={true} />
                </Preview>
            ) : (
                <Preview>
                    <PreviewTitle>
                        {"Please enter a valid website"}
                    </PreviewTitle>
                    <ButtonArea disabled={true} />
                </Preview>
            );
    } else {
        const onClick = (x) => {
            handleAddWebsiteEmbed(data, x);
        };
        content = (
            <Preview>
                <PreviewImgWrapper
                    style={{
                        height: "100%",
                    }}
                >
                    <IframeContent url={q} />
                </PreviewImgWrapper>
                <DownArea
                    click={onClick}
                    defaultName={data?.name || "Website Name"}
                />
            </Preview>
        );
    }

    return (
        <Container>
            <a
                style={{
                    fontStyle: "normal",
                    fontWeight: "500",
                    fontSize: "16px",
                    lineHeight: "100%",
                    color: "#777980",
                    marginBottom: "5px",
                }}
            >
                Add Website URL
            </a>
            <SearchWrapper
                style={{
                    marginBottom: "5px",
                }}
            >
                <Input
                    placeholder="Paste URL"
                    icon={true}
                    iconPosition="left"
                    background="#fff"
                    color="#000"
                    value={query}
                    style={{
                        fontWeight: "500",
                    }}
                    onChange={(e) => {
                        if (
                            !e.target.value.includes("https://") &&
                            !"https://".includes(e.target.value) &&
                            e.target.value != ""
                        ) {
                            setQuery("https://" + e.target.value);
                        } else {
                            setQuery(e.target.value);
                        }
                    }}
                >
                    <IconImg name="link" />
                </Input>
            </SearchWrapper>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "column",
                }}
            >
                <a
                    style={{
                        marginBottom: "5px",
                        color: "#8d8e8f",
                        fontSize: "15px",
                        flex: "1",
                    }}
                >
                    ⚠ Adding websites to a space can increase lag
                </a>
            </div>
            {content}
        </Container>
    );
}

const Container = styled.div``;

const Separator = styled.div`
    width: 100%;
    height: 1.3px;
    background: #f1f1f7;
    margin-bottom: 20px;
`;

const SearchWrapper = styled.div`
    display: flex;
    margin: 16px 0;
    input {
        width: 100%;
    }
`;

const PreviewResults = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px 12px;
    // justify-items: stretch;
    // align-items: stretch;
`;

const PreviewImgWrapper = styled.div`
    width: 100%;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
`;

const PreviewImg = styled.img`
    width: 100%;
    object-fit: cover;
    background: #d7d7d7;
    content-visibility: auto;
`;

const PreviewTitle = styled.p`
    color: #27282c;
    margin: 8px 0 0px 0;
    white-space: nowrap;
    overflow: hidden;
    width: 100%;
    text-overflow: ellipsis;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    max-width: 100%;
    font-style: normal;
    font-weight: 800;
    font-size: 14px;
    line-height: 105%;
`;

const Preview = styled.div`
    position: relative;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    justify-center: center;
    align-items: center;
`;
