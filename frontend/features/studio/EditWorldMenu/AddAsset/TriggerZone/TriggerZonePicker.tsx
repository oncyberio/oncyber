import React from "react";
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";
import { Card } from "../WorldEditor/Card";

export const SIT_ZONE_OPTION = {
    id: "SIT_ZONES",
    title: "Sit Zones",
    image: "/components/sit-zone-xl.png",
};
export function TriggerZonePicker({
    options,
    onAdd,
}: {
    options: Array<{ id: string; title: string; image: string }>;
    onAdd: (id: string, event: React.MouseEvent) => void;
}) {
    return (
        <Container>
            {options.map((item) => (
                <Card
                    key={item.id}
                    label={item.title}
                    image={item.image}
                    onClick={(event) => onAdd(item.id, event)}
                    width="100%"
                    cta={
                        <IconImg
                            className="icon"
                            name="plus"
                            size={20}
                            style={{ filter: "invert(1)" }}
                        />
                    }
                />
            ))}
        </Container>
    );
}
const Container = styled.div`
    color: #fff;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-column-gap: 12px;
    grid-row-gap: 16px;
    width: 100%;
`;
