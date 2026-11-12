import { getUserByWalletId } from "@utils/saveToDb";
import { useEffect, useState } from "react";

export function useAuthorName(author) {
    const [userName, setUsername] = useState(author?.name);

    useEffect(() => {
        (async function () {
            if (!author?.name) {
                //
                const result = await getUserByWalletId(author?.id);

                if (result.success) {
                    setUsername(
                        result?.user?.username || result?.username || author?.id
                    );
                }
            } else {
                setUsername(author?.name);
            }
        })();
    }, [author]);

    return userName;
}
