import useFeed, { FeedHook } from "@components/hooks/useFeed";

import React, { useContext } from "react";

export const FeedContext = React.createContext<FeedHook>(null);

export default function FeedProvider({ children }) {
    const algolia = useFeed();

    const value = algolia;


    return (
        <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
    );
}

export function useFeedContext() {
    const context = useContext(FeedContext);

    if (context === undefined) {
        throw new Error("useFeedContext must be used within FeedProvider");
    }

    return context;
}
