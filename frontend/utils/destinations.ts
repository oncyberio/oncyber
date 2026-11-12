export const getSlug = (name: string): string => {
    return name.replace(/ /g, "").toLowerCase();
};

/**
 * The names a visitor sees for a destination's status. The destinations page
 * and the create flow both read them from here so they cannot drift apart.
 */
export const DESTINATION_STATUS_LABELS: Record<string, string> = {
    active: "Published",
    verified: "Ready for minting",
    submitted: "Under review",
    tested: "Testing",
    failed: "Failed",
    rejected: "Rejected",
};

/** A destination that has not reached any of the statuses above. */
export const DESTINATION_UPLOADED_LABEL = "Uploaded";

export const destinationStatusLabel = (status: string): string => {
    return Object.prototype.hasOwnProperty.call(
        DESTINATION_STATUS_LABELS,
        status
    )
        ? DESTINATION_STATUS_LABELS[status]
        : DESTINATION_UPLOADED_LABEL;
};

export const getStatus = (
    value: string,
    distributionType?: string,
    preMinted?: boolean
): string => {
    // A published community drop still waits on its creator to mint it.
    if (
        value === "active" &&
        distributionType?.trim() === "NFT Community distribution" &&
        !preMinted
    ) {
        return DESTINATION_STATUS_LABELS.verified;
    }

    return destinationStatusLabel(value);
};
