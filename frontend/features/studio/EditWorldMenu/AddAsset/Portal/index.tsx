import { useContext, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { UserContext } from "@context/UserContext";

import useSWR from "swr";
import { useEditWorld } from "../../context/WorldEditContext";
import { OptionItem } from "@features/studio/types";
import {
    ExhibitStatus,
    SWRLike,
    fetchExhibits,
    filterExhibits,
    searchExhibits,
    hasText,
} from "./utils";
import { noExhibitsContent } from "./noExhibitsContent";
import { ExhibitList } from "./ExhibitList";
import { SearchInput } from "../shared/SearchInput";
import { SelectableDropdownMenu } from "@features/studio/components/SelectableDropdownMenu";
import { TextMenuCaption } from "../../../components/TextMenuCaption";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { PortalOpt } from "../shared/AssetTypes";
import { PanelEmptyState } from "../shared/PanelContent";

const swrOptions = {
    revalidateOnFocus: false,
    refreshInterval: 0,
};

export function AddPortal({ isElevator }) {
    //

    const { user } = useContext(UserContext);

    const [currentStatus, setCurrentStatus] = useState<ExhibitStatus>("owned");

    const [query, setQuery] = useState("");

    const [exhibitsQuery, setExhibitsQuery] = useState<SWRLike>({});

    const { addTogglerRef } = useEditWorld();

    const allExhibits = useSWR(
        ["exhibits/owned", user.id],
        () => fetchExhibits(user.id),
        swrOptions
    );

    const ownedExhibits = useMemo(() => {
        return filterExhibits(allExhibits, "owned");
    }, [allExhibits]);

    const collabExhibits = useMemo(() => {
        return filterExhibits(allExhibits, "collab");
    }, [allExhibits]);

    const executeSearch = useEventCallback(async () => {
        const searchResult = await searchExhibits(query);
        setExhibitsQuery(searchResult);
    }, []);

    useEffect(() => {
        if (currentStatus == "search" && query.length >= 2) {
            //
            setExhibitsQuery({ isLoading: true });

            const delayDebounceFn = setTimeout(() => {
                executeSearch();
            }, 2000);

            return () => clearTimeout(delayDebounceFn);
        }
    }, [query, currentStatus]);

    const hasCollabExhibits = !!collabExhibits.data?.length;

    const selectedExhibits =
        currentStatus == "search"
            ? exhibitsQuery
            : currentStatus === "collab"
            ? collabExhibits
            : ownedExhibits;

    const options: OptionItem<ExhibitStatus>[] = [
        {
            title: `Owned Spaces (${ownedExhibits?.data?.length || 0})`,
            value: "owned",
        },
    ];

    if (hasCollabExhibits) {
        options.push({
            title: `Collaborations (${collabExhibits?.data?.length})`,
            value: "collab",
        });
    }

    options.push({
        title: "Search All",
        value: "search",
    });

    const caption = options.find((it) => it.value === currentStatus).title;

    let content = noExhibitsContent({
        currentStatus,
        query,
        selectedExhibits,
    });

    if (content == null) {
        //
        let shownExhibits = selectedExhibits.data;

        if (currentStatus == "search") {
            //
            shownExhibits = shownExhibits.filter((exhibit) => {
                return exhibit.info?.headline;
            });
        } else if (query) {
            //
            shownExhibits = shownExhibits.filter((exhibit) => {
                return (
                    hasText(exhibit.info?.headline, query) ||
                    hasText(exhibit.info?.room, query) ||
                    hasText(exhibit.info?.customLink, query) ||
                    hasText(exhibit.info?.room, query)
                );
            });
        }

        content = shownExhibits.length ? (
            <ExhibitList isElevator={isElevator} exhibits={shownExhibits} />
        ) : (
            <PanelEmptyState title="No matching worlds" />
        );
    }

    return (
        <Container>
            <SearchInput
                placeholder="Search worlds or paste an oncyber link"
                value={query}
                onChange={setQuery}
            />
            <SelectableDropdownMenu
                caption={<TextMenuCaption>{caption}</TextMenuCaption>}
                items={options}
                value={currentStatus}
                onChange={setCurrentStatus}
                addTogglerRef={(el) => addTogglerRef(PortalOpt.value, el)}
            />

            {content}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;

    min-height: 100%;

    p {
        margin: 0;
        font-size: 12px;
        font-weight: 500;
        font-size: 12px;
        line-height: 18px;
        color: #777980;
    }

    @media (max-width: 600px) {
        height: 100%;
    }
`;
