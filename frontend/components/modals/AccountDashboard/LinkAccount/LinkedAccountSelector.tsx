import { UserContext } from "@components/context/UserContext";
import Dropdown from "@ui/components/Dropdown";
import { useContext } from "react";

export default function LinkedAccountSelector({
    currentAccount,
    setCurrentAccount,
}) {
    const { linkedWallets } = useContext(UserContext);

    const items = linkedWallets.map((wallet) => ({
        title: wallet,
        value: wallet,
        disabled: false,
    }));

    if (linkedWallets.length <= 1) return null;

    return (
        <Dropdown
            style={{ border: "none", width: 120, fontSize: 14 }}
            items={items}
            value={currentAccount}
            onChange={(value) => setCurrentAccount(value)}
            overrideTheme="dark"
        />
    );
}
