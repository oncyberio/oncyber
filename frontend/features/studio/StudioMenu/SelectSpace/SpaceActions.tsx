import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import {
    brandMenuPanel,
    brandMenuRow,
} from "@features/studio/styles/brandMenu";
import { collabActions, ownedActions, SpaceAction, SpaceTab } from "./utils";
import { tx } from "@components/context/I18nContext";

interface SpaceActionsProps {
    type: SpaceTab;
    blacklist?: SpaceAction[];
    handleAction: (action: SpaceAction) => unknown;
}

export function SpaceActions({
    type,
    blacklist = [],
    handleAction,
}: SpaceActionsProps) {
    //

    const caption = (
        <Caption>
            <IconImg
                name="more-horizontal"
                size={18}
                style={{
                    filter: "invert(0.6)",
                }}
            />
        </Caption>
    );

    const actions = type === "owned" ? ownedActions : collabActions;

    return (
        <CustomDropdown caption={caption}>
            {({ toggle }) => (
                <Dropdown>
                    {actions.map((action) => {
                        //
                        if (blacklist.includes(action.value)) return null;

                        return (
                            <button
                                type="button"
                                key={action.value}
                                className="cmd"
                                onClick={() => {
                                    toggle(false);
                                    handleAction(action.value);
                                }}
                            >
                                {tx(action.title)}
                            </button>
                        );
                    })}
                </Dropdown>
            )}
        </CustomDropdown>
    );
}

const Caption = styled.div`
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    &:hover {
        background: #ffffff14;
    }
    @media (max-width: 600px) {
        width: 40px;
        height: 40px;
    }
`;

const Dropdown = styled.div`
    ${brandMenuPanel}
    min-width: 168px;

    & > .cmd {
        ${brandMenuRow}
    }
`;
