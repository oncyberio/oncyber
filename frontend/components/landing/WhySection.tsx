import React from "react";
import styled from "styled-components";

class WhySection extends React.Component<{ whyRef: React.Ref<HTMLElement> }> {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <Container id="why" ref={this.props.whyRef}>
                <SectionTitle> How it works</SectionTitle>
                <Row>
                    <ImageWrapper color="#60bc45">
                        <video
                            playsInline
                            src={"/images/metamask.mp4"}
                            loop
                            autoPlay
                            muted
                        ></video>
                        {/* <h1> We handpick developers</h1>
                <p> Screened and assessed</p>
                <p> Trained</p> */}
                    </ImageWrapper>
                    <InfoWrapper style={{ paddingLeft: 10 }}>
                        <div>
                            <h3>
                                Import your assets in 2 clicks with Metamask
                            </h3>
                            <Paragraph>
                                Connect your ethereum wallet in order to fetch
                                assets and place them in your space, all that in
                                under a minute & 2 clicks.{" "}
                            </Paragraph>
                        </div>
                    </InfoWrapper>
                </Row>
                <Row>
                    <InfoWrapper style={{ paddingRight: 10 }} float={"right"}>
                        <div>
                            <h3>Choose an experience to hold your NFTs</h3>
                            <Paragraph>
                                On top of the current experiences, we've
                                partnered up with the coolest artists in the
                                sphere to craft unique creative spaces.
                            </Paragraph>
                        </div>
                    </InfoWrapper>
                    <ImageWrapper color="#f58318">
                        <img src={"/images/beauty.png"} />
                        {/* <h1>They select cool projects</h1>
                    <p> Submit your project</p>
                    <p> Vetted devs vote</p> */}
                    </ImageWrapper>
                </Row>
                <Row>
                    <ImageWrapper color="#009fdd">
                        <video
                            src={"/images/final.mp4"}
                            loop
                            autoPlay
                            muted
                            controls
                            playsInline
                        ></video>
                        {/* <h1>We support</h1>
                    <p> Requirements gathering</p>
                    <p> Project deroulement</p>  */}
                    </ImageWrapper>
                    <InfoWrapper style={{ paddingLeft: 10 }}>
                        <div>
                            <h3>Share with anyone</h3>
                            <Paragraph>
                                Once you're happy with your space, share it with
                                anyone, free forever.
                            </Paragraph>
                        </div>
                    </InfoWrapper>
                </Row>
            </Container>
        );
    }
}

const Container = styled.section`
    color: white;
    // min-height: 100vh;
    scroll-snap-align: start;

    margin: 30px auto 30px auto;
    padding: 60px 0 100px 0;
    max-width: 87.5%;

    @media (max-width: 600px) {
        width: 100%;
        margin: 16px auto;
    }
`;

export const SectionHeader = styled.div`
    color: white;
    text-align: center;

    h2 {
        font-size: 40px;
    }
    margin-bottom: 36px;

    img {
        max-width: 100px;
    }

    // @media(max-width: 900px) {
    //     h2 {
    //         font-size: 32px;
    //     }
    // }

    @media (max-width: 600px) {
        h2 {
            font-size: 30px;
        }

        img {
            max-width: 80px;
        }
    }

    @media (max-width: 600px) {
        h2 {
            font-size: 24px;
        }

        img {
            width: 40px;
        }
    }
`;

const SectionTitle = styled.h1`
    font-size: 40px;
    margin: 0 0 32px 0;
    padding: 0 0 32px 0;
    color: white;
    display: flex;
    align-items: center;

    img {
        width: 60px;
        margin-right: 20px;
    }

    @media (max-width: 1400px) {
        font-size: 36px;
        margin: 0 0 16px 0;
        padding: 0 0 8px 0;
    }

    @media (max-width: 600px) {
        font-size: 24px;
        margin: 0 0 16px 0;
        padding: 0 0 8px 0;

        img {
            width: 40px;
            margin-right: 8px;
        }
    }
`;

const Row = styled.div`
    display: flex;
    justify-content: space-between;
    // height: 300px;
    padding: 24px 0px;
    margin: 0 auto;

    @media (max-width: 1100px) {
        padding: 20px 0;
    }

    @media (max-width: 600px) {
        display: flex;
        align-items: center;
    }
`;

const InfoWrapper = styled.div<{ float?: string }>`
    width: 50%;
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    font-size: 1.35em;
    padding-left: 48px;

    h3 {
        padding: 10px 0px;
        margin: 0;
        max-width: 15em;
    }

    p {
        display: inline-block;
    }

    & > div {
        display: flex;
        flex-direction: column;
        align-items: end;
    }

    @media (max-width: 1100px) {
        font-size: 1.2em;
    }

    @media (max-width: 700px) {
        font-size: 1em;

        h3 {
            padding: 5px 0;
        }
    }

    @media (max-width: 600px) {
        font-size: 0.85em;
        padding: 0;

        h3 {
            font-size: 16px;
            padding: 5px 0;
        }
    }
`;

const ImageWrapper = styled.div`
    height: 100%;
    width: 50%;
    color: white;
    overflow: hidden;
    box-shadow: rgb(0 0 0 / 50%) 0px 16px 30px;
    h1 {
        font-size: 36px;
    }
    video,
    img {
        width: 100%;
        overflow: hidden;
    }
`;

const Paragraph = styled.p`
    color: white;
    max-width: 20em;
`;

export default WhySection;
