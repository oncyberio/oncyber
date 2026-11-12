import { WorldEditProvider, WorldEditScope } from "./context/WorldEditContext";
import { WalletProvider } from "./context/WalletContext";
import AssetsProvider from "./context/AssetsContext";
import { AddAsset } from "./AddAsset";
import { useState } from "react";
import { AddAsset_UploaderMode } from "./AddAsset/UploaderMode";
import { ToggleMapControls } from "./ToggleMapControls";
import { RoomsProvider } from "@features/spaces/create/components/DestinationSelector/useRooms";

export default function EditWorldMenu({
    scope = "studio",
}: {
    scope?: WorldEditScope;
}) {
    //
    const [hasStartedLoadingAssets, setStartLoadingAssets] = useState(false);

    return (
        <RoomsProvider context="world-builder">
            <WalletProvider>
                <AssetsProvider loadAssets={hasStartedLoadingAssets}>
                    <WorldEditProvider
                        scope={scope}
                        setStartLoadingAssets={setStartLoadingAssets}
                    >
                        <AddAsset />
                        <ToggleMapControls />
                    </WorldEditProvider>
                </AssetsProvider>
            </WalletProvider>
        </RoomsProvider>
    );
}
