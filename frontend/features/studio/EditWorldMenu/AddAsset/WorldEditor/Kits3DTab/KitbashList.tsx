import styled from "styled-components";
import { useMemo } from "react";
import IconImg from "@ui/components/IconImg";

export function KitbashList({ kitsQuery, current, query = null, onKitClick }) {
    //
    const { kits, error, isLoading } = kitsQuery;

    // console.log("slData", kits, error, isLoading);

    const shownKits = useMemo(() => {
        //
        if (!query || !kits) return kits || [];

        return kits.filter((it) => {
            return it.name.includes(query);
        });
    }, [query, kits]);

    const handleApplyKit = async (kit) => {
        onKitClick(kit);
    };

    return (
        <Container className="scrollbar-hidden">
            {isLoading && <div>Loading...</div>}
            {error && <div>{error}</div>}
            <Content className="scrollbar-hidden">
                {shownKits.map((kit) => {
                    //
                    const id = kit.slug;

                    const isCurrent = current === id;

                    const name = kit.name || kit.slug;

                    return (
                        <div
                            key={id}
                            className={`kit-cell ${
                                isCurrent ? "selected" : ""
                            }`}
                            onClick={() => {
                                handleApplyKit(kit);
                            }}
                        >
                            <div className="kit-icon">
                                <IconImg name="folder-opaque" size={16} />
                            </div>
                            <div className="kit-name">{name}</div>
                        </div>
                    );
                })}
            </Content>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    height: 100%;
    color: #fff;
`;

const Content = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-column-gap: 12px;
    grid-row-gap: 12px;
    overflow-y: auto;
    min-height: 0;

    & > .kit-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;

        & > .kit-icon {
            width: 100%;
            height: 95px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #232222;
            border-radius: 8px;
        }

        &.selected,
        &:hover {
            & > .kit-icon {
                border: 2px solid #328dfd;
            }

            & > .kit-name {
                color: #fff;
            }
        }

        & > .kit-name {
            font-size: 11px;
            font-weight: 500;
            color: #a7a7a7;
            max-width: 100px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
`;
