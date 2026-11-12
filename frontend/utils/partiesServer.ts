import { socialServiceUrl, socialServiceHeaders } from "@utils/socialService";
import { ApiHttpError } from "@utils/apiAccount";

export async function partyService(
    operation: string,
    input: Record<string, any>
) {
    if (!process.env.SOCIAL_SERVICE_SECRET)
        throw new ApiHttpError(503, { error: "PARTY_SERVICE_NOT_CONFIGURED" });
    const response = await fetch(socialServiceUrl("/internal/parties"), {
        method: "POST",
        headers: socialServiceHeaders(),
        body: JSON.stringify({ ...input, operation }),
        signal: AbortSignal.timeout(20000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiHttpError(response.status, body);
    return body;
}

export function partyView(value: any, selfId: string) {
    const party = value.party;
    return {
        ...value,
        selfId,
        ...(party
            ? {
                  party: {
                      ...party,
                      ...(party.destination
                          ? {
                                destination: {
                                    ...party.destination,
                                    url: `/s@${encodeURIComponent(
                                        party.destination.experienceId
                                    )}`,
                                },
                            }
                          : {}),
                  },
              }
            : {}),
    };
}
