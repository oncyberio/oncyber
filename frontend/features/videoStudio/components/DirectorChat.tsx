import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AgentProposalV1, SetOption } from "../model";
import type { EditorProposalState } from "../store";
import type { VideoGenerationJob } from "../guide";
import styles from "../VideoStudioShell.module.css";
import {
    ArrowUpIcon,
    CameraIcon,
    CheckIcon,
    ChevronDownIcon,
    CloseIcon,
    ComposeIcon,
    CopyIcon,
    PlusIcon,
    SparklesIcon,
    StopIcon,
} from "./Icons";
import { SetChoiceCard } from "./SetChoiceCard";

export interface DirectorMessage {
    id: string;
    role: "assistant" | "user";
    text: string;
}

interface Props {
    messages: readonly DirectorMessage[];
    choices: readonly SetOption[];
    previewSetId: string | null;
    selectedSetId: string | null;
    proposal: EditorProposalState | null;
    renderJob: VideoGenerationJob | null;
    renderPending: boolean;
    renderCredits: number | null;
    draft: string;
    activity: string | null;
    focusRequest: number;
    onDraftChange: (value: string) => void;
    onPreviewSet: (set: SetOption) => void;
    onUseSet: (set: SetOption) => void;
    onApplyProposal: (proposal: AgentProposalV1) => void;
    onRejectProposal: (proposal: AgentProposalV1) => void;
    onSubmit: (prompt: string) => void;
    onCancelReply: () => void;
    onNewConversation: () => void;
    onOpenAssets: () => void;
    onCancelRender: () => void;
    onRetryRender: () => void;
    onClose: () => void;
}

const QUICK_STARTS = [
    {
        title: "Build a launch film",
        detail: "Sculptural sunset set · three-shot sequence",
        prompt: "Make a cinematic launch film in a sculptural sunset space",
        icon: SparklesIcon,
    },
    {
        title: "Refine this camera",
        detail: "Slower, higher and more intentional",
        prompt: "Make this move slower and more elevated",
        icon: CameraIcon,
    },
] as const;

const activeRender = (job: VideoGenerationJob | null) =>
    !!job && ["queued", "running"].includes(job.status);

function renderTitle(job: VideoGenerationJob | null, pending: boolean) {
    if (pending && !job) return "Preparing your shot";
    if (!job) return "Preparing your shot";
    if (job.status === "succeeded") return "Draft ready";
    if (job.status === "failed") return "Generation failed";
    if (job.status === "cancelled") return "Generation stopped";
    if (job.status === "queued") return "Queued with renderer";
    return "Rendering selected shot";
}

function renderDescription(job: VideoGenerationJob | null, pending: boolean) {
    if (pending && !job)
        return "Packaging the Three.js guide, camera manifest and prompt.";
    if (!job) return "Preparing the generation request.";
    if (job.status === "succeeded")
        return "The draft stays linked to this camera guide and project revision.";
    if (job.status === "failed")
        return job.error || "The renderer could not complete this shot.";
    if (job.status === "cancelled")
        return "No more credits will be used for this attempt.";
    return `${Math.round(
        job.progress * 100
    )}% · You can keep editing while this runs.`;
}

