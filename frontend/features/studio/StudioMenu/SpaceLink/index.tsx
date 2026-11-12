import { useEventCallback } from "@components/hooks/useEventCallback";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import IconImg from "@ui/components/IconImg";
import { classes } from "@utils/js";
import { ChangeEvent, useRef, useState } from "react";
import styled from "styled-components";
import { useStudioMenu } from "../context/StudioContext";
import { useCustomLinkEditor } from "../context/useCustomLinkEditor";
import { CustomLinkEdit } from "../SpaceSettings/Forms/shared/CustomLinkEdit";
import { LinkStatus } from "./LinkStatus";

export function SpaceLink() {
    //

    const { exhibit, userRole } = useStudioMenu();

    const canEditLink = userRole === "owner";

    const [isCopying, setCopying] = useState(false);

    const slug = exhibit.info.customLink;

    const editBtnRef = useRef(null);

    const link = slug
        ? `https://oncyber.io/${slug}`
        : `https://oncyber.io/spaces/${exhibit.id}`;

    const handleCopy = useEventCallback(() => {
        //

        //

        navigator.clipboard.writeText(link);

        setCopying(true);

        setTimeout(() => {
            setCopying(false);
        }, 2000);
        //
    }, []);

    const caption = (
        <Container>
            <span>{link}</span>

            <div className={classes({ cmds: true, noedit: !canEditLink })}>
                <LinkStatus
                    status={isCopying ? "success" : "copy"}
                    onCopy={handleCopy}
                />
                {canEditLink && (
                    <button ref={editBtnRef} className="edit-btn">
                        Edit
                    </button>
                )}
            </div>
        </Container>
    );

    return (
        <CustomDropdown caption={caption} toggleRef={editBtnRef}>
            {({ toggle }) => {
                //
                return (
                    <Dropdown>
                        <CustomLinkEdit />
                    </Dropdown>
                );
            }}
        </CustomDropdown>
    );
}

const Container = styled.div`
    width: 340px;
    height: 35px;
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    border-radius: 900px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding-left: 16px;

    input,
    button,
    span {
        border: none;
        background: none;
        margin: 0;
        padding: 0;
        outline: none;
    }

    input,
    span {
        font-weight: 500;
        font-size: 12px;
        line-height: 100%;
        color: #ffffff;
    }

    span {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    input {
        flex: 1;
        color: white;
    }

    & > .cmds {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        margin-left: auto;

        & > .edit-btn {
            font-size: 13px;
            cursor: pointer;
            width: 42px;
            height: 24px;
            background: #ffffff;
            border-radius: 900px;
            margin: 4px;
        }

        &.noedit {
            padding-right: 16px;
        }
    }
`;

const Dropdown = styled.div`
    background: #1e1e1e;
    padding: 24px;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);
    border-radius: 8px;
`;
