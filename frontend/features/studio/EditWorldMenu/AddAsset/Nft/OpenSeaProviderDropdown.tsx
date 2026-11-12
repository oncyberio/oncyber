import { useAssetsContext } from "@features/studio/EditWorldMenu/context/AssetsContext";
import { AssetRepository } from "@components/hooks/useAssets";
import { useEventCallback } from "@components/hooks/useEventCallback";
import IconImg from "@ui/components/IconImg";
import { SelectableDropdownMenu } from "@features/studio/components/SelectableDropdownMenu";
import { IconMenuCaption } from "../shared/IconMenuCaption";
import { useWalletContext } from "@features/studio/EditWorldMenu/context/WalletContext";

type OpenSeaChains =
    | "ethereum"
    | "matic"
    | "klaytn"
    | "bsc"
    | "arbitrum"
    | "arbitrum_nova"
    | "avalanche"
    | "optimism"
    | "solana"
    | "base"
    | "zora";

export interface ProviderOpt {
    title: string;
    value: OpenSeaChains;
    disabled: boolean;
}

export const ethProviderOpts: Array<ProviderOpt> = [
    {
        title: "Eth (OS API)",
        disabled: false,
        value: "ethereum",
    },
    {
        title: "Polygon (OS API)",
        disabled: false,
        value: "matic",
    },
    {
        title: "Base (OS API)",
        disabled: false,
        value: "base",
    },
    {
        title: "Zora (OS API)",
        disabled: false,
        value: "zora",
    },
    {
        title: "BSC (OS API)",
        disabled: false,
        value: "bsc",
    },
    {
        title: "Arbitrum (OS API)",
        disabled: false,
        value: "arbitrum",
    },
    {
        title: "Avalanche (OS API)",
        disabled: false,
        value: "avalanche",
    },
    {
        title: "Optimism (OS API)",
        disabled: false,
        value: "optimism",
    },
    {
        title: "Arbitrum Nova (OS API)",
        disabled: false,
        value: "arbitrum_nova",
    },
    // {
    //     title: "Klaytn",
    //     disabled: false,
    //     value: "klaytn",
    // },
    {
        title: "Solana",
        disabled: false,
        value: "solana",
    },
];

const caption = (
    <IconMenuCaption>
        <IconImg
            name="ethereum"
            size={16}
            style={{ filter: "invert(1)", opacity: 0.5 }}
        />
    </IconMenuCaption>
);

export function OpenSeaProviderDropdown({
    addTogglerRef,
    value = "ethereum",
    onChange,
}) {
    //

    const srcItems = ethProviderOpts;

    return (
        <SelectableDropdownMenu
            caption={caption}
            items={srcItems}
            value={value}
            onChange={onChange}
            addTogglerRef={addTogglerRef}
        />
    );
}
