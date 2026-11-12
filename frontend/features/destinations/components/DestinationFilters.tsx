import { useState } from "react";
import styled from "styled-components";
import { DESTINATION_FILTERS, DestinationFilters as Filters } from "../model";
import DestinationModal from "./DestinationModal";

export default function DestinationFilters({
    value,
    onApply,
    onClose,
}: {
    value: Filters;
    onApply: (value: Filters) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState(value);
    return (
        <DestinationModal title="Filter destinations" onClose={onClose}>
            <Form
                onSubmit={(event) => {
                    event.preventDefault();
                    onApply(draft);
                    onClose();
                }}
            >
                {DESTINATION_FILTERS.map((group) => (
                    <fieldset key={group.key}>
                        <legend>{group.title}</legend>
                        {group.items.map((item) => (
                            <label key={item.key}>
                                <input
                                    type="checkbox"
                                    checked={
                                        draft[group.key]?.includes(item.key) ||
                                        false
                                    }
                                    onChange={(event) => {
                                        setDraft((previous) => ({
                                            ...previous,
                                            [group.key]: event.target.checked
                                                ? [
                                                      ...(previous[group.key] ||
                                                          []),
                                                      item.key,
                                                  ]
                                                : (
                                                      previous[group.key] || []
                                                  ).filter(
                                                      (key) => key !== item.key
                                                  ),
                                        }));
                                    }}
                                />
                                {item.title}
                            </label>
                        ))}
                    </fieldset>
                ))}
                <footer>
                    <button type="button" onClick={() => setDraft({})}>
                        Reset filters
                    </button>
                    <button className="apply" type="submit">
                        Apply filters
                    </button>
                </footer>
            </Form>
        </DestinationModal>
    );
}
const Form = styled.form`
    fieldset {
        margin: 0 0 24px;
        padding: 0;
        border: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 16px;
    }
    legend {
        padding: 0;
        margin-bottom: 12px;
        font-weight: 500;
    }
    label {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 32px;
        cursor: pointer;
    }
    input {
        width: 16px;
        height: 16px;
        accent-color: #20201e;
    }
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
    }
    button {
        padding: 12px 16px;
        border: 1px solid #20201e22;
        border-radius: 12px;
        background: none;
        color: inherit;
        cursor: pointer;
    }
    .apply {
        background: #20201e;
        color: #fff;
    }
    @media (max-width: 440px) {
        fieldset {
            grid-template-columns: 1fr;
        }
    }
`;
