import { getEthersProvider } from "@dapp/connect";
import React, { Dispatch, forwardRef, useContext } from "react";
import styled from "styled-components";
import { Destination } from "@uitypes/destinations";
import MaintClaimTokens from "./MaintClaimTokens";
import SetupClaimPage from "./SetupClaimPage";
import { UserContext } from "@components/context/UserContext";
import ConnectWallet from "@ui/components/ConnectWallet";
import { noop } from "@utils/js";
import Modal from "@components/modals/Modal";

export interface MintProps {
    destination: Destination;
    onSuccess: () => unknown;
    onCancel: () => unknown;
}

const Mint = forwardRef<HTMLDivElement, MintProps>((props, ref) => {
    //

    const { walletConnection } = useContext(UserContext);

    if (!getEthersProvider(walletConnection)) {
        //
        return (
            <ConnectWallet
                open={true}
                onlyEthereum={true}
                toggle={noop}
                callbackAfterAuth={noop}
            />
        );
    }

    const { destination } = props;

    const Component =
        destination?.distributionType === "create_claim_page"
            ? SetupClaimPage
            : MaintClaimTokens;

    return (
        <Modal
            hasBackground
            isBackdrop={false}
            noShowClose={true}
            overlayStyle={{
                opacity: 0.5,
                background: "#070707",
            }}
            size="wide"
            style={{
                margin: "0",
                padding: "0",
                width: "565px",
                maxWidth: "90%",
                maxHeight: "90%",
                overflowY: "auto",
                overflowX: "hidden",
                borderRadius: "8px",
                background: "#fff",
            }}
            isShowing={true}
        >
            <Container ref={ref}>
                <Component {...props} />
            </Container>
        </Modal>
    );
});

const Container = styled.div`
    width: 100%;
    height: auto;
    overflow-y: auto;
    border-radius: 8px;
    background: #ffffff;
    padding: 10px 0px 0px 0px;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);
`;

export default Mint;
