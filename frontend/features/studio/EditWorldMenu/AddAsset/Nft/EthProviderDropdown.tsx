import { useAssetsContext } from "@features/studio/EditWorldMenu/context/AssetsContext";
import { AssetRepository } from "@components/hooks/useAssets";
import { useEventCallback } from "@components/hooks/useEventCallback";
import IconImg from "@ui/components/IconImg";
import { SelectableDropdownMenu } from "@features/studio/components/SelectableDropdownMenu";
import { IconMenuCaption } from "../shared/IconMenuCaption";
import { useWalletContext } from "@features/studio/EditWorldMenu/context/WalletContext";
import { getAddrType } from "@utils/getAddrType";
import { NftSourceButton } from "./NftSourceButton";

export interface ProviderOpt {
    title: string;
    value: AssetRepository;
    disabled: boolean;
}

export const ethProviderOpts: Array<ProviderOpt> = [
    {
        title: "Eth (OS API)",
        disabled: false,
        value: "default",
    },
    {
        title: "Polygon (OS API)",
        disabled: false,
        value: "polygon",
    },
    {
        title: "POAP",
        disabled: false,
        value: "poap",
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
    {
        title: "Klaytn",
        disabled: false,
        value: "klaytn",
    },
];

const autographOpt: ProviderOpt = {
    title: "Autograph API",
    disabled: false,
    value: "autograph",
} as const;

const itemsWithAutograph = ethProviderOpts.concat(autographOpt);

const caption = (
    <IconMenuCaption>
        <IconImg
            name="ethereum"
            size={16}
            style={{ filter: "invert(1)", opacity: 0.5 }}
        />
    </IconMenuCaption>
);

export function EthProviderDropdown({ addTogglerRef, showLabel = false }) {
    //

    const { custodialWalletType, currentWalletId } = useWalletContext();

    const addrType = getAddrType(currentWalletId);

    const {
        currentUserStatus: currentActiveTab,
        currentRepo,
        setAssetsState,
    } = useAssetsContext();

    const handleChange = useEventCallback((repo: AssetRepository) => {
        //

        setAssetsState({ currentRepo: repo });
    }, []);

    const isCreatedTab = currentActiveTab === "created";

    const srcItems =
        !isCreatedTab && custodialWalletType === "autograph"
            ? itemsWithAutograph
            : ethProviderOpts;

    const displayItems = showLabel
        ? srcItems.map((item) => ({
              ...item,
              title: item.title
                  .replace(" (OS API)", "")
                  .replace(/^Eth$/, "Ethereum")
                  .replace("Autograph API", "Autograph"),
          }))
        : srcItems;

    if (currentActiveTab === "delegated" || addrType !== "ethereum") {
        return null;
    }

    return (
        <SelectableDropdownMenu
            caption={
                showLabel
                    ? ({ toggled }) => (
                          <NftSourceButton
                              label="Network"
                              value={
                                  displayItems.find(
                                      (item) => item.value === currentRepo
                                  )?.title || "Ethereum"
                              }
                              toggled={toggled}
                          />
                      )
                    : caption
            }
            items={displayItems}
            value={currentRepo}
            onChange={handleChange}
            addTogglerRef={addTogglerRef}
        />
    );
}
