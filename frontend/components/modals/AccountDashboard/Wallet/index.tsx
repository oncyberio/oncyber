import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import GamePurchasesService from "@api/gamePurchases/_api";
import { ActionButton } from "@styles/brand";
import { baseTokens as base } from "@styles/tokens";
import { findGame } from "@features/games/catalog";
import { formatPrice, TEST_FUNDS } from "@features/games/gamePurchases";

interface WalletState {
    mode: "off" | "test";
    cents: number;
}
interface Purchase {
    order: string;
    game: string;
    name: string;
    cents: number;
    at: number;
}

/**
 * The wallet, in the account dashboard: what the signed-in visitor can
 * spend in games and what they bought (docs/games/purchases.md). A game's
 * page links here; it shows no wallet of its own.
 */
export default function Wallet() {
    const [wallet, setWallet] = useState<WalletState | null>(null);
    const [purchases, setPurchases] = useState<Purchase[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [funding, setFunding] = useState(false);

    const load = useCallback(async () => {
        setFailed(false);
        try {
            const [held, history] = await Promise.all([
                GamePurchasesService.wallet({}),
                GamePurchasesService.history({}),
            ]);
            setWallet(held);
            setPurchases(history.purchases);
        } catch {
            setFailed(true);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);

    const addFunds = async () => {
        if (funding) return;
        setFunding(true);
        try {
            const { cents } = await GamePurchasesService.addTestFunds({});
            setWallet({ mode: "test", cents });
        } catch {
            setFailed(true);
        } finally {
            setFunding(false);
        }
    };

    if (failed)
        return (
            <Container>
                <p role="status">Couldn’t load your wallet.</p>
                <ActionButton onClick={() => void load()}>
                    Try again
                </ActionButton>
            </Container>
        );
    if (!wallet) return <Container aria-busy="true">Loading…</Container>;
    if (wallet.mode === "off")
        return (
            <Container>
                <p>Purchases aren’t available here yet.</p>
            </Container>
        );
    const test = wallet.mode === "test";
    return (
        <Container>
            <div>
                <p className="wallet-label">
                    {test ? "Test balance" : "Balance"}
                </p>
                <p className="wallet-balance">{formatPrice(wallet.cents)}</p>
                {test && <p>No real money is used.</p>}
            </div>
            {test && (
                <ActionButton
                    $variant="white"
                    disabled={funding || wallet.cents >= TEST_FUNDS.maxCents}
                    onClick={() => void addFunds()}
                >
                    {wallet.cents >= TEST_FUNDS.maxCents
                        ? "Test balance is full"
                        : `Add ${formatPrice(TEST_FUNDS.stepCents)} test funds`}
                </ActionButton>
            )}
            <section aria-labelledby="wallet-purchases">
                <h3 id="wallet-purchases">Purchases</h3>
                {!purchases?.length ? (
                    <p>Nothing bought yet.</p>
                ) : (
                    <ul>
                        {purchases.map((item) => (
                            <li key={item.order}>
                                <span>
                                    {item.name}
                                    <small>
                                        {findGame(item.game)?.title ??
                                            item.game}{" "}
                                        ·{" "}
                                        {new Date(item.at).toLocaleDateString()}
                                    </small>
                                </span>
                                <span className="wallet-price">
                                    {formatPrice(item.cents)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Container>
    );
}

// Inside the dashboard's dark dialog: its colour variables, the base type.
const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    width: 100%;
    max-height: 420px;
    overflow-y: auto;
    padding: 16px 0;
    color: var(--title-color);
    font: ${base.font.weight.regular} ${base.font.size.body}px / 1.5
        var(--oc-font, ${base.font.sans});
    text-align: left;
    p {
        margin: 0;
        color: var(--content-color);
    }
    .wallet-label {
        font-size: ${base.font.size.sm}px;
    }
    .wallet-balance {
        color: var(--title-color);
        font-size: 28px;
        font-weight: ${base.font.weight.medium};
        line-height: 1.2;
    }
    section {
        width: 100%;
    }
    h3 {
        margin: 0 0 4px;
        color: var(--title-color);
        font-size: ${base.font.size.body}px;
        font-weight: ${base.font.weight.medium};
    }
    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-top: 1px solid ${base.color.line.subtle};
    }
    small {
        display: block;
        color: ${base.color.muted};
        font-size: ${base.font.size.sm}px;
    }
    .wallet-price {
        flex-shrink: 0;
        font: ${base.font.size.sm}px / 1.5 ${base.font.mono};
    }
`;
