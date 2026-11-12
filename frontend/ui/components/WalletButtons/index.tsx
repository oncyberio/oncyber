import { useMemo, useState } from "react";

import {
    MoreOptionsWrapper,
    NewStyledWalletProvider,
    StyledButtonGroup,
    StyledWalletProvider,
} from "./styles";

import { walletProviders } from "./walletProviders";

import { Provider } from "@dapp/connect";

import { useCyberTranslation } from "@components/context/I18nContext";

import IconImg from "../IconImg";

export type LoadingState = {
    [Key in Provider]?: boolean;
};

interface WalletProviderConfig {
    key: string;
    title: string;
    onlyEthereum: boolean;
    logo: string;
}

export interface WalletButtonsProps {
    filter?: (item: WalletProviderConfig) => boolean;
    shouldDisableButtons: boolean;
    isConnecting: LoadingState;
    onConnectClick: (p: Provider) => void;
    isDarkTheme: boolean;
}

export function WalletButtons({
    filter,
    shouldDisableButtons,
    isConnecting,
    onConnectClick,
    isDarkTheme,
}: WalletButtonsProps) {
    //
    const [isCollapsed, setCollapsed] = useState(true);

    const { t } = useCyberTranslation();

    let shownWallets = useMemo(() => {
        let wallets = walletProviders;

        if (filter != null) {
            wallets = wallets.filter(filter);
        }

        if (isCollapsed) {
            wallets = wallets.slice(0, 2);
        }

        return wallets;
    }, [walletProviders, isCollapsed, filter]);

    return (
        <div>
            {shownWallets.map(({ key, logo, title }) => {
                return (
                    <NewStyledWalletProvider
                        as="button"
                        type="button"
                        key={key}
                        disabled={shouldDisableButtons}
                        onClick={() => onConnectClick(key as Provider)}
                    >
                        <img src={logo} alt="" />
                        <span>
                            {isConnecting[key] ? t`LOADING` + "…" : title}
                        </span>
                    </NewStyledWalletProvider>
                );
            })}

            {
                isCollapsed ? (
                    <MoreOptionsWrapper
                        as="button"
                        type="button"
                        aria-expanded={false}
                        onClick={() => setCollapsed(false)}
                    >
                        {t`MORE_OPTIONS`}{" "}
                        <IconImg
                            mode={isDarkTheme ? "light" : "dark"}
                            style={{ marginTop: 2 }}
                            size={18}
                            name="chevron-down"
                        />{" "}
                    </MoreOptionsWrapper>
                ) : (
                    <MoreOptionsWrapper
                        as="button"
                        type="button"
                        aria-expanded={true}
                        onClick={() => setCollapsed(true)}
                    >
                        {t`LESS_OPTIONS`}{" "}
                        <IconImg
                            mode={isDarkTheme ? "light" : "dark"}
                            style={{ marginTop: 2 }}
                            size={18}
                            name="chevron-up"
                        />{" "}
                    </MoreOptionsWrapper>
                )
                // <StyledWalletProvider onClick={() => setCollapsed(true)}>
                //     <p>Show less...</p>
                // </StyledWalletProvider>
            }
        </div>
    );
}
