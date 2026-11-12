import {
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Tooltip,
} from "recharts";
import { PriceData } from "@dapp/types/PriceData";
import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import { Data } from "./ArtworkContext";
import { Vert } from "../style/Flex";
import { CryptoPrice } from "./Price";
import { daysBetween, trimZeros } from "@utils/js";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";

interface ChartEntry {
    name: string;
    date: Date;
    price: number;
    volume: number;
    quantity: number;
}

interface PriceStats {
    chartData: ChartEntry[];
}

interface CutoffPeriod {
    days: number;
    label: string;
    statsLabel: string;
}

const cutoffPeriods: Record<number, CutoffPeriod> = {};

[7, 14, 30, 60, 90].forEach((d) => {
    cutoffPeriods[d] = {
        days: d,
        label: `Last ${d} days`,
        statsLabel: `${d} days`,
    };
});

const cutoffPeriodArr = Object.values(cutoffPeriods);

function generateChartData(priceData: PriceData): PriceStats {
    let map: Record<string, ChartEntry> = {};

    priceData.items.forEach((it) => {
        const date = new Date(
            it.date.getFullYear(),
            it.date.getMonth(),
            it.date.getDate()
        );

        let key = date.toDateString();

        let val = map[key];

        if (val == null) {
            val = {
                name: `${it.date.getMonth() + 1}/${it.date.getDate()}`,
                date: date,
                volume: it.volume,
                quantity: it.quantity,
                price: it.volume / it.quantity,
            };

            map[key] = val;
        } else {
            val.volume += it.volume;
            val.quantity += it.quantity;
            val.price = val.volume / val.quantity;
        }
    });

    return {
        chartData: Object.values(map),
    };
}

function tickFormatter(x, i) {
    return i === 0 ? "" : trimZeros(x.toFixed(1));
}

export interface PriceHistoryProps {
    priceData: Data<PriceData>;
}

