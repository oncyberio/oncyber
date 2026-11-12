import { LinkStatus } from "../shared/LinkStatus";

import { Form, FormError, FormLabel } from "../styles/Form";

import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useCustomLinkEditor } from "@features/studio/StudioMenu/context/useCustomLinkEditor";
import { Input } from "./Input";
import { ChangeEvent, useState } from "react";

export function CustomLinkEdit() {
    //
    const { exhibit, userRole } = useCurrentExhibit();

    const {
        customLink,
        customLinkStatus,
        customLinkError,
        copyLink,
        handleChange,
    } = useCustomLinkEditor();

    const staticText = customLink
        ? "https://oncyber.io"
        : "https://oncyber.io/spaces";

    return (
        <Form>
            <FormLabel>Your link </FormLabel>
            <Input
                readOnly={userRole !== "owner"}
                hasError={!!customLinkError}
                placeholder={exhibit.id}
                staticText={staticText}
                value={customLink || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    handleChange(e.target.value);
                }}
            >
                <LinkStatus
                    status={customLinkStatus}
                    link={customLink}
                    onCopy={() => copyLink()}
                />
            </Input>
            {customLinkError && exhibit?.info?.customLink ? (
                <FormError>{customLinkError}</FormError>
            ) : null}
        </Form>
    );
}
