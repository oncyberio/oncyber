import { LandingCard } from "../types";
import { brandTokens } from "../../../styles/brand/tokens";

export interface GridCell {
    index: number;
    row: number;
    column: number;
}

export interface GridLayout {
    cells: GridCell[];
    columnCount: number;
    maxScrollColumn: number;
    /**
     * Card index in each slot, column by column (`column * rows + row`), or
     * -1 where a column ends early so the next section starts a new one.
     */
    slots: number[];
    /** First column of the popular section after the staff picks, or -1. */
    sectionColumn: number;
}

/** Where the popular worlds start after the staff picks, or -1. */
export function popularSectionStart(cards: LandingCard[]) {
    const start = cards.findIndex((card) => card.section === "popular");
    return start > 0 ? start : -1;
}

/**
 * Fill each vertical column, then continue horizontally without page gaps.
 * A new section (the popular worlds after the staff picks) starts at the top
 * of a new column, so its label sits above its first card.
 */
export function createGridLayout(
    cards: LandingCard[],
    columns = 2,
    visibleRows = 2
): GridLayout {
    const start = popularSectionStart(cards);
    const padding =
        start > 0 ? (visibleRows - (start % visibleRows)) % visibleRows : 0;
    const cells: GridCell[] = cards.map((_, index) => {
        const slot = index + (start > 0 && index >= start ? padding : 0);
        return {
            index,
            row: slot % visibleRows,
            column: Math.floor(slot / visibleRows),
        };
    });
    const columnCount = cells.length ? cells[cells.length - 1].column + 1 : 0;
    const slots = new Array(columnCount * visibleRows).fill(-1);
    cells.forEach((cell) => {
        slots[cell.column * visibleRows + cell.row] = cell.index;
    });
    return {
        cells,
        columnCount,
        maxScrollColumn: Math.max(0, columnCount - columns),
        slots,
        sectionColumn: start > 0 ? cells[start].column : -1,
    };
}

/** The cells in columns `from` up to (not including) `to`, in card order. */
export function cellsInColumns(layout: GridLayout, from: number, to: number) {
    const rows = layout.columnCount
        ? layout.slots.length / layout.columnCount
        : 1;
    return layout.slots
        .slice(Math.max(0, from) * rows, Math.max(0, to) * rows)
        .filter((index) => index >= 0)
        .map((index) => layout.cells[index]);
}

/** The card in a slot, or the nearest card above it in a short column. */
function cardInSlot(
    slots: number[],
    rows: number,
    column: number,
    row: number,
    cardCount: number
) {
    const slot = column * rows + row;
    if (slot >= slots.length) return cardCount - 1;
    for (let r = row; r >= 0; r--) {
        const index = slots[column * rows + r];
        if (index >= 0) return index;
    }
    return Math.min(cardCount - 1, slot);
}

function plainSlots(cardCount: number) {
    return Array.from({ length: cardCount }, (_, index) => index);
}

export interface CylinderMetrics {
    width: number;
    height: number;
    columns: number;
    visibleRows: number;
    cardWidth: number;
    cardHeight: number;
    captionHeight: number;
    cardRadius: number;
    gridWidth: number;
    columnStride: number;
    gap: number;
    radius: number;
    cameraDistance: number;
}

export function cylinderMetrics(
    width: number,
    height: number,
    columns: number,
    visibleRows: number
): CylinderMetrics {
    const mobile = width < 700;
    const single = columns === 1 && visibleRows === 1;
    const gap = mobile ? 12 : 20;
    // The reference card is 755 × 418, including its paper caption.
    const singleAspect = 755 / 418;
    // Give the single-card view a little more room than the original layout.
    const preferredWidth =
        width * (single ? (mobile ? 0.86 : 0.5) : mobile ? 0.88 : 0.78);
    const gridWidth = single
        ? mobile
            ? preferredWidth
            : Math.min(preferredWidth, Math.max(0, height - 6) * singleAspect)
        : Math.min(
              preferredWidth,
              ((height - gap - 12) / visibleRows) * 2 * columns +
                  (columns - 1) * gap
          );
    const cardWidth = (gridWidth - (columns - 1) * gap) / columns;
    const cardHeight = single
        ? Math.min(
              height - 6,
              mobile ? cardWidth * 0.62 + 64 : cardWidth / singleAspect
          )
        : Math.min((height - gap - 12) / visibleRows, cardWidth * 0.65 + 48);
    return {
        width,
        height,
        columns,
        visibleRows,
        gap,
        gridWidth,
        cardWidth,
        cardHeight,
        captionHeight: single
            ? Math.max(64, cardHeight * 0.227)
            : Math.min(mobile ? 56 : 64, cardHeight * 0.36),
        cardRadius: mobile
            ? brandTokens.radius.compactCard
            : brandTokens.radius.card,
        columnStride:
            cardWidth +
            (single ? Math.max(mobile ? 24 : 32, width * 0.034) : gap),
        radius: width * 3.5,
        cameraDistance: Math.max(width, height) * 2,
    };
}

