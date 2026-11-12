import styled from "styled-components";

type MetricsProps = {
    spaceVisits: string | number;
    daysSinceCreation: string | number;
    score: number;
};

function formatScore(x: number) {
    const nb = +x;

    if (isNaN(nb)) return "--";

    return `${nb.toFixed(0)}%`;
}

export const Metrics = ({
    spaceVisits,
    daysSinceCreation,
    score,
}: MetricsProps) => (
    <Container>
        <Metric>
            <dt>Total visits</dt>
            <dd>{spaceVisits}</dd>
        </Metric>
        <Metric>
            <dt>Days since creation</dt>
            <dd>{daysSinceCreation}</dd>
        </Metric>
        <Metric>
            <dt>Performance score</dt>
            <dd>{formatScore(score)}</dd>
        </Metric>
    </Container>
);

const Container = styled.dl`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0 0 20px;
`;

const Metric = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-card);
    background: var(--studio-inset);

    dt {
        font: 400 11px/16px var(--studio-font, sans-serif);
        color: var(--studio-muted);
    }

    dd {
        margin: 0;
        font: 400 20px/26px var(--studio-mono, monospace);
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
        color: var(--studio-ink);
    }
`;
