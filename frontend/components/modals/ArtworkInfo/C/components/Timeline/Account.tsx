import { Account as EventAccount } from "@dapp/types/AssetEvent";
import { useProfile } from "@hooks/useProfile";
import styled from "styled-components";

function formatAccountId(id: string) {
    if (id.length < 12) return id;

    const end = id.length;

    return `${id.slice(0, 5)}...${id.slice(end - 4, end)}`;
}

export interface AccountProps {
    account: EventAccount;
}

export function Account({ account }: AccountProps) {
    const profile = useProfile({
        id: account?.address?.toLowerCase(),
    });

    return (
        <Container>
            {profile?.username ||
                account?.username ||
                formatAccountId(account?.address || "")}
        </Container>
    );
}

const Container = styled.div`
    font-weight: 500;
`;