export function DirectorChat({
    messages,
    choices,
    previewSetId,
    selectedSetId,
    proposal,
    renderJob,
    renderPending,
    renderCredits,
    draft,
    activity,
    focusRequest,
    onDraftChange,
    onPreviewSet,
    onUseSet,
    onApplyProposal,
    onRejectProposal,
    onSubmit,
    onCancelReply,
    onNewConversation,
    onOpenAssets,
    onCancelRender,
    onRetryRender,
    onClose,
}: Props) {
    const reduceMotion = useReducedMotion();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const followLatest = useRef(true);
    const copyTimer = useRef<number | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [showJump, setShowJump] = useState(false);
    const busy = activity !== null;
    const visibleMessages = messages.filter(
        (message) => message.id !== "welcome"
    );
    const showStarters =
        visibleMessages.length === 0 &&
        choices.length === 0 &&
        !proposal &&
        !renderJob &&
        !renderPending &&
        !busy;
    const renderVisible = renderPending || renderJob !== null;
    const rendering = renderPending || activeRender(renderJob);

    const scrollToLatest = (force = false) => {
        const node = scrollRef.current;
        if (!node || (!force && !followLatest.current)) return;
        node.scrollTo({
            top: node.scrollHeight,
            behavior: reduceMotion ? "auto" : "smooth",
        });
        followLatest.current = true;
        setShowJump(false);
    };

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "0px";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
    }, [draft]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => scrollToLatest());
        return () => window.cancelAnimationFrame(frame);
    }, [
        messages.length,
        choices.length,
        proposal?.proposal.id,
        proposal?.status,
        renderJob?.id,
        renderJob?.status,
        renderPending,
        activity,
    ]);

    useEffect(() => {
        if (focusRequest > 0) textareaRef.current?.focus();
    }, [focusRequest]);

    useEffect(
        () => () => {
            if (copyTimer.current !== null)
                window.clearTimeout(copyTimer.current);
        },
        []
    );

    const submit = () => {
        const value = draft.trim();
        if (!value || busy) return;
        onDraftChange("");
        followLatest.current = true;
        onSubmit(value);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        submit();
    };

    const submitStarter = (prompt: string) => {
        if (busy) return;
        onDraftChange("");
        followLatest.current = true;
        onSubmit(prompt);
    };

    const copyMessage = async (message: DirectorMessage) => {
        try {
            await navigator.clipboard.writeText(message.text);
            setCopiedMessageId(message.id);
            if (copyTimer.current !== null)
                window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(
                () => setCopiedMessageId(null),
                1400
            );
        } catch {
            setCopiedMessageId(null);
        }
    };

    const enter = reduceMotion ? false : { opacity: 0, y: 6 };
    const exit = reduceMotion ? undefined : { opacity: 0, y: -4 };
    const transition = { duration: reduceMotion ? 0 : 0.18 };

    return (
        <aside
            className={styles.chatPanel}
            aria-label="Director chat"
            aria-busy={busy || rendering}
            onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                if (busy) onCancelReply();
                else if (!draft) onClose();
            }}
        >
            <header className={styles.panelHeader}>
                <div className={styles.directorIdentity}>
                    <div>
                        <strong>Director</strong>
                        <small aria-live="polite">
                            <i data-busy={busy || undefined} />
                            {activity || "Ready"}
                        </small>
                    </div>
                </div>
                <div className={styles.panelActions}>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onNewConversation}
                        aria-label="New conversation"
                        title="New conversation"
                    >
                        <ComposeIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onClose}
                        aria-label="Close Director"
                        title="Close Director"
                    >
                        <CloseIcon />
                    </button>
                </div>
            </header>

            <div className={styles.chatViewport}>
                <div
                    ref={scrollRef}
                    className={styles.chatScroll}
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions"
                    onScroll={(event) => {
                        const node = event.currentTarget;
                        const atBottom =
                            node.scrollHeight -
                                node.scrollTop -
                                node.clientHeight <
                            72;
                        followLatest.current = atBottom;
                        setShowJump(!atBottom);
                    }}
                >
                    <AnimatePresence initial={false}>
                        {visibleMessages.map((message, index) => (
                            <motion.div
                                key={message.id}
                                className={styles.chatMessage}
                                data-role={message.role}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                            >
                                <div className={styles.messageBody}>
                                    {message.role === "assistant" &&
                                    visibleMessages[index - 1]?.role !==
                                        "assistant" ? (
                                        <span className={styles.messageAuthor}>
                                            Director
                                        </span>
                                    ) : null}
                                    <span className={styles.srOnly}>
                                        {message.role === "assistant"
                                            ? "Director"
                                            : "You"}
                                        :
                                    </span>
                                    <p>{message.text}</p>
                                    <div className={styles.messageActions}>
                                        <button
                                            type="button"
                                            onClick={() => copyMessage(message)}
                                            aria-label={`Copy ${
                                                message.role === "assistant"
                                                    ? "Director response"
                                                    : "your message"
                                            }`}
                                            title="Copy"
                                        >
                                            {copiedMessageId === message.id ? (
                                                <CheckIcon />
                                            ) : (
                                                <CopyIcon />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {showStarters ? (
                            <motion.div
                                key="starters"
                                className={styles.starterActions}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                            >
                                <span>Start with an idea</span>
                                {QUICK_STARTS.map((starter) => {
                                    const StarterIcon = starter.icon;
                                    return (
                                        <button
                                            key={starter.title}
                                            type="button"
                                            onClick={() =>
                                                submitStarter(starter.prompt)
                                            }
                                        >
                                            <span>
                                                <strong>{starter.title}</strong>
                                                <small>{starter.detail}</small>
                                            </span>
                                            <StarterIcon />
                                        </button>
                                    );
                                })}
                            </motion.div>
                        ) : null}

                        {busy ? (
                            <motion.div
                                key="director-thinking"
                                className={styles.thinkingMessage}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                                role="status"
                            >
                                <div className={styles.thinkingBody}>
                                    <span
                                        className={styles.thinkingMark}
                                        aria-hidden="true"
                                    />
                                    <span>{activity}</span>
                                </div>
                            </motion.div>
                        ) : null}

                        {choices.length ? (
                            <motion.div
                                layout={!reduceMotion}
                                key="set-choices"
                                className={styles.setChoices}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                            >
                                {choices.map((option) => (
                                    <SetChoiceCard
                                        key={option.id}
                                        option={option}
                                        previewing={previewSetId === option.id}
                                        selected={selectedSetId === option.id}
                                        onPreview={() => onPreviewSet(option)}
                                        onUse={() => onUseSet(option)}
                                    />
                                ))}
                            </motion.div>
                        ) : null}

                        {proposal ? (
                            <motion.article
                                layout={!reduceMotion}
                                key={proposal.proposal.id}
                                className={styles.proposalCard}
                                data-stale={
                                    proposal.status === "stale" || undefined
                                }
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                            >
                                <div className={styles.proposalIcon}>
                                    <SparklesIcon />
                                </div>
                                <div className={styles.proposalBody}>
                                    <small>READY TO REVIEW</small>
                                    <strong>{proposal.proposal.title}</strong>
                                    <p>{proposal.proposal.summary}</p>
                                    <span>
                                        {proposal.proposal.operations.length}{" "}
                                        editable changes · project r
                                        {proposal.proposal.baseRevision}
                                    </span>
                                    {proposal.status === "stale" ? (
                                        <em>
                                            The project changed. Dismiss this
                                            and ask Director to refresh it.
                                        </em>
                                    ) : (
                                        <div className={styles.proposalActions}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onRejectProposal(
                                                        proposal.proposal
                                                    )
                                                }
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onApplyProposal(
                                                        proposal.proposal
                                                    )
                                                }
                                            >
                                                <CheckIcon /> Apply changes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.article>
                        ) : null}

                        {renderVisible ? (
                            <motion.article
                                layout={!reduceMotion}
                                key={renderJob?.id || "render-preparing"}
                                className={styles.renderCard}
                                data-status={renderJob?.status || "preparing"}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={exit}
                                transition={transition}
                            >
                                <div className={styles.renderCardHeader}>
                                    <span className={styles.renderPulse} />
                                    <div>
                                        <small>AI VIDEO</small>
                                        <strong>
                                            {renderTitle(
                                                renderJob,
                                                renderPending
                                            )}
                                        </strong>
                                    </div>
                                    {renderCredits !== null ? (
                                        <span>{renderCredits} cr</span>
                                    ) : null}
                                </div>
                                <div
                                    className={styles.renderProgress}
                                    data-indeterminate={
                                        !renderJob || renderPending || undefined
                                    }
                                    role="progressbar"
                                    aria-label="Shot generation progress"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={
                                        renderJob
                                            ? Math.round(
                                                  renderJob.progress * 100
                                              )
                                            : undefined
                                    }
                                    aria-valuetext={renderTitle(
                                        renderJob,
                                        renderPending
                                    )}
                                >
                                    <i
                                        style={{
                                            width: renderJob
                                                ? `${renderJob.progress * 100}%`
                                                : "36%",
                                        }}
                                    />
                                </div>
                                <p>
                                    {renderDescription(
                                        renderJob,
                                        renderPending
                                    )}
                                </p>
                                {rendering ? (
                                    <button
                                        type="button"
                                        className={styles.renderAction}
                                        onClick={onCancelRender}
                                    >
                                        <StopIcon /> Stop generation
                                    </button>
                                ) : renderJob &&
                                  ["failed", "cancelled"].includes(
                                      renderJob.status
                                  ) ? (
                                    <button
                                        type="button"
                                        className={styles.renderAction}
                                        onClick={onRetryRender}
                                    >
                                        <SparklesIcon /> Try again
                                    </button>
                                ) : null}
                            </motion.article>
                        ) : null}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {showJump ? (
                        <motion.button
                            type="button"
                            className={styles.jumpToLatest}
                            onClick={() => scrollToLatest(true)}
                            initial={
                                reduceMotion ? false : { opacity: 0, y: 4 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={exit}
                            transition={transition}
                        >
                            <ChevronDownIcon /> New activity
                        </motion.button>
                    ) : null}
                </AnimatePresence>
            </div>

            <footer className={styles.composerWrap}>
                <form className={styles.composer} onSubmit={handleSubmit}>
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        rows={1}
                        placeholder={
                            busy ? "Add another thought…" : "Message Director…"
                        }
                        aria-label="Message Director"
                        onChange={(event) => onDraftChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                submit();
                            }
                        }}
                    />
                    <div className={styles.composerToolbar}>
                        <div className={styles.composerTools}>
                            <button
                                type="button"
                                className={styles.attachButton}
                                onClick={onOpenAssets}
                                aria-label="Add scene asset"
                                title="Add scene asset"
                            >
                                <PlusIcon />
                            </button>
                            <button
                                type="button"
                                className={styles.contextChip}
                                onClick={onOpenAssets}
                            >
                                Scene context
                            </button>
                        </div>
                        <button
                            type={busy ? "button" : "submit"}
                            className={styles.sendButton}
                            onClick={busy ? onCancelReply : undefined}
                            disabled={!busy && !draft.trim()}
                            aria-label={busy ? "Stop Director" : "Send message"}
                        >
                            {busy ? <StopIcon /> : <ArrowUpIcon />}
                        </button>
                    </div>
                </form>
            </footer>
        </aside>
    );
}