export function cellDimensions(
    cell: GridCell,
    metrics: CylinderMetrics,
    progress: number
) {
    return {
        x:
            (cell.column - progress - (metrics.columns - 1) / 2) *
            metrics.columnStride,
        y:
            ((metrics.visibleRows - 1) / 2 - cell.row) *
            (metrics.cardHeight + metrics.gap),
        width: metrics.cardWidth,
        height: metrics.cardHeight,
    };
}

/** Keep the visible columns bright and fade only the neighboring columns. */
export function columnOpacity(
    column: number,
    progress: number,
    visibleColumns: number
) {
    const distance = Math.min(
        1,
        Math.max(progress - column, column - (progress + visibleColumns - 1), 0)
    );
    const fade = distance * distance * (3 - 2 * distance);
    return 1 - fade * 0.86;
}

export function adjacentColumn(
    progress: number,
    direction: number,
    maxScrollColumn: number
) {
    return Math.max(
        0,
        Math.min(maxScrollColumn, Math.round(progress) + direction)
    );
}

/** Keep one selected card in the same grid slot as columns scroll past. */
export function selectedCardIndex(
    firstColumn: number,
    columns: number,
    rows: number,
    cardCount: number,
    slot: { column: number; row: number },
    slots = plainSlots(cardCount)
) {
    if (!cardCount) return -1;
    const start = Math.max(
        0,
        Math.min(
            firstColumn,
            Math.max(0, Math.ceil(slots.length / rows) - columns)
        )
    );
    const column = Math.max(0, Math.min(columns - 1, slot.column));
    const row = Math.max(0, Math.min(rows - 1, slot.row));
    return cardInSlot(slots, rows, start + column, row, cardCount);
}

/** Move between neighbors, scrolling only when the target leaves the grid. */
export function moveGridSelection(
    index: number,
    direction: "left" | "right" | "up" | "down",
    firstColumn: number,
    columns: number,
    rows: number,
    cardCount: number,
    slots = plainSlots(cardCount)
) {
    if (!cardCount) return { index: -1, firstColumn: 0 };
    index = Math.max(0, Math.min(cardCount - 1, index));
    const position = slots.indexOf(index);
    let column = Math.floor(position / rows);
    let row = position % rows;
    const columnCount = Math.ceil(slots.length / rows);
    if (direction === "left" || direction === "right" || rows === 1) {
        const delta = direction === "left" || direction === "up" ? -1 : 1;
        column = Math.max(0, Math.min(columnCount - 1, column + delta));
    } else {
        row = Math.max(
            0,
            Math.min(rows - 1, row + (direction === "up" ? -1 : 1))
        );
    }
    const nextIndex = cardInSlot(slots, rows, column, row, cardCount);
    const start = Math.max(
        0,
        Math.min(Math.max(0, columnCount - columns), firstColumn)
    );
    return {
        index: nextIndex,
        firstColumn:
            column < start
                ? column
                : column >= start + columns
                ? column - columns + 1
                : start,
    };
}

/** Same gentle vertical-cylinder projection as the vertex shader. */
export function projectPoint(x: number, y: number, metrics: CylinderMetrics) {
    const angle = x / metrics.radius;
    const z = metrics.radius * (Math.cos(angle) - 1);
    const scale = metrics.cameraDistance / (metrics.cameraDistance - z);
    return {
        x: metrics.width / 2 + metrics.radius * Math.sin(angle) * scale,
        y: metrics.height / 2 - y * scale,
    };
}
