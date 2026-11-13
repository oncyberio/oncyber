import { useMemo, useState } from "react";
import styled from "styled-components";
import { NButton } from "@features/studio/components/StudioButton";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import {
    buildSpaceExport,
    downloadSpaceExport,
    spaceExportFileName,
} from "@features/studio/export/spaceExport";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { Form, FormInfo, FormLabel, FormSep } from "../styles/Form";

/**
 * Downloads the space as one JSON file that does not need Firebase or an
 * account to read. Only the signed-in owner sees this step
 * (SpaceSettings/index.tsx).
 */
export function Export() {
    const { exhibit, destination, baseAnalyticsEvent } = useCurrentExhibit();

    const [downloaded, setDownloaded] = useState(false);

    // Count what the file will list, so the owner knows what it holds.
    const summary = useMemo(() => {
        const data = buildSpaceExport({ exhibit, room: destination });
        return {
            kind: data.kind,
            artworks: Object.keys(exhibit.artworks || {}).length,
            pinned: data.files.pinned.length,
            hosted: data.files.hosted.length,
        };
    }, [exhibit, destination]);

    const handleDownload = () => {
        const data = buildSpaceExport({
            exhibit,
            room: destination,
            origin: window.location.origin,
        });
        downloadSpaceExport(data, spaceExportFileName(exhibit));
        setDownloaded(true);
        amplitude_logAnalyticsEvent("export_space", baseAnalyticsEvent);
    };

    return (
        <Container>
            <Form>
                <FormInfo>Download a copy of this world</FormInfo>
                <FormLabel className="hint">
                    One JSON file with the layout, settings and room of this
                    world, plus a list of every file it uses. It needs no
                    account to read, so the world can be rebuilt or archived
                    from it.
                </FormLabel>
                <FormSep />
                <dl className="counts">
                    <div>
                        <dt>Items</dt>
                        <dd>{summary.artworks}</dd>
                    </div>
                    <div>
                        <dt>On IPFS</dt>
                        <dd>{summary.pinned}</dd>
                    </div>
                    <div>
                        <dt>Other links</dt>
                        <dd>{summary.hosted}</dd>
                    </div>
                </dl>
                {summary.kind === "external" ? (
                    <FormLabel className="hint">
                        This world runs from a page on another server. The file
                        records its address, not the page itself, so keep a copy
                        of that page too.
                    </FormLabel>
                ) : summary.hosted > 0 ? (
                    <FormLabel className="hint">
                        Files on IPFS can be pinned anywhere from their content
                        id. Other links point to someone&apos;s server and can
                        stop working.
                    </FormLabel>
                ) : null}
                <div className="actions">
                    <NButton
                        size="small"
                        style={{ height: 38 }}
                        onClick={handleDownload}
                    >
                        Download JSON
                    </NButton>
                    {downloaded && (
                        <span className="done" role="status">
                            Saved to your downloads.
                        </span>
                    )}
                </div>
            </Form>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;

    .hint {
        color: var(--studio-muted);
        font: var(--studio-font-body);
    }

    .counts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--studio-grid-gap);
        margin: 0;

        & > div {
            padding: 10px 12px;
            border-radius: var(--studio-radius-control);
            background: var(--studio-surface);
        }

        dt {
            color: var(--studio-muted);
            font: var(--studio-font-label);
        }

        dd {
            margin: 0;
            color: var(--studio-ink);
            font: var(--studio-font-heading);
            font-family: var(--studio-mono);
        }
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
    }

    .done {
        color: var(--studio-secondary);
        font: var(--studio-font-body);
    }
`;
