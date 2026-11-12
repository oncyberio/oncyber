import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useLandingBusy } from "../activity";
import { cellDimensions, cylinderMetrics, projectPoint } from "../three/layout";

export default function LoadingGrid({
    grid = { columns: 2, rows: 2 },
    reserveFooter = false,
}: {
    grid?: { columns: number; rows: number };
    reserveFooter?: boolean;
}) {
    useLandingBusy(true);
    const frame = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const element = frame.current;
        const measure = () => {
            const { width, height } = element.getBoundingClientRect();
            setSize({ width, height });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const single = grid.columns === 1 && grid.rows === 1;
    const metrics = cylinderMetrics(
        size.width,
        size.height,
        grid.columns,
        grid.rows
    );
    return (
        <Shell
            role="status"
            aria-label="Loading world previews"
            $single={single}
            $reserveFooter={reserveFooter}
        >
            <div className="loading-frame" ref={frame}>
                {size.width > 0 &&
                    Array.from(
                        { length: grid.columns * grid.rows },
                        (_, index) => {
                            const cell = {
                                index,
                                row: index % grid.rows,
                                column: Math.floor(index / grid.rows),
                            };
                            const dims = cellDimensions(cell, metrics, 0);
                            const points = [];
                            for (let i = 0; i <= 16; i++)
                                points.push(
                                    projectPoint(
                                        dims.x -
                                            dims.width / 2 +
                                            (dims.width * i) / 16,
                                        dims.y + dims.height / 2,
                                        metrics
                                    )
                                );
                            for (let i = 0; i <= 16; i++)
                                points.push(
                                    projectPoint(
                                        dims.x +
                                            dims.width / 2 -
                                            (dims.width * i) / 16,
                                        dims.y - dims.height / 2,
                                        metrics
                                    )
                                );
                            const left = Math.min(...points.map((p) => p.x));
                            const top = Math.min(...points.map((p) => p.y));
                            const width =
                                Math.max(...points.map((p) => p.x)) - left;
                            const height =
                                Math.max(...points.map((p) => p.y)) - top;
                            return (
                                <div
                                    key={index}
                                    className="loading-card"
                                    aria-hidden="true"
                                    style={{
                                        left,
                                        top,
                                        width,
                                        height,
                                        borderRadius: metrics.cardRadius,
                                        clipPath: `polygon(${points
                                            .map(
                                                (p) =>
                                                    `${p.x - left}px ${
                                                        p.y - top
                                                    }px`
                                            )
                                            .join(",")})`,
                                    }}
                                />
                            );
                        }
                    )}
            </div>
            {single && <div className="loading-actions" />}
            {reserveFooter && <div className="loading-footer" />}
        </Shell>
    );
}

const Shell = styled.div<{ $single: boolean; $reserveFooter: boolean }>`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    .loading-frame {
        position: relative;
        flex: 1;
        min-height: 0;
        margin-block: ${({ $single }) =>
            $single
                ? "calc(-1 * min(4.5svh, 40px))"
                : "calc(-1 * min(1.5svh, 14px))"};
    }
    .loading-card {
        position: absolute;
        overflow: hidden;
        background: #1c1c1c;
        isolation: isolate;
        &::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
                110deg,
                transparent 20%,
                #ffffff04 35%,
                #ffffff16 50%,
                #ffffff04 65%,
                transparent 80%
            );
            transform: translateX(-100%);
            animation: card-shimmer 1.8s ease-in-out infinite;
        }
    }
    .loading-actions {
        height: 10.6svh;
        min-height: 58px;
        flex-shrink: 0;
    }
    .loading-footer {
        height: 17.8svh;
        min-height: 76px;
        flex-shrink: 0;
    }
    @keyframes card-shimmer {
        to {
            transform: translateX(100%);
        }
    }
    @media (max-width: 700px) {
        .loading-frame {
            margin-block: 0;
        }
        .loading-actions {
            height: 12svh;
        }
        .loading-footer {
            height: 18svh;
            min-height: 144px;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .loading-card::after {
            animation: none;
            transform: none;
            opacity: 0.35;
        }
    }
`;
