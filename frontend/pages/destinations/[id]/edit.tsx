import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import { getDestinationBySlug } from "@utils/firestore/destinations";
import dynamic from "next/dynamic";
import { getCinematic } from "pages/api/cinematic";
import { getStylekitByRoom } from "pages/api/stylekit";

const EditDestination = dynamic(
    () => import("@features/destinations/components/EditDestination"),
    { ssr: false }
);

//
export default function UploaderEdit({
    destination,
    spline,
    stylekit,
    upload,
    error,
}) {
    //

    return (
        <EditDestination
            destination={destination}
            spline={spline}
            stylekit={stylekit}
            upload={upload}
            error={error}
        />
    );
}

export const getServerSideProps = AuthServerSidePropsLite(
    //
    async ({ query, res }, user, token) => {
        //
        const slug = query.id as string;
        const upload = query.file || null;

        //
        try {
            //

            let kitbashErr = null;

            const [destination, spline, stylekit] = await Promise.all([
                fetchDestination(slug),
                getCinematic({ slug }),
                upload == null
                    ? getStylekitByRoom(slug).catch((err) => {
                          kitbashErr = err;
                          return null;
                      })
                    : null,
            ]);

            if (destination?.params?.isFuture && !upload && kitbashErr) {
                console.error(kitbashErr);
            }

            return {
                destination: destination || null,
                spline: spline || null,
                stylekit: stylekit || null,
                upload,
            };
        } catch (err) {
            console.error(err);
            return {
                destination: null,
                spline: null,
                stylekit: null,
                upload: null,
                error: err.message || "Error fetching page data",
            };
        }
    }
);

export function checkServerError(response, defaultMsg = "Unknown Error") {
    if (!response.success) {
        throw new Error(response.error || response.message || defaultMsg);
    }
}

async function fetchDestination(slug: string) {
    // Editors must see their own just-saved changes — bypass the slug cache.
    const dest = await getDestinationBySlug(slug, { fresh: true });

    if (!dest) return null;

    const { created_at, updated_at, ...rest } = dest;

    return {
        ...rest,
        created_at: created_at?.toDate?.()?.toISOString?.() || null,
        updated_at: updated_at?.toDate?.()?.toISOString?.() || null,
    };
}
