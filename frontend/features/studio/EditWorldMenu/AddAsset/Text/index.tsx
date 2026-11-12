//

import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { NButton } from "@features/studio/components/StudioButton";
import React, { useState } from "react";
import styled from "styled-components";
import { Button } from "@features/studio/styles/Button";
import { TextArea } from "@features/studio/styles/Input";

export function AddText({ onClose }) {
    //
    const [text, setText] = useState("");

    const { handleAddText } = useEditWorld();

    const handleAddTextClick = useEventCallback(async (e: React.MouseEvent) => {
        //
        if (text) {
            //
            const success = await handleAddText({
                text,
                keepPlaceholder: e.shiftKey,
                autoSelect: true,
            });

            if (success) {
                //
                setText("");
            }
        }
    }, []);

    return (
        <Container>
            <TextArea
                className="input"
                placeholder="Enter text here ..."
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                }}
            />
            <div className="button-bar">
                <Button onClick={onClose}>Cancel</Button>
                <Button primary={true} onClick={handleAddTextClick}>
                    Add text
                </Button>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 22px;

    & > .input {
        width: 280px;
        height: 158px;

        @media (max-width: 600px) {
            width: 100%;
            height: 200px;
        }
    }

    & > .button-bar {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;

        & > button {
            width: 80px;
        }
    }
`;
