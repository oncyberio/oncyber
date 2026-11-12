import type { SetOption } from "../model";
import styles from "../VideoStudioShell.module.css";
import { CheckIcon, PlayIcon } from "./Icons";

interface Props {
    option: SetOption;
    previewing: boolean;
    selected: boolean;
    onPreview: () => void;
    onUse: () => void;
}

export function SetChoiceCard({
    option,
    previewing,
    selected,
    onPreview,
    onUse,
}: Props) {
    return (
        <article
            className={styles.setCard}
            data-selected={selected || undefined}
            data-previewing={previewing || undefined}
        >
            <button
                type="button"
                className={styles.setPoster}
                style={{
                    background: `linear-gradient(145deg, ${option.palette[0]}, ${option.palette[1]} 54%, ${option.palette[2]})`,
                }}
                onClick={onPreview}
                aria-label={`Open ${option.title} in 3D preview`}
                aria-current={previewing ? "true" : undefined}
            >
                <span className={styles.posterArchitecture}>
                    <i />
                    <i />
                    <i />
                </span>
                <span className={styles.previewPill}>
                    <PlayIcon /> {previewing ? "Previewing" : "Open in 3D"}
                </span>
            </button>
            <div className={styles.setCardBody}>
                <div>
                    <strong>{option.title}</strong>
                    <p>{option.subtitle}</p>
                </div>
                <div className={styles.setCardActions}>
                    <button
                        type="button"
                        className={styles.setUseButton}
                        onClick={onUse}
                        disabled={selected}
                        aria-label={
                            selected
                                ? `${option.title} is selected`
                                : `Use ${option.title}`
                        }
                    >
                        {selected ? <CheckIcon /> : null}
                        {selected ? "Selected" : "Use set"}
                    </button>
                </div>
            </div>
        </article>
    );
}
