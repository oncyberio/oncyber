import { FUD_SPACE_SLUG, MINT_SPACE_SLUG } from "@components/_3DExhibit-v2/ui/ControlPanel/Raffle/raffles/rtfktRaffleConstants";

import {

    CURRENT_AVATAR_MODE,

    AVATAR_MODES

} from '@3constants'

export const UPDATE_AVATAR = "UPDATE_AVATAR";

export const UPDATE_USERNAME = "UPDATE_USERNAME";

export const UPDATE_CHAT = "UPDATE_CHAT";

export const UPDATE_VRM = "UPDATE_VRM";

export const CHAT_OFFSET = 0.18;

export const USERNAME_OFFSET = 0.40;

export const USERNAME_OFFSET_X = 0.0

export const CHAT_NEARBY_RADIUS = 15;

export const STATES = {

	NAME_DISPLAY : 'name_display',

	BUBBLE_DISPLAY : 'chat_bubble_display'
}

export const DISPLACE = 0.2

export const ANIM_DURATION = 0.4

export const ANIM_EASE = 'power3.out'

const MFER_AVATAR_PICTURE = "https://cyber.mypinata.cloud/ipfs/QmTN7ytNn7DurPVg6J8s7sYFUKZFc1ZuCa3MMuebth894m?filename=finalsun_ipz0ru.png"

export var DEFAULT_PLAYER_AVATAR_PICTURE = MFER_AVATAR_PICTURE;

export function SET_DEFAULT_AVATAR_PICTURE(exhibit) {
    const wow_spaces = ["wow_patio", "wow_cave", "wow_galaxy_frame", "wow_bedroom_frame", "wow_galaxy", "wow_bedroom", "originresidence"];

    if (exhibit?.info?.customLink === "anarrowthroughhistory"
        || exhibit?.info?.customLink === "980madison"
        || exhibit?.info?.customLink === "976madison") {
        DEFAULT_PLAYER_AVATAR_PICTURE = "https://cyber.mypinata.cloud/ipfs/QmfQarzpzC79WDJpNXtmnkMCZQUnEJVhEL7TVPW7gY8TfL?filename=mf-1_085_720_hmochf.jpg"
    } else if (exhibit?.info?.room === "creadoreworkshop") {
        DEFAULT_PLAYER_AVATAR_PICTURE = "https://cyber.mypinata.cloud/ipfs/QmbgWVUkij4JBSuHmcH2YjAkdkHhe7tQi55ZfFTiQLRrDQ?filename=10168925769530204361.png"
    }  else if (exhibit?.info?.room === "creadorexpato824") {
        DEFAULT_PLAYER_AVATAR_PICTURE = "https://cyber.mypinata.cloud/ipfs/QmPCPDsELepxNAoBCDdRya4BWE8fqgJkgDN57rPDNCNtbr?filename=1016892577255002132.png"
    } else if (wow_spaces?.includes?.(exhibit?.info?.room)) {
        DEFAULT_PLAYER_AVATAR_PICTURE = "https://cyber.mypinata.cloud/ipfs/Qmbh3j48ptUaSEMUdfz1xL3aYCSKhphcUnY7U34zzhtrow?filename=women_qksitn.png"
    } else if (exhibit?.info?.room === FUD_SPACE_SLUG || exhibit?.info?.room === MINT_SPACE_SLUG) {
        DEFAULT_PLAYER_AVATAR_PICTURE = 'https://cyber.mypinata.cloud/ipfs/QmQYaRpwjz55RS2kenMzqZuSigQC32HGNi9Zw6XegNc9AU?filename=bot_btrp4c.png'
    }
}


export const VRM_MODE_HEIGHT  = 3

// export const COIN_MODE_HEIGHT = 2.4

export const GET_BASE_HEIGHT = function(){

    return VRM_MODE_HEIGHT
}

