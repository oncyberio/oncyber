import styled from "styled-components";
import { Dispatch, useState } from "react";

// import QuickPinchZoom, { make3dTransformValue } from "react-quick-pinch-zoom-ssr";

// const QuickPinchZoom = dynamic(() => import('react-quick-pinch-zoom'), {ssr: false});
import Icon from "./Icon";
import { AssetStats } from "@uitypes/Asset";

interface ZoomerProps {
    imgSrc?: string;
    videoSrc?: string;
    title: string;
    zoomIn: boolean;
    setZoomIn: Dispatch<boolean>;
    isVideo: boolean;
    stats: AssetStats;
    setStats: Dispatch<AssetStats>;
    mime?: string;
}

function format(n: number) {
    if (n < 1000) {
        return String(n);
    } else if (n < 1_000_000) {
        let r = (n / 1_000).toFixed(1).replace(".0", "").replace(".", ",");
        return `${r} k`;
    } else {
        let r = (n / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",");
        return `${r} m`;
    }
}

const Zoomer: React.FC<ZoomerProps> = ({
    imgSrc,
    videoSrc,
    title,
    zoomIn,
    setZoomIn,
    isVideo,
    stats,
    mime,
}) => {
    // const imgRef = useRef(null);
    const [muted, setMuted] = useState(true);

    const dImgSrc = (imgSrc || "").replace("w_600,h_600", "w_1200,h_1200");
    const dVideoSrc = (videoSrc || "").replace("w_600,h_600", "w_1200,h_1200");
    const dHtmlSrc = mime == "text/html" && videoSrc;

    const { views, reactions } = stats || {};

    // const onUpdate = useCallback(({ x, y, scale }) => {
    //     const { current: img } = imgRef;

    //     if (img) {
    //         const value = make3dTransformValue({ x, y, scale });

    //         img.style.setProperty("transform", value);
    //     }
    // }, []);

    return (
        <Container>
            <Wrapper>
                <ImageWrapper
                    onClick={(e) => setZoomIn(!zoomIn)}
                    zoomIn={zoomIn}
                >
                    {isVideo ? (
                        <video
                            className="wrapper-media"
                            src={dVideoSrc}
                            playsInline
                            muted={muted}
                            autoPlay
                            loop
                        ></video>
                    ) : (
                        <img src={dImgSrc} alt={title} />
                    )}
                </ImageWrapper>
                {/* {stats && (
                    <Stats className="stats">
                        <div className="left img-invert">
                            <img
                                className="img-views"
                                src="images/icons/preview.svg"
                                alt="Views icon"
                            />
                            {" " + format(views)}
                        </div>
                        <div className="reactions">
                            <Reaction>
                                🔥
                                <span className="reaction-count">
                                    {format(reactions.fire)}
                                </span>
                            </Reaction>
                            <Reaction>
                                🎉
                                <span className="reaction-count">
                                    {format(reactions.party)}
                                </span>
                            </Reaction>
                            <Reaction>
                                👏
                                <span className="reaction-count">
                                    {format(reactions.clap)}
                                </span>
                            </Reaction>
                            <Reaction>
                                ❤️
                                <span className="reaction-count">
                                    {format(reactions.heart)}
                                </span>
                            </Reaction>
                        </div>

                        <div className="right">
                            {isVideo && (
                                <Mute
                                    className="img-invert"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMuted(!muted);
                                    }}
                                    id="mute"
                                >
                                    {muted ? (
                                        <Icon width={"20px"} name="volume-x" />
                                    ) : (
                                        <Icon width={"20px"} name="volume-2" />
                                    )}
                                </Mute>
                            )}
                        </div>
                    </Stats>
                )} */}
            </Wrapper>
            {/* <Screen
                className="img-invert"
                onClick={(e) => setZoomIn(!zoomIn)}
                id="mute"
            >
                {zoomIn ? (
                    <Icon width={"20px"} name="minimize-2" />
                ) : (
                    <Icon width={"20px"} name="maximize-2" />
                )}
            </Screen> */}
            {isVideo && (
                <Mute
                    className="img-invert"
                    onClick={(e) => {
                        e.stopPropagation();
                        setMuted(!muted);
                    }}
                    id="mute"
                >
                    {muted ? (
                        <Icon width={"20px"} name="volume-x" />
                    ) : (
                        <Icon width={"20px"} name="volume-2" />
                    )}
                </Mute>
            )}
        </Container>
    );
};

const Container = styled.div<{ zoomIn?: boolean }>`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: ${(props) => (props.zoomIn ? 0 : 0)}%;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    flex: 8;
    /* background: radial-gradient(
        circle,
        rgba(0, 0, 0, 0.6) 0%,
        rgba(222, 222, 222, 1) 26%,
        rgba(242, 239, 239, 1) 100%
    ); */

    .image-container {
        transition: 0.2s all ease;
        width: 100%;
        z-index: 100;
    }

    .img-invert img {
        filter: invert(1);
    }

    @media (max-width: 800px) {
        max-width: 100%;
        width: 100%;
        height: -moz-available; /* WebKit-based browsers will ignore this. */
        height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
        height: fill-available;
        flex: 6;
    }
`;

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
`;

const ImageWrapper = styled.div<{ zoomIn?: boolean }>`
    cursor: ${(props) => (props.zoomIn ? "zoom-out" : "zoom-in")};
    // width: 100%;
    // height: 100%;
    /* background: radial-gradient(
        circle,
        rgba(0, 0, 0, 0.6) 0%,
        rgba(222, 222, 222, 1) 26%,
        rgba(242, 239, 239, 1) 100%
    ); */

    flex: 0;

    /* video {
        max-width: 100%;
        max-height: 90vh;
        object-fit: scale-down;
        flex: 0;
        // box-shadow: 1em 1.5em 3em rgba(124,124,124, 0.7);
        // padding: 2.5%;
    } */
    width: 100%;
    height: 100%;
    margin: auto;

    img,
    video {
        width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    // @media (max-width: 800px) {
    //     width: 100%;
    //     height: calc(95vh - 154px);
    // }

    @media (max-width: 800px) {
        width: 100%;
        height: 100%;
        height: -moz-available; /* WebKit-based browsers will ignore this. */
        height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
        height: fill-available;
    }

    @media (orientation: landscape) and (hover: none) and (pointer: coarse) {
        padding: 2%;
    }
`;

const Stats = styled.div`
    flex: 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    color: white;
    width: 100%;
    height: 100%;
    min-width: 300px;

    font-size: 0.6rem;

    .img-views {
        width: 15px;
        height: 15px;
        vertical-align: middle;
    }

    .left {
        flex: 50px 0 0;
    }

    .right {
        flex: 50px 0 0;
    }
`;

const Reactions = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    margin: 0;
`;

const Reaction = styled.div`
    font-size: 1.2rem;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    padding: 6px;
    width: 40px;
    height: 40px;
    margin: 2px;
    display: flex;
    flex-direction: column;
    cursor: pointer;

    .reaction-count {
        text-align: center;
        font-size: 12px;
        color: #c4c4c4;
    }
`;

const Screen = styled.div`
    position: absolute;
    bottom: 15px;
    right: 20px;
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
`;

const Mute = styled.div`
    position: absolute;
    bottom: 15px;
    right: 70px;
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
`;

// const Mute = styled.div`
//     background: rgba(1, 1, 1, 0.3);
//     border-radius: 50%;
//     cursor: pointer;
//     display: flex;
//     align-items: center;
//     justify-content: center;
//     padding: 6px;
// `;

export default Zoomer;
