// @ts-check
import React, { useState, useEffect, useCallback, useContext } from "react";
import useEmblaCarousel from "embla-carousel-react";
import styled from "styled-components";
import { UserContext } from "./context/UserContext";
import { useCyberTranslation } from "./context/I18nContext";
import { useEventCallback } from "./hooks/useEventCallback";

const slides = [
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
    {
        img: "https://firebasestorage.googleapis.com/v0/b/cyber-art-prod.appspot.com/o/profiles%2F0x76db02500f7631d57bc2dcdca9d4cf782b99e119%2Favatar?alt=media&token=84cf55b1-1b90-4778-a496-d1ccf25c32e4",
    },
];

const Thumb = ({ selected, onClick, imgSrc }) => (
    <div
        className={`embla__slide embla__slide--thumb ${
            selected ? "is-selected" : ""
        }`}
    >
        <button
            onClick={onClick}
            className="embla__slide__inner embla__slide__inner--thumb"
            type="button"
        >
            <img
                className="embla__slide__thumbnail"
                src={imgSrc}
                alt="A cool cat."
            />
        </button>
    </div>
);

const Slide = ({
    assets = [],
    setAvatar,
    loading,
    avatarId,
    className = "",
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const [thumbViewportRef, emblaApi] = useEmblaCarousel({
        dragFree: true,
        //loop: true,
        containScroll: "trimSnaps",
    });

    const { t } = useCyberTranslation();

    const avatars = assets.filter((item) => item?.image_preview_url !== null);

    useEffect(() => {
        if (!loading) {
            const index = assets.findIndex(
                (asset) =>
                    avatarId === `${asset?.contract_address}/${asset?.token_id}`
            );

            //if (emblaApi) emblaApi.scrollTo(index);

            setSelectedIndex(index);
        }
    }, [loading, assets.length, avatarId]);

    const onThumbClick = useEventCallback(
        (index) => {
            if (!emblaApi || !emblaApi.clickAllowed()) return;

            const asset = avatars[index];

            setSelectedIndex(index);

            setAvatar({
                img: asset?.image_preview_url,
                contract_address: asset?.contract_address,
                token_id: asset?.token_id,
            });
        },
        [emblaApi]
    );

    if (loading) return <></>;

    if (avatars.length == 0 && !loading) return <></>;

    return (
        <Container className={className}>
            <p style={{ marginTop: 0 }}>
                {t`CHOOSE_NFT_AVATAR`}{" "}
                {/* <span>(certain collections are verified)</span> */}
            </p>
            {/* <div className="embla">
                <div className="embla__viewport" ref={mainViewportRef}>
                    <div className="embla__container">
                        {avatars.map(
                            ({ image_preview_url, verified }, index) => (
                                <div className="embla__slide" key={index}>
                                    <div className="embla__slide__inner">
                                        <img
                                            className="embla__slide__img"
                                            src={image_preview_url}
                                            alt="A cool cat."
                                        ></img>
                                        {verified && (
                                            <img
                                                src="../images/icons/check-blue.png"
                                                className="badge"
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div> */}
            <div className="embla embla--thumb">
                <div className="embla__viewport" ref={thumbViewportRef}>
                    <div className="embla__container embla__container--thumb">
                        {/* <ImageUploader
                            style={{ width: 60, height: 60, borderRadius: 0 }}
                            heroImg={userData?.avatar || ""}
                            customStorageLink={`profiles/${user.id}/avatar`}
                            onUploadFinished={async (url) =>
                                setAvatar({ img: url })
                            }
                        /> */}
                        {avatars.map(({ image_preview_url }, index) => (
                            <Thumb
                                onClick={() => onThumbClick(index)}
                                selected={index === selectedIndex}
                                imgSrc={image_preview_url}
                                key={index}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Container>
    );
};

const Container = styled.div`
    width: 100%;

    .embla {
        position: relative;
        margin-top: 6px;
        /* max-width: 670px; */
        margin-left: auto;
        margin-right: auto;
    }

    .embla__viewport {
        overflow-x: auto;
        width: 100%;

        &::-webkit-scrollbar {
            display: none;
        }

        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }

    .embla__viewport.is-draggable {
        cursor: move;
        cursor: grab;
    }

    .embla__viewport.is-dragging {
        cursor: grabbing;
    }

    .embla__container {
        display: flex;
        user-select: none;
        -webkit-touch-callout: none;
        -khtml-user-select: none;
        -webkit-tap-highlight-color: transparent;
        margin-left: -10px;
    }

    .embla__slide {
        padding-left: 10px;
        min-width: 100%;
        position: relative;
    }

    .embla__slide__inner {
        position: relative;
        overflow: hidden;
        height: 70px;
    }

    .badge {
        position: absolute;
        bottom: 0;
        right: 40%;
        margin: 0 auto;

        max-width: 20px;
    }

    .embla__slide__img {
        position: absolute;
        display: block;
        top: 50%;
        left: 50%;
        width: auto;
        height: 70px;
        border-radius: 100px;
        /* min-width: 100%; */
        width: 70px;
        max-width: none;
        transform: translate(-50%, -50%);
        object-fit: cover;
    }

    .embla__container--thumb {
        cursor: default;
        margin-left: -8px;
    }

    .embla__slide--thumb {
        padding-left: 8px;
        min-width: 70px;
    }

    .embla__slide__inner--thumb {
        touch-action: manipulation;
        cursor: pointer;
        border: 0;
        outline: 0;
        margin: 0;
        padding: 0;
        height: 60px;
        width: 60px;
        background-color: transparent;
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: 8px;
    }

    .embla__slide__thumbnail {
        position: absolute;
        opacity: 0.4;
        top: 0;
        bottom: 0;
        left: -10000%;
        right: -10000%;
        margin: auto;
        min-width: 1000%;
        min-height: 1000%;
        max-width: none;
        transform: scale(0.1);
        transition: opacity 0.2s;
    }

    .embla__slide--thumb.is-selected .embla__slide__thumbnail {
        opacity: 1;
    }
`;

export default Slide;
