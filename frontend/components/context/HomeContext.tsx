import useModal from "@components/modals/useModal";

import { createContext, useContext, useState } from "react";

interface HomeContextState {
    toggleAuth: () => void;
    isAuthShowing: boolean;
    openedMenu: "" | "search" | "menu" | "filter";
    handleToggle: (type: any) => void;
    isFilter: boolean;
    handleFilterTab: any;
    filterTab: FilterType | "";
    hasBorder: boolean;
}

export const HomeContext = createContext<HomeContextState>(null);

interface HomeProviderProps {
    isFilter: boolean;
    children: React.ReactNode;
    hasBorder?: boolean;
}

type FilterType = "owner" | "collections" | "chains" | "room";

export default function HomeProvider({
    children,
    isFilter,
    hasBorder = true,
    ...props
}: HomeProviderProps) {
    const [openedMenu, toggleMenu] = useState<
        "" | "search" | "menu" | "filter"
    >("");

    const [filterTab, setFilterTab] = useState<FilterType | "">("");

    const { toggle: toggleAuth, isShowing: isAuthShowing } = useModal();

    function handleToggle(type) {
        setFilterTab("");
        toggleMenu((state) => (state === type ? "" : type));
    }

    function handleFilterTab(type) {
        setFilterTab((state) => (state === type ? "" : type));
    }

    const value = {
        toggleAuth,
        isAuthShowing,
        openedMenu,
        handleToggle,
        isFilter,
        filterTab,
        handleFilterTab,
        hasBorder,
    };

    return (
        <HomeContext.Provider value={value}>{children}</HomeContext.Provider>
    );
}

export function useHome() {
    const context = useContext(HomeContext);

    if (!context) {
        throw Error("useHome needs to be called within HomeContext.");
    }

    return context;
}
