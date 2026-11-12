import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { Component } from "./Component";
import { useState } from "react";
import { LibrarySearch, LibraryGrid } from "../../shared/Library";
import { PanelEmptyState } from "../../shared/PanelContent";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";

export function ComponentsTab() {
    //
    const { destination } = useCurrentExhibit();

    const [query, setQuery] = useState("");
    const world = useWorld();

    const wrapper = world.current.getFutureWrapper();

    const options = wrapper.getFactoryOptions().scene;

    const availableOptions = Object.values(options).filter((it) => {
        if (it.type !== "@@Component") return false;
        const scope = it.factory.getScope();
        const available = destination.isFuture
            ? scope.space.future
            : scope.space.classic;
        return (
            available &&
            it.factory
                .getInfo()
                .title.toLowerCase()
                .includes(query.trim().toLowerCase())
        );
    });

    return (
        <div>
            <LibrarySearch
                value={query}
                onChange={setQuery}
                placeholder="Search world settings"
            />
            <LibraryGrid $columns={3} style={{ marginTop: 12 }}>
                {availableOptions.map((it, i) =>
                    it.type === "@@Component" ? (
                        <Component
                            key={i}
                            component={it.factory}
                            preset={it.preset}
                        />
                    ) : null
                )}
            </LibraryGrid>
            {!availableOptions.length && (
                <PanelEmptyState title="No matching settings" />
            )}
        </div>
    );
}
