import { UserContext } from "@components/context/UserContext";
import { useContext, useEffect, useState } from "react";

export function useValidatedAccounts() {
    const { user, accounts } = useContext(UserContext);

    const [validatedAccounts, setValidatedAccounts] = useState<string[]>([]);

    useEffect(() => {
        async function validateStoredAccounts() {
            // Remove the current user from the list of accounts
            const { [user.id]: currentUser, ...rest } = accounts;

            console.log(accounts);

            const response = await fetch(`/api/user/validateAll`, {
                credentials: "include",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    accounts: rest,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setValidatedAccounts(data.validatedAccounts);

                console.log("validate accounts", data.validatedAccounts);
            }
        }

        validateStoredAccounts();
        //
    }, [accounts]);

    return validatedAccounts;
}
