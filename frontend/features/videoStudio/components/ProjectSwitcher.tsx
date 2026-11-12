import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import styles from "../VideoStudioShell.module.css";
import { CheckIcon, ChevronDownIcon, LayersIcon, PlusIcon } from "./Icons";

export interface VideoProjectSummary {
    readonly id: string;
    readonly title: string;
    readonly setTitle: string;
    readonly shotCount: number;
    readonly revision: number;
    readonly palette: readonly string[];
}

interface Props {
    projects: readonly VideoProjectSummary[];
    activeProjectId: string;
    onSelect: (id: string) => void;
    onCreateProject: () => void;
    onConstructSet: () => void;
}

export function ProjectSwitcher({
    projects,
    activeProjectId,
    onSelect,
    onCreateProject,
    onConstructSet,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const reduceMotion = useReducedMotion();
    const active =
        projects.find((project) => project.id === activeProjectId) ??
        projects[0];
    const visible = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        if (!normalized) return projects;
        return projects.filter((project) =>
            [project.title, project.setTitle]
                .join(" ")
                .toLocaleLowerCase()
                .includes(normalized)
        );
    }, [projects, query]);

    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node))
                setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", closeOnEscape);
        const frame = window.requestAnimationFrame(() =>
            searchRef.current?.focus()
        );
        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            document.removeEventListener("keydown", closeOnEscape);
            window.cancelAnimationFrame(frame);
        };
    }, [open]);

    if (!active) return null;

    const runAndClose = (action: () => void) => {
        action();
        setOpen(false);
        setQuery("");
    };

    return (
        <div className={styles.projectSwitcher} ref={rootRef}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.projectTitle}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls="video-project-switcher"
                onClick={() => setOpen((value) => !value)}
            >
                <span
                    className={styles.projectThumb}
                    style={{
                        background: `linear-gradient(145deg, ${active.palette[0]}, ${active.palette[1]})`,
                    }}
                />
                <span className={styles.projectCopy}>
                    <small>Project /</small>
                    <strong>{active.title}</strong>
                    <em>Saved · r{active.revision}</em>
                </span>
                <ChevronDownIcon
                    className={styles.projectChevron}
                    data-open={open || undefined}
                />
            </button>

            <AnimatePresence>
                {open ? (
                    <motion.div
                        id="video-project-switcher"
                        className={styles.projectMenu}
                        role="dialog"
                        aria-label="Switch project"
                        initial={
                            reduceMotion
                                ? false
                                : { opacity: 0, y: -5, scale: 0.985 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                            reduceMotion
                                ? undefined
                                : { opacity: 0, y: -3, scale: 0.99 }
                        }
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                    >
                        <div className={styles.projectMenuHeader}>
                            <strong>Video projects</strong>
                            <span>{projects.length}</span>
                        </div>
                        <label className={styles.projectSearch}>
                            <span className={styles.srOnly}>
                                Search projects
                            </span>
                            <input
                                ref={searchRef}
                                type="search"
                                value={query}
                                placeholder="Search projects…"
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <div
                            className={styles.projectList}
                            role="listbox"
                            aria-label="Projects"
                        >
                            {visible.map((project) => {
                                const selected = project.id === activeProjectId;
                                return (
                                    <button
                                        key={project.id}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        data-active={selected || undefined}
                                        onClick={() =>
                                            runAndClose(() =>
                                                onSelect(project.id)
                                            )
                                        }
                                    >
                                        <span
                                            className={styles.projectRowThumb}
                                            style={{
                                                background: `linear-gradient(145deg, ${project.palette[0]}, ${project.palette[1]})`,
                                            }}
                                        />
                                        <span className={styles.projectRowCopy}>
                                            <strong>{project.title}</strong>
                                            <small>
                                                {project.setTitle} ·{" "}
                                                {project.shotCount} shot
                                                {project.shotCount === 1
                                                    ? ""
                                                    : "s"}
                                            </small>
                                        </span>
                                        {selected ? <CheckIcon /> : null}
                                    </button>
                                );
                            })}
                            {!visible.length ? (
                                <p className={styles.projectEmpty}>
                                    No matching projects
                                </p>
                            ) : null}
                        </div>
                        <div className={styles.projectMenuActions}>
                            <button
                                type="button"
                                onClick={() => runAndClose(onConstructSet)}
                            >
                                <LayersIcon />
                                <span>
                                    <strong>Construct new set</strong>
                                    <small>
                                        Add it as the next timeline shot
                                    </small>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => runAndClose(onCreateProject)}
                            >
                                <PlusIcon />
                                <span>
                                    <strong>New video project</strong>
                                    <small>
                                        Start with an independent timeline
                                    </small>
                                </span>
                            </button>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
