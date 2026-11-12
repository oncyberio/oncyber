import { RoundButton } from "@components/DesignSystem/buttons";
import { noop } from "@utils/js";
import { ReactNode, useState } from "react";
import styled from "styled-components";
import UIInput, { InputProps as UIInputProps } from "@ui/components/Input";
import Spinner from "@ui/components/Spinner";
import IconImg from "@ui/components/IconImg";
import {
    DIALOG_COLOR_SCHEMES,
    DialogFooter,
    DialogMain,
} from "@components/Dialogs/styles";

import { Dialog } from "@components/Dialogs/Dialog";
import { useEventCallback } from "@components/hooks/useEventCallback";

function Status(status: string) {
    //

    if (status === "success") {
        return <IconImg name="check" style={{ filter: "invert(1)" }} />;
    }

    if (status === "loading") {
        return <Spinner width={24} />;
    }

    if (status === "error") {
        return <IconImg name="x-circle" style={{ filter: "invert(1)" }} />;
    }

    return null;
}

export function PasswordPrompt({
    message,
    error,
    isChecking,
    onSubmit,
    onCancel,
}) {
    //

    const [value, setValue] = useState("");

    const [loading, setLoading] = useState(false);

    const hasError = error != null && !isChecking;

    const handleEnterSpace = useEventCallback(async (value) => {
        if (loading) return;

        try {
            setLoading(true);

            await onSubmit(value);

            setLoading(false);
        } catch (err) {
            console.error(err);

            setLoading(false);
        }
    }, []);

    const inputStatus = Status(isChecking ? "loading" : error ? "error" : "");

    return (
        <Dialog
            style={{
                width: 400,
                padding: 24,
                zIndex: 1000,
            }}
            theme={DIALOG_COLOR_SCHEMES.dark}
            isModal={true}
            onHide={onCancel}
        >
            <DialogMain>
                <IconImg
                    name="lock"
                    size={24}
                    style={{ filter: "invert(1)" }}
                />
                <p className="content">{message}</p>
                <InputBlock>
                    <UIInput
                        type="password"
                        borderColor={hasError ? "#ff0000" : "transparent"}
                        icon={inputStatus != null}
                        iconPosition="right"
                        width="100%"
                        height="40px"
                        padding="7px 8px"
                        background="#27282c"
                        borderRadius={"6px"}
                        color="#C0C0C6"
                        value={value}
                        onChange={(e) => setValue(e.target.value.trim())}
                        onKeyDown={(e) => {
                            //
                            if (e.key === "Enter") {
                                handleEnterSpace(value);
                            }
                        }}
                    >
                        {inputStatus}
                    </UIInput>
                    {isChecking && <div className="info">Checking…</div>}
                    {!isChecking && error && (
                        <div className="error">{error}</div>
                    )}
                </InputBlock>

                <DialogFooter>
                    <RoundButton
                        className="btn secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                    >
                        Cancel
                    </RoundButton>
                    <RoundButton
                        className="btn primary"
                        onClick={(e) => {
                            //
                            e.stopPropagation();
                            handleEnterSpace(value);
                        }}
                    >
                        {loading ? "Loading…" : "Ok"}
                    </RoundButton>
                </DialogFooter>
            </DialogMain>
        </Dialog>
    );
}

const InputBlock = styled.div`
    width: 100%;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;

    & > .error {
        color: #ff0000;
    }

    & > .info {
        color: #c0c0c6;
    }
`;
