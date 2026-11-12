import AnimatedModal from "../AnimatedModal";
import styled from "styled-components";
import { useContext, useEffect, useState } from "react";
import { outlineAction, whiteAction } from "@styles/brand";
import {
    transactionAction,
    transactionBody,
    transactionFooter,
    transactionHeader,
    transactionWindow,
} from "./styles";

const Confirm = ({ isShowing, toggle, artwork, isDest = false }) => {
    const proceed = (e) => {
        // if (isDest) {
        //     e.preventDefault();
        //     // create new show with new dest
        // }
    };

    return (
        <AnimatedModal
            className="dialog-window"
            noShowClose={true}
            // Its only close control is "Dismiss", inside the content.
            closeOnEscape
            wide={true}
            isShowing={isShowing}
            toggle={toggle}
        >
            <Container>
                <Header>
                    <img src="/images/party.gif" />
                    <h2>{artwork?.name} is now yours! </h2>
                </Header>
                <Row>
                    <img src={artwork?.image_url || artwork?.image} />
                    <div>
                        {/* <h3>List price: {sellOrder}</h3> */}
                        You GMI!
                        <br />
                        <br />
                        {isDest
                            ? "We hope you love the way your NFTs look in your new space; also, please don't ever hesitate to ask for help on our Discord."
                            : "If you'd like to hang it in your exhibition space on Cyber now, click the button below!"}
                    </div>
                </Row>
                <Footer>
                    <a onClick={toggle}>Dismiss</a>
                    <Button onClick={proceed} href="/studio">
                        {isDest ? "Set up Gallery!" : "Hang in the metaverse"}
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
        max-width: 60%;
        max-height: 200px;
        object-fit: contain;
        margin: 0 auto;
    }
`;

// The confirming action: solid white, as in the shared dialog.
const Button = styled.a`
    ${transactionAction}
    ${whiteAction}
    cursor: pointer;
`;

const Footer = styled.div`
    ${transactionFooter}
    gap: 8px;

    /* "Dismiss" is the other action: the shared outline. */
    & > a:first-child {
        ${transactionAction}
        ${outlineAction}
        flex: 0 0 auto;
        min-width: 100px;
    }
`;

export default Confirm;
