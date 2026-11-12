import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import { collabActions, ownedActions, SpaceAction, SpaceTab } from "./utils";

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
                                key={action.value}
                                className="cmd"
                                onClick={() => {
                                    toggle(false);
                                    handleAction(action.value);
                                }}
                            >
                                {action.title}
                            </button>
                        );
                    })}
                </Dropdown>
            )}
        </CustomDropdown>
    );
}

const Caption = styled.div`
    background: #27282c;
    border-radius: 50%;
    padding: 2px;
    cursor: pointer;
`;

const Dropdown = styled.div`
    background: #1e1e1e;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);
    border-radius: 8px;
    padding: 12px;

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    & > .cmd {
        background: none;
        border: none;
        font-weight: 500;
        font-size: 14px;
        color: #ffffff;
        cursor: pointer;
    }
`;
