import { marketplaceProfileUrl } from "@utils/marketplaceProfile";
import { useArtworkInfo } from "../../ArtworkContext";
import { formatUser } from "../../utils";
import { Profile } from "./Profile";
import { useCyberTranslation } from "@components/context/I18nContext";

export function Creator() {
    const { asset } = useArtworkInfo();
    const { t } = useCyberTranslation();

    if (!asset.creator) return null;

    return (
        <Profile
            key={asset.creator.address}
            label={t`ART_BY`}
            url={marketplaceProfileUrl(
                asset.creator.address,
                asset.account_base_url
            )}
            user={formatUser(asset.creator)}
        />
    );
}
