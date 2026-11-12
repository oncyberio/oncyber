import { FormItem } from "./controls/shared/FormItem";
import { ColorPicker } from "./controls/ColorInput";
import { Folder } from "./controls/Folder";
import { Group } from "./controls/Group";
import { TextInput } from "./controls/TextInput";
import { NumberInput } from "./controls/NumberInput";
import { Combo } from "./controls/Select/Combo";
import { Tabbed } from "./controls/Select/Tabbed";
import { XYZInput } from "./controls/XYZInput";
import { ImageInput } from "./controls/ImageInput";
import { Button } from "./controls/Button";
import { useState } from "react";
import { Checkbox } from "./controls/Checkbox";
import { useInput } from "./useInput";
import { useAction, useActionList } from "./useAction";
import { numberFormat, colorFormat, xyzFormat } from "./formats";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Layout } from "./controls/Layout";
import { Card } from "./controls/Card";
import { Preset } from "./controls/Preset";
import { Toolbar } from "./controls/Toolbar";
import { Panel } from "./controls/Panel";

//
export function RenderObjectGui({ object }) {
    //
    return <RenderGui config={object.getGUI()} />;
}

export function RenderGui({ config }) {
    //
    if (config === null) return null;

    if (config.type === "group") {
        //
        return <RenderGroup config={config} standalone={true} />;
        //
    } else if (config.type === "folder") {
        //
        return <RenderFolder config={config} />;
        //
    } else if (config.type === "number") {
        //
        return <RenderNumberInput config={config} />;
        //
    } else if (config.type === "text") {
        //
        return <RenderTextInput config={config} />;
        //
    } else if (config.type === "xyz") {
        //
        return <RenderXYZInput config={config} />;
        //
    } else if (config.type === "select") {
        //
        return <RenderSelect config={config} />;
    } else if (config.type === "color") {
        //
        return <RenderColorInput config={config} />;
        //
    } else if (config.type === "image") {
        //
        return <RenderImageInput config={config} />;
        //
    } else if (config.type === "checkbox") {
        //
        return <RenderCheckbox config={config} />;
    } else if (config.type === "button") {
        //
        return <RenderButton config={config} />;
    } else if (config.type === "layout") {
        //
        return <RenderLayout config={config} />;
    } else if (config.type === "presets") {
        //
        return <RenderPresets config={config} />;
    } else if (config.type === "toolbar") {
        //
        return <RenderToolbar config={config} />;
    } else if (config.type === "panel") {
        //
        return <RenderPanel config={config} />;
    } else {
        //
        return (
            <span style={{ background: "red", color: "white" }}>
                unknown type {String(config.type)}
            </span>
        );
    }
}

function RenderButton({ config }) {
    //
    const { onAction: _onAction, ...rest } = config;

    const onAction = useAction({ label: config.label, onAction: _onAction });

    const props = { ...rest, onAction };

    return <Button {...props} />;
}

function RenderLayout({ config }) {
    //
    const { children, ...props } = config;

    return (
        <Layout {...props}>
            {children.map((config, i) => {
                //
                return <RenderGui key={i} config={config} />;
            })}
        </Layout>
    );
}

const formLayouts = {
    presets: "stacked",
    toolbar: "stacked",
    xyz: "stacked",
};

function RenderGroup({ config, standalone }) {
    //
    const { children } = config;

    const style = standalone
        ? { marginBottom: 16, ...config.style }
        : config.style;

    return (
        <Group style={style}>
            {Object.keys(children).map((key) => {
                //
                const config = children[key];

                if (typeof config?.visible == "function" && !config.visible()) {
                    //
                    return null;
                }

                const el =
                    config == null ? null : (
                        <RenderGui key={key} config={config} />
                    );

                if (
                    el == null ||
                    config.type === "group" ||
                    config.type === "folder" ||
                    config.type === "layout" ||
                    config.label === null
                ) {
                    //
                    return el;
                }

                let label = config.label || config.name;

                if (!label && config.type !== "button") {
                    //
                    label = key;
                } else if (config.type === "button" && !config.label) {
                    //
                    label = "";
                }

                let layout =
                    config.layout ?? formLayouts[config.type] ?? "inline";

                return (
                    <FormItem
                        key={key}
                        layout={layout}
                        label={label}
                        style={config.style}
                    >
                        {el}
                    </FormItem>
                );
            })}
        </Group>
    );
}

function RenderFolder({ config }) {
    //
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { name, label, onToggle } = config;

    const id = name || label;

    const handleToggle = useEventCallback(() => {
        //
        setIsCollapsed(!isCollapsed);

        onToggle?.(!isCollapsed);
    }, []);

    return (
        <Folder
            key={id}
            title={label}
            collapsed={isCollapsed}
            onToggle={handleToggle}
            style={{ marginBottom: 10 }}
        >
            <RenderGroup config={config} standalone={false} />
        </Folder>
    );
}

function RenderNumberInput({ config }) {
    //

    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        format: config.format || numberFormat,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <NumberInput {...props} />;
}

function RenderTextInput({ config }) {
    //

    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        format: config.format || numberFormat,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <TextInput {...props} />;
}

function RenderXYZInput({ config }) {
    //
    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        format: config.format || xyzFormat,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <XYZInput {...props} />;
}

function RenderSelect({ config }) {
    //
    const { value: source, items: _items, onChange, ...rest } = config;

    const items = typeof _items === "function" ? _items() : _items;

    const inputProps = useInput({
        source,
        onChange,
        format: config.format,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps, items };

    return config.mode === "buttons" ? (
        <Tabbed {...props} />
    ) : (
        <Combo {...props} />
    );
}

function RenderColorInput({ config }) {
    //
    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        format: config.format || colorFormat,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <ColorPicker {...props} />;
}

function RenderImageInput({ config }) {
    //
    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <ImageInput {...props} />;
}

function RenderCheckbox({ config }) {
    //
    const { value: source, onChange, ...rest } = config;

    const inputProps = useInput({
        source,
        onChange,
        opts: config.opts,
    });

    const props = { ...rest, ...inputProps };

    return <Checkbox {...props} />;
}

function RenderPresets({ config }) {
    //
    const { items, onChange } = config;

    return (
        <Layout gap={9}>
            {items.map((preset, i) => {
                //
                return <Preset key={i} preset={preset} onChange={onChange} />;
            })}
        </Layout>
    );
}

function RenderToolbar({ config }) {
    //
    const actions = useActionList(config.actions);

    return <Toolbar actions={actions} />;
}

function RenderPanel({ config }) {
    //
    const { children, ...rest } = config;

    return (
        <Panel {...rest}>
            <RenderGroup config={{ children }} standalone={true} />
        </Panel>
    );
}
