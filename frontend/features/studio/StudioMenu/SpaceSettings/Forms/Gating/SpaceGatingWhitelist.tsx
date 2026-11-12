import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useState } from "react";
import styled from "styled-components";
import { GatingCancelButton, GatingOkButton } from "./Buttons";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";
import { Footer } from "../styles/Footer";
import { Form, FormError, FormLabel } from "../styles/Form";
import { Header, HeaderInfo } from "../styles/Header";
import { GatingUIProps } from "./types";
import { useGatingEditCancel } from "./useGatingEditCancel";
import { TextArea } from "../shared/TextArea";
import { useFormHandler } from "../context/ActionsContext";

export function SpaceGatingWhitelist({ initState, onClose }: GatingUIProps) {
    //
    const { gating, editGating } = useSpaceGatingEditor();

    const cancelGatingEdit = useGatingEditCancel(
        "whitelist",
        initState?.whitelist
    );

    const [whitelistText, setWhitelistText] = useState(
        gating.whitelist?.join("\n") || ""
    );
    const [error, setError] = useState("");

    const saveWhitelist = useDebouncedCallback((whitelist) => {
        editGating(
            {
                whitelist,
            },
            "save"
        );
    }, 1000);

    const handleChange = (e) => {
        //
        let value = (e.target.value as string).replace(/"|'/g, "");

        let addresses = value.split(/\s+|,/).map((it) => it.trim());

        setWhitelistText(addresses.join("\n"));

        let whitelist = addresses.filter((it) => it != "");

        if (whitelist.length === 0) {
            whitelist = null;
        }

        // if (whitelist !== null) {
        //     for (let i = 0; i < whitelist.length; i++) {
        //         const addr = whitelist[i];
        //         if (!isValidAddress(addr) || !isValidEns(addr)) {
        //             setError("Invalid address " + addr.slice(0, 10));
        //             return;
        //         }
        //     }
        // }

        // setError("");

        saveWhitelist(whitelist);
    };

    return (
        <Container>
            <HeaderInfo>Setup whitelist</HeaderInfo>

            <Form>
                <FormLabel>
                    Allow access only to these wallet addresses
                </FormLabel>
                <TextArea
                    style={{ height: "300px" }}
                    placeholder="rayan.eth, 0xC23...d724, etc..."
                    onChange={handleChange}
                    value={whitelistText}
                />
                {error ? <FormError>{error}</FormError> : null}
            </Form>
        </Container>
    );
}

const Container = styled.div``;
