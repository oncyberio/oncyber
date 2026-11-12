import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useState } from "react";
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

export function SpaceGatingRoomCapacity({ initState, onClose }: GatingUIProps) {
    //
    const { gating, editGating } = useSpaceGatingEditor();

    const cancelGatingEdit = useGatingEditCancel(
        "roomCapacity",
        initState?.roomCapacity
    );

    const [capacity, setCapacity] = useState(gating.roomCapacity || "");
    const [error, setError] = useState("");

    const handleSave = useDebouncedCallback((roomCapacity: number) => {
        editGating(
            {
                roomCapacity,
            },
            "save"
        );
    }, 1000);

    const handleChange = (e) => {
        //
        const value = e.target.value.trim();

        setCapacity(value);

        let roomCapacity = value === "" ? null : +value;

        if (roomCapacity === null || isFinite(roomCapacity)) {
            setError("");
            handleSave(roomCapacity);
        } else {
            setError("Invalid number");
        }
    };

    return (
        <Container>
            <Header>Set Max Number of Users allowed in space</Header>

            <Form>
                <FormLabel>Max. Number of Users</FormLabel>
                <Input
                    maxLength={30}
                    placeholder="No limit"
                    onChange={handleChange}
                    value={capacity}
                    hasError={!!error}
                />
                {error ? <FormError>{error}</FormError> : null}
            </Form>
        </Container>
    );
}

const Container = styled.div``;
