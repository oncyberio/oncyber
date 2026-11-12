import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useRef, useState } from "react";
import { hasWorldPassword } from "@utils/worldPassword/publicGating";
import styled from "styled-components";
import { GatingCancelButton, GatingOkButton } from "./Buttons";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";
import { Input } from "../shared/Input";
import { Footer } from "../styles/Footer";
import { Form, FormError, FormLabel } from "../styles/Form";
import { Header } from "../styles/Header";
import { GatingUIProps } from "./types";
import { useGatingEditCancel } from "./useGatingEditCancel";
import { useFormHandler } from "../context/ActionsContext";
import {
    generateRandomPassword,
    validatePassword,
} from "@utils/rules/password";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { TextArea } from "../shared/TextArea";

export function SpaceGatingPassword({ initState, onClose }: GatingUIProps) {
    //
    const { gating, editGating } = useSpaceGatingEditor();

    // const cancelGatingEdit = useGatingEditCancel(
    //     "password",
    //     initState?.password
    // );

    // A saved password is kept on the server, hashed: it cannot be shown
    // here again. The field then starts empty and only a new one replaces
    // it. A world without one starts with a suggestion, as before.
    const [hasSavedPassword] = useState(
        () => !gating.password?.password && hasWorldPassword(gating)
    );

    const [password, setPassword] = useState(() => {
        //
        if (gating.password?.password) return gating.password.password;
        return hasSavedPassword ? "" : generateRandomPassword();
    });

    // Whether the next save carries `password`. Without it the server keeps
    // the password in force, so a message edit does not change it.
    const passwordToSave = useRef(!hasSavedPassword);

    const [message, setMessage] = useState(gating.password?.message || "");

    const [error, setError] = useState("");

    const handleSave = useDebouncedCallback((data) => {
        if ("password" in data) passwordToSave.current = false;
        editGating(
            {
                password: data,
            },
            "save"
        );
    }, 1000);

    const handleChangePassword = useEventCallback((e) => {
        //
        const value = e.target.value.trim();

        setPassword(value);

        const result = validatePassword(value);

        if (result.success === false) {
            setError(result.error);
        }

        setError("");

        // With a saved password, an empty field means "keep it".
        if (hasSavedPassword && !value) {
            passwordToSave.current = false;
            handleSave({ message });
            return;
        }

        passwordToSave.current = true;

        handleSave({
            password: value,
            message,
        });
    }, []);

    const handleChangeMessage = useEventCallback((e) => {
        //
        const value = e.target.value;

        setMessage(value);

        handleSave(
            passwordToSave.current
                ? { password, message: value }
                : { message: value }
        );
    }, []);

    return (
        <Container>
            <Header>Restrict access to visitors with a password</Header>

            <Form>
                <FormLabel>Password</FormLabel>
                <Input
                    maxLength={30}
                    placeholder={
                        hasSavedPassword
                            ? "Type a new password to replace it"
                            : ""
                    }
                    onChange={handleChangePassword}
                    value={password}
                    hasError={!!error}
                />
                {error ? <FormError>{error}</FormError> : null}
                {hasSavedPassword && !password ? (
                    <SavedNote>
                        This world has a password. It can’t be shown again.
                    </SavedNote>
                ) : null}
            </Form>
            <Form>
                <FormLabel>Message for users</FormLabel>
                <TextArea
                    style={{ height: "300px" }}
                    maxLength={300}
                    onChange={handleChangeMessage}
                    value={message}
                />
            </Form>
        </Container>
    );
}

const Container = styled.div``;

const SavedNote = styled.span`
    font-size: 13px;
    line-height: 20px;
    color: var(--studio-secondary);
`;
