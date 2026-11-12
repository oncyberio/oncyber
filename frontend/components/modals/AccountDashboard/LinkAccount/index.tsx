import { FunctionComponent, useContext, useState } from "react";

import ProviderButtons from "../../SignupProvider/ProviderButtons";

import {
    ProviderButtonsReturnProps,
    ProviderButtonsWrapper,
} from "../../SignupProvider/ProviderButtonsWrapper";

import { UPDATE_USER_DATA, UserContext } from "@components/context/UserContext";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import AccountsAPI from "@api/accounts/_api";

import Providers from "./Providers";

import styled from "styled-components";

import IconImg from "@ui/components/IconImg";

import Wallet from "@ui/components/Icons/Wallet";

const LinkAccount = () => {
    const { userData, dispatch } = useContext(UserContext);

    const [isLinkOpen, setIsLinkOpen] = useState(false);

    async function handleConnect(connection, token, userData) {
        console.log("[ handleConnect ] data", userData);

        if (userData.linkedAccounts) {
            dispatch({
                type: UPDATE_USER_DATA,
                payload: {
                    ...userData,
                    linkedAccounts: userData?.linkedAccounts || [],
                },
            });
        }

        setIsLinkOpen(false);
    }

    return (
        <Container>
            <ProviderButtonsWrapper
                onError={(err) => {}}
                onConnect={handleConnect}
                skipRedirectToAccount
                isLink
            >
                <Providers />
            </ProviderButtonsWrapper>
        </Container>
    );
};

const Container = styled.div``;

export default LinkAccount;
