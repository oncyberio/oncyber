import Modal from "../../modals/Modal";
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";
import { tipsSlides } from "./Menu/D_Menu/InfoSection/Tips";
import { useCyberTranslation } from "@components/context/I18nContext";

const modalStyle = {
    maxWidth: "100vh",
    color: "#fff",
    zIndex: 10000,
    borderRadius: 16,
    height: "auto",
    maxHeight: "80vh",
    background: "rgba(0, 0, 0, 0.4)",
    backdropFilter: "blur(50px)",
    boxShadow:
        "0px 8px 6px 0px rgba(0, 0, 0, 0.05), 0px 1px 1px 0px rgba(255, 255, 255, 0.25) inset, 0px -1px 1px 0px rgba(255, 255, 255, 0.25) inset",
};

const closeStyle = {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255, 255, 255, 0.15)",
};

const HelpModal = ({ isShowing, toggle }) => {
    const { t } = useCyberTranslation();

    return (
        <Modal
            style={{
                ...modalStyle,
                // ...(width >= 800 && {
                //     width: "800px",
                // }),
            }}
            className="modal-shortcuts-modals"
            isBackdrop
            isShowing={isShowing}
            toggle={toggle}
            isCloseRight
            isFullscreen
            size=""
            iconCloseSize={"12px"}
            closeStyle={closeStyle}
            isClearBg
            overlayStyle={{
                zIndex: 1000,
            }}
        >
            <Container>
                <Header>
                    <h3>{t`TIPS_SHORTCUTS`}</h3>
                    <p>{t`TIPS_SHORTCUTS_DESCRIPTION`}</p>
                </Header>

                <Body>
                    <TipsContainer>
                        {tipsSlides.slice(0, 4).map((item, index) => {
                            return (
                                <TipWrapper key={index}>
                                    <TipImage>
                                        <div
                                            style={{
                                                width: 90,
                                            }}
                                            className="align-wrapper"
                                        >
                                            <IconImg
                                                size={item?.size || 64}
                                                mode="dark"
                                                name={item.image}
                                            />
                                        </div>
                                    </TipImage>
                                    <p>{t(item.content)}</p>
                                </TipWrapper>
                            );
                        })}
                    </TipsContainer>
                    <TipsContainer>
                        {tipsSlides.slice(4, 8).map((item, index) => {
                            return (
                                <TipWrapper key={index}>
                                    <TipImage className="keys">
                                        <div
                                            style={{
                                                width: 48,
                                            }}
                                            className="align-wrapper"
                                        >
                                            <IconImg
                                                size={item?.size || 48}
                                                mode="dark"
                                                name={item.image}
                                            />
                                        </div>
                                    </TipImage>
                                    <p>{t(item.content)}</p>
                                </TipWrapper>
                            );
                        })}
                    </TipsContainer>
                    <TipsContainer>
                        {tipsSlides.slice(8, 12).map((item, index) => {
                            return (
                                <TipWrapper key={index}>
                                    <TipImage className="keys">
                                        <div
                                            style={{
                                                width: 48,
                                            }}
                                            className="align-wrapper"
                                        >
                                            <IconImg
                                                size={item?.size || 48}
                                                mode="dark"
                                                name={item.image}
                                            />
                                        </div>
                                    </TipImage>
                                    <p>{t(item.content)}</p>
                                </TipWrapper>
                            );
                        })}
                    </TipsContainer>
                </Body>
            </Container>
        </Modal>
    );
};

const Container = styled.div`
    width: 100%;
    height: 100%;

    padding: 32px;

    @media (max-width: 850px) {
        & > div {
            width: 100%;
            padding: 0;
        }

        flex-direction: column;
    }
`;

const TipsContainer = styled.div``;

const TipWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 230px;
    height: 60px;

    @media (max-width: 811px) {
        width: 100%;
    }

    p {
        width: 100%;
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
        letter-spacing: -0.12px;
        white-space: pre-wrap;
        color: rgba(255, 255, 255, 0.6000000238418579);
    }
`;

const TipImage = styled.div`
    width: 60%;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    & > .align-wrapper {
        display: flex;
        justify-content: center;
    }

    @media (max-width: 811px) {
        width: auto;
    }
`;

const Header = styled.div`
    width: 100%;
    text-align: center;

    h3 {
        font-weight: 700;
        font-size: 24px;
        margin: 0;
        margin-bottom: 8px;
    }

    p {
        color: #ffffff;
        font-size: 13px;
        opacity: 0.6;
        margin: 0;
    }
`;

const Body = styled.div`
    margin-top: 32px;
    grid-gap: 24px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;

    @media (max-width: 811px) {
        grid-gap: 14px;
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 463px) {
        grid-template-columns: 1fr;
    }
`;

export default HelpModal;
