import { UserContext } from "@components/context/UserContext";
import Spinner from "@components/Spinner";
import { Username } from "@components/user/Username";
import IconImg from "@ui/components/IconImg";
import { RoomParameters } from "@uitypes/roomParameters";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";
import DestinationService from "@api/destinations/_api";
import { getAlgoliaSlug } from "@utils/saveToDb";
import { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import useSWR from "swr";
import { useCurrentRoom } from "../RoomContext";
import EmptyState from "@ui/components/EmptyState";

export interface DestinationPreviewProps {}

async function fetchTopSapces(userId: string, slug: string) {
    const provider = await AlgoliaProvider.getInstance(userId);

    const algSlug = getAlgoliaSlug(slug);

    return provider.search({
        search: "",
        filters: [[], [], [], [`room:${algSlug}`]],
    });
}

export function DestinationPreview() {
    // AlgoliaProvider.search({   filters: [ "room:{getAlgoliaSlug(slug)}" ] })
    const { user } = useContext(UserContext);

    const previewRef = useRef<HTMLElement>(null);

    const [previewLoaded, setPreviewLoaded] = useState(false);

    const [isFullPreview, setFullPreview] = useState(false);

    const [createdTopOfDest, setCreatedTopOfDest] = useState([]);

    const [relatedStatus, setRelatedStatus] = useState<
        "loading" | "loaded" | "error"
    >("loading");

    const iframeRef = useRef<HTMLIFrameElement>(null);

    const room = useCurrentRoom();

    const { image, thumbnail, name } = room;

    // const topSpacesData = useSWR(room.slug, (slug) =>
    //     fetchTopSapces(user?.id, slug)
    // );

    useEffect(() => {
        DestinationService.getSpacesCreatedTopOfDest({
            slug: room.slug,
        })
            .then((data) => {
                setCreatedTopOfDest(data);
                setRelatedStatus("loaded");
            })
            .catch((error) => {
                console.error(error);
                setRelatedStatus("error");
            });
    }, []);

    useEffect(() => {
        const onmessage = (e) => {
            if (e.data === "cyber-scene-loaded") {
                setPreviewLoaded(true);
            }
        };

        const onFSChange = () => {
            setFullPreview(
                previewRef.current != null &&
                    document.fullscreenElement === previewRef.current
            );
        };

        window.addEventListener("message", onmessage);

        document.addEventListener("fullscreenchange", onFSChange);

        return () => {
            window.removeEventListener("message", onmessage);
            document.removeEventListener("fullscreenchange", onFSChange);
        };
    }, []);

    const src =
        image ||
        thumbnail ||
        "https://cyber.mypinata.cloud/ipfs/QmV4RGoKdKa49WmnZYp9psrtkJ24e1SRsQFEBhWfg1Vb8o?filename=thumbnail_yvbk53_auozqa_e3jxwt_lokvto.png";

    let spacesContent = null;

    if (relatedStatus === "error" || (createdTopOfDest as any)?.error) {
        spacesContent = (
            <EmptyState
                role="alert"
                icon="globe"
                title="Couldn't fetch related spaces"
            />
        );
    } else if (relatedStatus === "loading") {
        spacesContent = <Spinner />;
    } else if (!createdTopOfDest?.length) {
        spacesContent = (
            <EmptyState
                icon="globe"
                title="No worlds use this destination yet."
            />
        );
    } else if (createdTopOfDest.length) {
        //
        spacesContent = createdTopOfDest.map((hit) => {
            //
            const src = hit.cHeroImg || hit.heroImg;

            return (
                <div className="space-info">
                    <img
                        decoding="async"
                        className="space-preview"
                        src={
                            src ||
                            "https://cyber.mypinata.cloud/ipfs/QmXo6bcnTeyvegCauERTQj5352f1JvMCHGguMhynXadkFb?filename=thumbnail_yvbk53_auozqa_e3jxwt.png"
                        }
                        alt={hit.headline}
                        title={hit.description || hit.headline}
                        onClick={() => {
                            window.open(
                                `${
                                    hit?.customLink
                                        ? `/${hit?.customLink}`
                                        : `/spaces/${hit?.id}`
                                }`
                            );
                        }}
                        onError={(e) => {
                            e.currentTarget.src =
                                "https://cyber.mypinata.cloud/ipfs/QmXo6bcnTeyvegCauERTQj5352f1JvMCHGguMhynXadkFb?filename=thumbnail_yvbk53_auozqa_e3jxwt.png";
                        }}
                    />
                    <div className="space-desc" title={hit.headline}>
                        {hit.headline || "Untitled"}
                    </div>
                    <Username id={hit.owner} className="space-owner" />
                </div>
            );
        });
    }

    return (
        <Container>
            <div className="preview">
                <div ref={previewRef as any} className={`iframe-preview`}>
                    {previewLoaded && (
                        <div
                            className="full-mode-toggle"
                            onClick={() => {
                                // setFullPreview((s) => !s);
                                if (document.fullscreenElement == null) {
                                    previewRef.current?.requestFullscreen();
                                } else {
                                    document.exitFullscreen();
                                }
                            }}
                        >
                            <IconImg
                                mode="light"
                                name={
                                    isFullPreview ? "minimize-2" : "maximize-2"
                                }
                            />
                        </div>
                    )}
                    <iframe
                        ref={iframeRef}
                        className="embed"
                        src={`/destinations/${room.slug}?embedp=true`}
                    />
                </div>

                {!previewLoaded && (
                    <div className="embed">
                        {/* <h1>Loading scene preview ...</h1> */}
                        <Spinner />
                    </div>
                )}
                {/* <img className="embed" src={src} /> */}
            </div>
            {spacesContent && (
                <>
                    <div className="worldCreatedTitle">
                        Spaces created on top of <strong>{name}</strong>
                    </div>
                    <div
                        className={
                            relatedStatus === "loaded" &&
                            createdTopOfDest?.length
                                ? "related-spaces"
                                : "related-spaces-status"
                        }
                    >
                        {spacesContent}
                    </div>
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    height: 100%;

    .worldCreatedTitle {
        font-size: 14px;
        margin-top: 6px;
    }

    strong {
        font-weight: 600;
    }

    & > .preview {
        position: relative;
        min-height: 404px;
        border-radius: 6px;
        overflow: hidden;
        flex: 1;

        & .full-mode-toggle {
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 100;
            cursor: pointer;
        }

        & .embed {
            background-color: #070707;
            color: #fff;
            border: none;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            object-fit: cover;
        }

        & > .iframe-preview {
            z-index: 99;
        }

        & > .iframe-preview.full {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            transition: 0.3s all ease;
        }
    }

    & .related-spaces {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-column-gap: 12px;
        grid-row-gap: 12px;

        & .space-info {
            display: flex;
            flex-direction: column;

            & .space-preview {
                height: 88px;
                width: 100%;
                border-radius: 6px;
                object-fit: cover;
                cursor: pointer;
            }

            & .space-desc {
                margin-top: 6px;
                font-weight: 400;
                font-size: 12px;
                color: var(--title-color);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            & .space-owner {
                font-family: "Aeonik";
                font-weight: 400;
                font-size: 12px;
                color: var(--content-color);
            }
        }

        @media (max-width: 600px) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
`;