export function PriceHistory({ priceData }: PriceHistoryProps) {
    // The panel's own theme: the artwork dialog is dark on every page.
    const surface = surfaceOfTheme(useTheme() as any);
    const isLightTheme = surface === "light";

    const [cutoffPeriod, setCutoffPeriod] = useState(90);

    const stats = useMemo(() => {
        if (priceData.status === "loaded") {
            return generateChartData(priceData.data);
        } else {
            return null;
        }
    }, [priceData]);

    const { chartData, totalQuantity, totalVolume, averagePrice } =
        useMemo(() => {
            if (stats == null) return { chartData: null };

            let chartData = stats.chartData;
            let totalQuantity = 0;
            let totalVolume = 0;

            if (cutoffPeriod >= 0) {
                const now = new Date();

                chartData = stats.chartData.filter((it) => {
                    return daysBetween(it.date, now) <= cutoffPeriod;
                });
            }

            chartData.forEach((entry) => {
                totalQuantity += entry.quantity;
                totalVolume += entry.volume;
            });

            return {
                chartData,
                totalQuantity,
                totalVolume,
                averagePrice:
                    totalQuantity > 0 ? totalVolume / totalQuantity : 0,
            };
        }, [stats?.chartData, cutoffPeriod]);

    const handleCutoffPeriodChange = (e) => {
        setCutoffPeriod(+e.target.value);
    };

    const CustomTooltip = useMemo(
        () =>
            ({ active, payload, label }) => {
                //
                if (priceData.status !== "loaded" || !active || !payload.length)
                    return null;

                const data = payload[0]?.payload as ChartEntry;

                if (data == null) return null;

                return (
                    <ChartTooltip>
                        <p className="label">
                            {data.date.toLocaleDateString()}
                        </p>
                        <p>
                            Volume :{" "}
                            <CryptoPrice
                                price={data.volume}
                                paymentToken={priceData.data.paymentToken}
                            />
                        </p>
                        <p>Quantity : {data.quantity}</p>
                        <p>
                            Avg. price :{" "}
                            <CryptoPrice
                                price={data.volume}
                                paymentToken={priceData.data.paymentToken}
                            />
                        </p>
                    </ChartTooltip>
                );
            },
        [priceData]
    );

    let content;

    if (priceData.status === "idle") {
        content = (
            <EmptyState
                surface={surface}
                icon="activity"
                title="No price history yet."
            />
        );
    } else if (priceData.status === "error") {
        content = <FallbackMsg> {priceData.error}</FallbackMsg>;
    } else if (priceData.status === "loading") {
        content = <FallbackMsg>Loading price data…</FallbackMsg>;
    } else {
        const statsLabel = cutoffPeriods[cutoffPeriod].statsLabel;
        // TODO: move this into theme colors
        const chartColor = isLightTheme ? "#18191C" : "#FFFFFF";
        content = (
            <Vert style={{ height: "100%", width: "100%" }}>
                <Stats>
                    {chartData?.length ? (
                        <Vert>
                            <CryptoPrice
                                price={averagePrice}
                                paymentToken={priceData.data.paymentToken}
                            />
                            <Label>{`${statsLabel} Avg. price`}</Label>
                        </Vert>
                    ) : (
                        <div />
                    )}
                    {chartData?.length ? (
                        <Vert>
                            <CryptoPrice
                                price={totalVolume}
                                paymentToken={priceData.data.paymentToken}
                            />
                            <Label>{`${statsLabel} Volume`}</Label>
                        </Vert>
                    ) : (
                        <div />
                    )}

                    <Select
                        value={cutoffPeriod}
                        onChange={handleCutoffPeriodChange}
                    >
                        {cutoffPeriodArr.map((it) => {
                            return <option value={it.days}>{it.label}</option>;
                        })}
                    </Select>
                </Stats>
                {chartData?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 16, right: 30, bottom: 16, left: 0 }}
                        >
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke={chartColor}
                                width={2}
                            />
                            {chartData.length === 1 && (
                                <Bar
                                    dataKey="price"
                                    barSize={2}
                                    fill={chartColor}
                                />
                            )}
                            {/* <CartesianGrid
                                stroke="#ccc"
                                strokeDasharray="5 5"
                            /> */}
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                type="number"
                                allowDecimals={true}
                                // domain={[
                                //     (min) => min * 0.75,
                                //     (max) => max * 1.25,
                                // ]}
                                tickFormatter={tickFormatter}
                                tickCount={4}
                            />
                            <Tooltip content={CustomTooltip} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <EmptyState
                        surface={surface}
                        icon="activity"
                        title="No activity for this period."
                    />
                )}
            </Vert>
        );
    }

    return (
        <Container error={priceData.status === "error"}>
            {content}
            {/* <pre>{JSON.stringify(priceData, null, 2)}</pre> */}
        </Container>
    );
}

const Container = styled.div<{ error?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 400;
    background-color: ${({ theme }) => theme.table.header.background};
    height: 300px;
    border-radius: 8px;

    @media (min-width: 1368px) {
        height: 100%;
    }
`;

const Stats = styled.div`
    display: grid;
    grid-template-columns: 30% 30% 40%;
    margin: 24px;
    margin-bottom: 32px;
`;

const Label = styled.div`
    font-size: 12px;
    color: ${({ theme }) => theme.label.color};
`;

const Select = styled.select`
    padding: 7px 12px;
    border-color: #dfdfe4;
    border-radius: 6px;
    outline: none;
`;

const ChartContainer = styled.div``;

const FallbackMsg = styled.p`
    align-self: center;
    font-size: 16px;
    opacity: 0.6;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ChartTooltip = styled(Vert)`
    color: ${({ theme }) => theme.color};
    background-color: ${({ theme }) => theme.background};
    border-color: ${({ theme }) => theme.table.border.color};
    font-size: 12px;
    padding: 1rem;

    & > p {
        line-height: 16px;
        margin: 0;
    }

    & > .label {
        font-weight: 500;
    }
`;
