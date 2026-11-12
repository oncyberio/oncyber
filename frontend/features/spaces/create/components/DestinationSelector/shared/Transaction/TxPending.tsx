import styled from "styled-components";
import {
    DARK_DIALOG_CONTENT,
    darkDialogColors,
    dialogCopy,
    dialogTitle,
} from "@components/Dialogs/styles";

import Icon from "@components/Icon";

export const TxPending = ({ transactionHash, image }) => {
    //

    const platform = transactionHash.startsWith("0x") ? "etherscan" : "tzkt";
    return (
        <Container {...DARK_DIALOG_CONTENT}>
            <h2>Processing transaction</h2>
            <div className="img-wrapper">
                <img src={image} />
            </div>
            <span style={{ textAlign: "center" }}>
                We're processing your transaction. This might take a few
                minutes.
            </span>

            <a
                target="_blank"
                href={`https://${
                    platform == "etherscan" ? "etherscan.com/tx/" : "tzkt.io/"
                }${transactionHash}`}
            >
                {`View on ${platform}`}
            </a>
        </Container>
    );
};

// Dark on every page: the shared dialog surface and its colours.
const Container = styled.div`
    ${darkDialogColors}
    ${dialogCopy}
    background: var(--bg-color);
    font-weight: 400;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;

    padding: 24px;

    width: 350px;

    & a {
        color: var(--title-color);
        font-weight: 600;
        text-decoration: underline;
    }

    h2 {
        ${dialogTitle}
    }

    & > .img-wrapper {
        position: relative;
        width: 100%;
        min-height: 200px;
        border-radius: 6px;
        overflow: hidden;
        flex: 1;

        & > img {
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
    }
`;
