import AnimatedModal from "../AnimatedModal";
import styled from "styled-components";
import { useContext, useEffect, useState } from "react";
import { actionTokens as action } from "@styles/tokens/action";

import Icon from "../../Icon";
import {
    transactionAction,
    transactionBody,
    transactionFooter,
    transactionHeader,
    transactionWindow,
} from "./styles";

const Confirming = ({
    isShowing,
    toggle,
    transactionHash,
    asset,
    // The default is for a purchase. Pass a heading for anything else, such
    // as an offer, so it is not described as buying.
    heading = "Finishing your purchase…",
}) => {
    const platform =
        transactionHash && transactionHash.startsWith("0x")
            ? "etherscan"
            : "tzkt";
    return (
        <AnimatedModal
            className="dialog-window"
            noShowClose={true}
            wide={true}
            isShowing={isShowing}
            toggle={toggle}
        >
            <Container>
                <Header>
                    {/* <img src="/images/party.gif" /> */}
                    <h2>{heading}</h2>
                </Header>
                <Row>
                    <img
                        src={
                            asset?.image_preview_url ||
                            asset?.image_url ||
                            asset?.image
                        }
                    />
                    <div>
                        {/* <h3>List price: {sellOrder}</h3> */}
                        Approve in your wallet if it asks. This might take a few
                        minutes.
                    </div>
                </Row>
                <Footer>
                    <a
                        target="_blank"
                        href={`https://${
                            platform == "etherscan"
                                ? "etherscan.com/tx/"
                                : "tzkt.io/"
                        }${transactionHash}`}
                    >
                        {transactionHash && `View on ${platform}`}
                    </a>
                    <Button>
                        <Icon name="loading" />
                        <p>Processing</p>
                    </Button>
                </Footer>
            </Container>
        </AnimatedModal>
    );
};

// The surface comes from the "dialog-window" class on the modal.
const Container = styled.div`
    ${transactionWindow}
`;

const Header = styled.div`
    ${transactionHeader}
`;

const Row = styled.div`
    ${transactionBody}

    img {
        width: 60%;
        max-height: 200px;
        object-fit: contain;
        margin: 8px auto 24px auto;
    }
`;

// A status, not an action: the outline button without hover or pointer.
const Button = styled.a`
    ${transactionAction}
    cursor: default;

    img {
        width: 18px !important;
        margin: 0;
    }

    p {
        margin: 0;
    }

    &:hover {
        color: ${action.outline.ink};
        background: transparent;
    }
`;

const Footer = styled.div`
    ${transactionFooter}
`;

export default Confirming;
