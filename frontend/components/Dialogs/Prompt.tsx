import { RoundButton } from "@components/DesignSystem/buttons";
import { noop } from "@utils/js";
import { ReactNode, useState } from "react";
import styled from "styled-components";
import UIInput, { InputProps as UIInputProps } from "@ui/components/Input";
import Spinner from "@ui/components/Spinner";
import IconImg from "@ui/components/IconImg";
import {
    dialogCopy,
    DialogFooter,
    DialogMain,
} from "@components/Dialogs/styles";
import { baseTokens as base } from "@styles/tokens/base";
import { getAlertIcon } from "./shared";

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

async function defSubmit(value: string) {
    //
}

export interface PromptProps {
    type: "text" | "password";
    message: ReactNode;
    icon?: ReactNode;
    onSubmit?: (value: string) => void | Promise<void>;
    onClose?: (value: string) => void;
}

export function Prompt({
    type = "text",
    icon = null,
    message,
    onSubmit = defSubmit,
    onClose = noop,
}: PromptProps) {
    //

    const [value, setValue] = useState("");

    const [isChecking, setIsChecking] = useState(false);

    const [error, setError] = useState(null);

    const hasError = error != null && !isChecking;

    const inputStatus = Status(isChecking ? "loading" : error ? "error" : "");

    const handleSubmit = async (value) => {
        //
        try {
            setIsChecking(true);

            await onSubmit(value);

            setError(null);

            setIsChecking(false);

            onClose(value);
            //
        } catch (err) {
            //
            console.error(err);

            setError(err.message);
        } finally {
            //
            setIsChecking(false);
        }
    };

    const handleCancel = () => {
        //
        onClose(null);
    };

    if (icon == null) {
        //
        icon =
            type === "password" ? (
                <IconImg
                    name="lock"
                    size={24}
                    style={{ filter: "invert(1)" }}
                />
            ) : null;
    }

    return (
        <DialogMain>
            {icon}
            <p className="content">{message}</p>
            <InputBlock>
                <UIInput
                    autoFocus={true}
                    type={type}
                    borderColor={
                        hasError
                            ? "var(--danger-color)"
                            : "var(--field-border-color)"
                    }
                    icon={inputStatus != null}
                    iconPosition="right"
                    width="100%"
                    height="40px"
                    padding="7px 12px"
                    background="var(--field-bg-color)"
                    borderRadius={"11px"}
                    color="var(--title-color)"
                    value={value}
                    onChange={(e) => setValue(e.target.value.trim())}
                    onKeyDown={(e) => {
                        //
                        if (e.key === "Enter") {
                            handleSubmit(value);
                        }
                    }}
                >
                    {inputStatus}
                </UIInput>
                {isChecking && <div className="info">Checking…</div>}
                {!isChecking && error && <div className="error">{error}</div>}
            </InputBlock>

            <DialogFooter>
                <RoundButton
                    className="btn secondary"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                    }}
                >
                    Cancel
                </RoundButton>
                <RoundButton
                    className="btn primary"
                    onClick={(e) => {
                        //
                        e.stopPropagation();
                        handleSubmit(value);
                    }}
                >
                    Ok
                </RoundButton>
            </DialogFooter>
        </DialogMain>
    );
}

const InputBlock = styled.div`
    width: 100%;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;

    /* The field: an inset with the control radius and a visible focus. */
    & > div:first-child {
        border-radius: ${base.radius.control}px;
    }

    &:focus-within > div:first-child {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: 1px;
    }

    & > .error,
    & > .info {
        ${dialogCopy}
        text-align: left;
    }

    & > .error {
        color: var(--danger-color);
    }
`;
