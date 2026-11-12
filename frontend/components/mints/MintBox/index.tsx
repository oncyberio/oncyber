import { CSSProperties, useEffect, useState } from "react";
import moment from "moment";
import {
    Destination,
    Description,
    Countdown,
    BgWrapper,
    Uploaded,
    Details,
    Header,
    Float,
    Free,
    Dot,
} from "./styles";
import { getUser } from "@utils/saveToDb";
import { formatTime } from "@utils/format";
import { RoomParameters } from "@uitypes/roomParameters";
import { useRouter } from "next/router";
import { LegacyCloudinaryNextImage } from "@components/CloudinaryNextImage";

type DestinationBoxProps = {
    styles?: CSSProperties;
    destination: RoomParameters;
};

const DestinationBox = ({ destination, styles }: DestinationBoxProps) => {
    const { name, image, slug, price, thumbnail, params } = destination;

    const [loading, setLoading] = useState(false);

    const [owner, setOwner] = useState<any>({});

    const [countdown, setCountdown] = useState("");

    const router = useRouter();

    useEffect(() => {
        async function getUserInof() {
            setLoading(true);
            const data = await getUser(destination?.author?.id);

            if (data.success) {
                setOwner(data);
            }

            setLoading(false);
        }

        getUserInof();
    }, [destination]);

    useEffect(() => {
        handleCounterdown();
    }, [destination?.slug]);

    const handleCounterdown = () => {
        const now = moment.utc();
        const endDate = moment(parseInt(destination?.endTime) * 1000);
        const startDate = moment(parseInt(destination?.startTime) * 1000);

        if (now.isBefore(startDate)) {
            const startedIn = moment.duration(startDate.diff(now));
            const format = formatTime(startedIn);
            setCountdown(format);
        } else {
            const timeLeft = moment.duration(endDate.diff(now));
            const format = formatTime(timeLeft);
            setCountdown(format);
        }

        setTimeout(handleCounterdown, 1000);
    };

    return (
        <Destination
            onClick={() => {
                router.push(`/mints/${slug}`);
            }}
            style={styles}
        >
            <Float>
                {parseInt(price.toString()) !== 0 ? (
                    <Uploaded>
                        <span />
                        Paid
                    </Uploaded>
                ) : (
                    <Free>
                        <Dot />
                        Free to claim
                    </Free>
                )}
            </Float>

            <Countdown>
                <span>{countdown}</span>
            </Countdown>

            <BgWrapper>
                {destination?.animationHash ? (
                    <video
                        src={`https://cyber.mypinata.cloud/ipfs/${destination?.animationHash}`}
                        loop
                        autoPlay
                        muted
                        height={"380px"}
                        style={{
                            minWidth: "100%",
                            minHeight: "100%",
                            objectFit: "cover",
                        }}
                    ></video>
                ) : (
                    <LegacyCloudinaryNextImage
                        unoptimized
                        alt={name}
                        src={
                            image ||
                            thumbnail ||
                            "https://cyber.mypinata.cloud/ipfs/QmV4RGoKdKa49WmnZYp9psrtkJ24e1SRsQFEBhWfg1Vb8o?filename=thumbnail_yvbk53_auozqa_e3jxwt_lokvto.png"
                        }
                        layout="fill"
                        objectFit="cover"
                        quality={100}
                    />
                )}
            </BgWrapper>

            <Description>
                <Header
                    style={{
                        alignItems: "start",
                        textAlign: "left",
                    }}
                >
                    <h4>{name}</h4>
                    <span
                        onClick={() =>
                            window.open(`/@${owner?.username}`, "_blank")
                        }
                    >
                        Space By{" "}
                        {loading
                            ? "loading…"
                            : owner?.username ||
                              `${owner?.id?.slice(0, 6)}...${owner?.id?.slice(
                                  owner?.id?.length - 6,
                                  owner?.id?.length
                              )}`}
                    </span>
                </Header>
                <Details>
                    {params?.capacity ? (
                        <p>
                            <span>{params.capacity}</span>
                            frames
                        </p>
                    ) : null}
                </Details>
            </Description>
        </Destination>
    );
};

export default DestinationBox;
