import React, { useState } from "react";
import styled from "styled-components";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useVrm } from "@components/context/VrmContext";
import AvatarChoice from "./AvatarChoice";

export default function Uploaded({ id, name, image, isActive }) {
    const { onSelectVrm, onDelete, onEdit } = useVrm();
    const { t } = useCyberTranslation();
    const [isDropdownShowing, setDropdownShowing] = useState(false);
    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => setDropdownShowing(false),
    });
    return (
        <Container>
            <AvatarChoice
                name={name}
                image={image}
                selected={isActive}
                onSelect={() => onSelectVrm(id, "UPLOADED")}
            />
            <button
                className="avatar-options"
                type="button"
                aria-label={`Options for ${name}`}
                aria-expanded={isDropdownShowing}
                onClick={() => setDropdownShowing((state) => !state)}
                ref={(element) => addTogglerRef("parent", element)}
            >
                <span aria-hidden="true">···</span>
            </button>
            {isDropdownShowing && (
                <Dropdown
                    ref={(element) => {
                        clickRef.current = element;
                    }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setDropdownShowing(false);
                            onEdit(id);
                        }}
                    >{t`EDIT`}</button>
                    <button
                        type="button"
                        onClick={() => {
                            setDropdownShowing(false);
                            onDelete(id);
                        }}
                    >{t`DELETE`}</button>
                </Dropdown>
            )}
        </Container>
    );
}

const Container = styled.div`
    position: relative;
    min-width: 0;
    .avatar-options {
        position: absolute;
        top: 9px;
        right: 9px;
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid #ffffff18;
        border-radius: 8px;
        background: #191919e8;
        color: #f3f3f1;
        font-size: 20px;
        line-height: 1;
    }
`;

const Dropdown = styled.div`
    position: absolute;
    z-index: 2;
    top: 36px;
    right: 8px;
    display: flex;
    flex-direction: column;
    min-width: 90px;
    padding: 4px;
    border: 1px solid #ffffff24;
    border-radius: 12px;
    background: #242424;
    box-shadow: 0 8px 24px #00000040;
    button {
        min-height: 32px;
        padding: 6px 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #f3f3f1;
        text-align: left;
        white-space: nowrap;
        font-size: 12px;
    }
    button:hover {
        background: #2c2c2c;
    }
`;
