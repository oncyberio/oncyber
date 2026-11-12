import { useState } from "react";
import styled from "styled-components";
import { studioField, studioFocus } from "@features/studio/styles/primitives";
import { Field } from "@features/studio/styles/Field";
import RadioBox from "@features/studio/styles/RadioBox";
import { Label } from "@features/studio/styles/Label";
export function ModelAnimationsView({
    names,
    animations,
    avatarOptions,
    disabled = false,
    onChange,
}: {
    names: string[];
    animations: Record<string, boolean>;
    avatarOptions?: ReadonlyArray<{ name: string; label: string }>;
    disabled?: boolean;
    onChange: (animations: Record<string, boolean>) => unknown;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    async function change(next: Record<string, boolean>) {
        if (disabled || pending) return;
        setPending(true);
        setError("");
        try {
            await onChange(next);
        } catch {
            setError("Animation couldn't load. Try again.");
        } finally {
            setPending(false);
        }
    }
    return (
        <Field>
            <Label
                as="label"
                htmlFor={avatarOptions ? "avatar-animation" : undefined}
            >
                {avatarOptions ? "Animation" : "3D Animations"}
            </Label>
            {avatarOptions ? (
                <AnimationSelect
                    id="avatar-animation"
                    value={
                        Object.keys(animations).find(
                            (name) => animations[name]
                        ) || ""
                    }
                    disabled={disabled || pending}
                    aria-busy={pending}
                    onChange={(event) => {
                        const name = event.target.value;
                        change(name ? { [name]: true } : {});
                    }}
                >
                    <option value="">Off</option>
                    {avatarOptions.map((option) => (
                        <option key={option.name} value={option.name}>
                            {option.label}
                        </option>
                    ))}
                    {names
                        .filter((name) => !name.startsWith("avatar:"))
                        .map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                </AnimationSelect>
            ) : (
                <Animations aria-disabled={disabled || pending}>
                    <RadioBox
                        onClick={() => change({})}
                        item={{ value: "", title: "Off" }}
                        selected={!Object.values(animations).some(Boolean)}
                    />
                    {names.map((name) => (
                        <RadioBox
                            key={name}
                            onClick={() => {
                                const next = { ...animations };
                                if (next[name]) delete next[name];
                                else next[name] = true;
                                change(next);
                            }}
                            item={{
                                value: name,
                                title: names.length > 1 ? name : "ON",
                            }}
                            selected={animations[name]}
                        />
                    ))}
                </Animations>
            )}
            {pending && <Status role="status">Loading animation…</Status>}
            {error && <Status role="alert">{error}</Status>}
        </Field>
    );
}
const Animations = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    border-radius: 10px;
    margin-top: 8px;
    font-size: 12px;

    span {
        font-size: 13px;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const AnimationSelect = styled.select`
    ${studioField}
    ${studioFocus}
    width: 100%;
    color-scheme: dark;
`;
const Status = styled.p`
    margin: 8px 0 0;
    font-size: 12px;
    color: #a1a1a8;
    &[role="alert"] {
        color: #ffb4b4;
    }
`;
