import { Container, WalletProviderButton } from "./styles";

import { WalletButtons } from "@ui/components/WalletButtons";

export default function WalletsForm({
    isDarkTheme,
    shouldDisableButtons,
    isConnecting,
    onConnectClick,
    setIsWalletLogin,
}) {
    return (
        <Container>
            <WalletButtons
                isDarkTheme={isDarkTheme}
                shouldDisableButtons={shouldDisableButtons}
                isConnecting={isConnecting}
                onConnectClick={async (key) => {
                    await onConnectClick(key);
                    setIsWalletLogin(false);
                }}
            />

            <WalletProviderButton
                style={{ marginTop: 24, cursor: "pointer" }}
                onClick={() => setIsWalletLogin(false)}
            >
                Cancel
            </WalletProviderButton>
        </Container>
    );
}
