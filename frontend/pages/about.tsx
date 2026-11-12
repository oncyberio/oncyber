import styled from "styled-components";
import { useEffect } from "react";
import WhySection from "../components/landing/WhySection";
import { amplitude_logAnalyticsEvent } from "../utils/analytics";

export default function About(props) {
    function launchTypeform() {
        var qs,
            js,
            q,
            s,
            d = document,
            gi = d.getElementById,
            ce = d.createElement,
            gt = d.getElementsByTagName,
            id = "typef_orm",
            b = "https://embed.typeform.com/";
        if (!gi.call(d, id)) {
            js = ce.call(d, "script");
            js.id = id;
            js.src = b + "embed.js";
            q = gt.call(d, "script")[0];
            q.parentNode.insertBefore(js, q);
        }
    }
    useEffect(() => {
        amplitude_logAnalyticsEvent("visit_about");
        launchTypeform();
    }, []);

    return (
        <Container {...props}>
            {/* <HomeNavigation /> */}
            <Container>
                <Bg>
                    <Headline>
                        <Copy>
                            <Title>
                                Give life to your digital collectibles
                            </Title>
                            <p>
                                The easiest way for artists and collectors to
                                show their NFTs in fully immersive experiences,
                                for free.
                            </p>
                            <PlayButton
                                onClick={() =>
                                    amplitude_logAnalyticsEvent(
                                        "create_button_clicked"
                                    )
                                }
                                href="/studio"
                            >
                                <p>Create a Space</p>
                            </PlayButton>
                        </Copy>
                    </Headline>
                </Bg>

                <Body>
                    <WhySection />
                    <TypeForm>
                        <div
                            className="typeform-widget"
                            data-url="https://form.typeform.com/to/Pos8hsKf?typeform-medium=embed-snippet"
                            style={{ width: "100%", height: "500px" }}
                        ></div>
                    </TypeForm>
                </Body>
            </Container>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    scroll-snap-type: y mandatory;
    padding-top: 100px;
`;

const Bg = styled.div`
    background: #fff;
`;

const TypeForm = styled.div`
    box-shadow: rgb(0 0 0 / 50%) 0px 16px 30px;
    margin: 32px 0;
`;

const Headline = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 0;
    overflow: hidden;
    // // max-width: 1440px;
    // margin: 0 auto;
    padding: 2% 5% 0 5%;
    color: black;

    scroll-snap-align: start;

    & > div {
        width: 100%;
        img {
            border-radius: 15px 0 0 15px;
            width: 100%;
            margin-bottom: -10px;

            @media (max-width: 1100px) {
                width: 110%;
            }

            @media (max-width: 900px) {
                display: none;
            }
        }
    }

    @media (max-width: 900px) {
        grid-template-columns: 9fr;
    }

    @media (max-width: 650px) {
        padding: 4% 8% 4% 8%;
        grid-template-columns: 9fr;
    }
`;

const Copy = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 555px;
    padding-right: 16px;
    text-align: center;

    & > p {
        margin: 16px 0;
        font-size: 24px;
        color: black;
        font-weight: 400;

        @media (max-width: 1400px) {
            font-size: 20px;
            margin: 8px 0;
        }

        @media (max-width: 800px) {
            font-size: 16px;
            margin: 8px 0;
        }
    }

    @media (max-width: 1200px) {
        padding: 0 16px 0 0;
    }

    @media (max-width: 900px) {
        padding: 0;
        justify-content: center;
        text-align: center;
        max-width: 400px;
        margin: 0 auto;
        align-items: center;
    }
`;

const Title = styled.h1`
    font-size: 60px;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    // font-weight: 900;

    img {
        width: 80px;
        margin-right: 20px;
    }

    // @media(max-width: 1400px) {
    font-size: 54px;
    // }

    @media (max-width: 800px) {
        font-size: 40px;
    }
`;

const PlayButton = styled.a`
    display: inline-block;
    background: ${(props) => (props.transparent ? "transparent" : "#00ffd4")};
    border: 1px solid ${(props) => (props.transparent ? "#fff" : "#00ffd4")};
    color: #000;
    border: 1px solid black;
    padding: 12px 32px;
    font-size: 18px;
    margin-top: 35px;
    text-align: center;
    border-radius: 35px;
    font-weight: 500;
    margin-bottom: 32px;
    transition: all 0.2s;
    margin-right: 16px;

    p {
        margin: 0px 0;
    }

    &:hover {
        background: ${(props) => (props.transparent ? "white" : "#147867")};
        cursor: pointer;
        transition: all 0.4s;
    }

    @media (max-width: 1200px) {
        padding: 16px 24px;
        font-size: 18px;
    }

    @media (max-width: 900px) {
        font-size: 16px;
        margin: 0 auto;
    }
`;

const Body = styled.div`
    background: #161616 !important;
    z-index: 200000;
    padding: 48px 8%;
    overflow: auto;
    min-height: 90vh;
    scroll-snap-align: start;
    color: white;

    & > h1 {
        padding: 48px 0 0 0;
    }

    @media (max-width: 1600px) {
        padding: 2% 5% 4% 5%;
    }

    @media (max-width: 900px) {
        padding: 16px 24px;

        & > h1 {
            padding-top: 32px;
            width: 100%;
            justify-content: center;
            flex-direction: column;

            img {
                width: 60px;
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
    }

    @media (max-width: 600px) {
        padding: 8px;

        & > h1 {
            padding-top: 32px;
            width: 100%;
            justify-content: center;
            flex-direction: column;

            img {
                width: 60px;
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
    }
`;
