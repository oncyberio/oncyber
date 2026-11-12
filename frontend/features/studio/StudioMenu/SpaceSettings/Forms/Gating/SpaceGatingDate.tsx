import { Experience } from "@uitypes/experience";
import { leftPad } from "@utils/js";
import { ChangeEvent, useMemo } from "react";
import styled from "styled-components";
import { GatingCancelButton, GatingOkButton } from "./Buttons";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";
import { Input } from "../shared/Input";
import { Footer } from "../styles/Footer";
import { Form, FormLabel } from "../styles/Form";
import { Header } from "../styles/Header";
import { GatingUIProps } from "./types";
import { useGatingEditCancel } from "./useGatingEditCancel";
import { useFormHandler } from "../context/ActionsContext";

type DateGating = Experience["gating"]["date"];

type DateGatingKeys = keyof DateGating;

function formatTimestamp(t: number) {
    //
    if (t == null) return "";

    const d = new Date(t);

    const YYYY = leftPad(d.getFullYear(), "0", 4);
    const MM = leftPad(d.getMonth() + 1, "0", 2);
    const DD = leftPad(d.getDate(), "0", 2);
    const hh = leftPad(d.getHours(), "0", 2);
    const mm = leftPad(d.getMinutes(), "0", 2);

    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}

export function SpaceGatingDate({ initState, onClose }: GatingUIProps) {
    //

    const { gating, editGating } = useSpaceGatingEditor();

    const cancelGatingEdit = useGatingEditCancel("date", initState?.date);

    const start = useMemo(() => {
        return formatTimestamp(gating?.date?.start);
    }, [gating?.date?.start]);

    const end = useMemo(() => {
        return formatTimestamp(gating?.date?.end);
    }, [gating?.date?.end]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        //
        const name = e.target.name as DateGatingKeys;

        if (e.target.validity.valid) {
            let value = e.target.value;

            let date = value === "" ? null : new Date(e.target.value).getTime();

            editGating(
                {
                    date: {
                        ...gating.date,
                        [name]: date,
                    },
                },
                "save"
            );
        }
    };

    return (
        <Container>
            <Header>Allow access before/after a specific date</Header>

            <Form>
                <FormLabel>Start date</FormLabel>
                <DateInput
                    type="datetime-local"
                    name="start"
                    defaultValue={start}
                    onChange={handleChange}
                />
                {/* <FormError className="error">Invalid date</FormError> */}
            </Form>

            <Form>
                <FormLabel>End date (optional)</FormLabel>
                <DateInput
                    type="datetime-local"
                    name="end"
                    defaultValue={end}
                    onChange={handleChange}
                />
                {/* <FormError className="error err">Invalid date</FormError> */}
            </Form>
        </Container>
    );
}

const Container = styled.div``;

const DateInput = styled(Input)`
    &:invalid {
        border-color: #fff;
    }

    ::-webkit-calendar-picker-indicator {
        filter: invert(1);
    }
`;
