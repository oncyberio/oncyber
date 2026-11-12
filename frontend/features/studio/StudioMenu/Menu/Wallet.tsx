import { useCyberTranslation } from "@components/context/I18nContext";
import { formatWalletAddress } from "@utils/format";
import { useState } from "react";
import styled from "styled-components";

export function Wallet({ wallet, onClick = null, className = "", style = {} }) {
    //
    const { t } = useCyberTranslation();

    const [isCopying, setCopying] = useState(false);

    const copyToClipboard = () => {
        //
        navigator.clipboard.writeText(wallet);

        setCopying(true);

        setTimeout(() => {
            setCopying(false);
        }, 1000);
    };

    return (
        <Container>
            <span className="sm" onClick={onClick ?? copyToClipboard}>
                {formatWalletAddress(wallet)}
            </span>
            <span className="sm copy" onClick={copyToClipboard}>
                {isCopying ? t`COPIED` : t`COPY`}
            </span>
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex-direction: row;
    cursor: pointer;

    & > .sm {
        font-weight: 500;
        font-size: 11px;
        line-height: 13px;
        color: #999999;


        transition: .1s;
        &:hover {
            color: #fff;
        }
    }

    & > .copy {
        margin-left: auto;
    }
`;
