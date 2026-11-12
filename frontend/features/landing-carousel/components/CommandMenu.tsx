import {
    forwardRef,
    Fragment,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { Command, matchesCommand } from "../commands";
import FeedMenu from "./DiscoveryFeedMenu";
import Icon from "./Icon";

interface Props {
    commands: Command[];
    /** Accessible name of the result list. */
    listLabel: string;
    id?: string;
    className?: string;
    /** Escape, or Backspace on an empty filter. */
    onClose: () => void;
    /** Runs after the command; the host closes the menu and restores focus. */
    onRun: (command: Command) => void;
}

/**
 * The / command palette: a filter field over sectioned commands. Focus stays
 * in the field; arrows move the active row and Enter runs it.
 */
const CommandMenu = forwardRef<HTMLDivElement, Props>(function CommandMenu(
    { commands, listLabel, id, className, onClose, onRun },
    ref
) {
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(() =>
        Math.max(
            0,
            commands.findIndex((command) => command.checked)
        )
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const baseId = useId();
    const listId = `${baseId}-commands`;
    const optionId = (index: number) => `${baseId}-command-${index}`;
    const visible = commands.filter((command) =>
        matchesCommand(command, query)
    );
    const activeIndex = Math.min(active, visible.length - 1);

    function run(command: Command) {
        command.run();
        onRun(command);
    }

    useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        document
            .getElementById(optionId(activeIndex))
            ?.scrollIntoView?.({ block: "nearest" });
    }, [activeIndex]);

    let lastSection = "";
    return (
        <FeedMenu
            ref={ref}
            id={id}
            className={className}
            role="dialog"
            aria-label="Commands"
            onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229)
                    return;
                // ⌘K / Ctrl+K reaches the page shortcut.
                if (event.metaKey || event.ctrlKey) return;
                event.stopPropagation();
                if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                    return;
                }
                if (event.key === "Enter") {
                    event.preventDefault();
                    if (visible[activeIndex]) run(visible[activeIndex]);
                    return;
                }
                if (event.key === "Backspace" && !query && !event.repeat) {
                    event.preventDefault();
                    onClose();
                    return;
                }
                const count = visible.length;
                if (!count) return;
                let next = activeIndex;
                if (event.key === "ArrowDown") next = (activeIndex + 1) % count;
                else if (event.key === "ArrowUp")
                    next = (activeIndex - 1 + count) % count;
                else if (event.key === "Home" && !query) next = 0;
                else if (event.key === "End" && !query) next = count - 1;
                else return;
                event.preventDefault();
                setActive(next);
            }}
        >
            <label className="command-input">
                <span className="slash" aria-hidden="true">
                    /
                </span>
                <input
                    ref={inputRef}
                    role="combobox"
                    aria-label="Search commands"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        visible[activeIndex] ? optionId(activeIndex) : undefined
                    }
                    placeholder="Filter, create, jump in…"
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                    }}
                />
            </label>
            <div
                className="command-list"
                id={listId}
                role="listbox"
                aria-label={listLabel}
            >
                {visible.length === 0 && (
                    <div className="command-empty">No matching commands</div>
                )}
                {visible.map((command, index) => {
                    const heading =
                        command.section !== lastSection ? (
                            <div
                                className="command-section"
                                role="presentation"
                            >
                                {command.section}
                            </div>
                        ) : null;
                    lastSection = command.section;
                    return (
                        <Fragment key={command.id}>
                            {heading}
                            <div
                                id={optionId(index)}
                                role="option"
                                aria-selected={index === activeIndex}
                                data-active={index === activeIndex}
                                data-checked={command.checked || undefined}
                                onPointerMove={() => setActive(index)}
                                onPointerDown={(event) =>
                                    event.preventDefault()
                                }
                                onClick={() => run(command)}
                            >
                                <Icon name={command.icon} size={16} />
                                <span className="label">{command.label}</span>
                                <span className="detail">{command.detail}</span>
                                {command.checked ? (
                                    <span className="hint" aria-label="current">
                                        <Icon name="check" size={14} />
                                    </span>
                                ) : command.hint ? (
                                    <span className="hint">{command.hint}</span>
                                ) : null}
                            </div>
                        </Fragment>
                    );
                })}
            </div>
        </FeedMenu>
    );
});

export default CommandMenu;
