import { Experience } from "../../../@types/experience";

export const RTFKT_SNEAKER_ROOM_SLUG = "rtfktlootpod";
export const RTFKT_SPACEPOD_ROOM_SLUG = "rtfktspacepod";

export const RTFKT_PORTAL_ID = "Portal_Preview_001";

export const RTFKT_IS_RTFKT_ROOM = (exhibit) =>
    exhibit.info.room === RTFKT_SPACEPOD_ROOM_SLUG ||
    exhibit.info.room === RTFKT_SNEAKER_ROOM_SLUG;

export const RTFKT_getSpacesToConnect = (
    user,
    currentExhibit,
    exhibits: Experience[]
) => {
    if (
        currentExhibit?.info?.room !== RTFKT_SPACEPOD_ROOM_SLUG &&
        currentExhibit?.info?.room !== RTFKT_SNEAKER_ROOM_SLUG
    )
        return [];

    return exhibits.filter((exhibit) => {
        //! User can't connect his collabs
        if (user?.id?.toLowerCase?.() !== exhibit?.owner?.toLowerCase?.())
            return false;

        if (
            currentExhibit.info.room === RTFKT_SPACEPOD_ROOM_SLUG &&
            exhibit?.info?.room !== RTFKT_SNEAKER_ROOM_SLUG
        )
            return false;

        if (
            currentExhibit.info.room === RTFKT_SNEAKER_ROOM_SLUG &&
            exhibit?.info?.room !== RTFKT_SPACEPOD_ROOM_SLUG
        )
            return false;

        // if (exhibit.portals) return false;

        return true;
    });
};

export const rtfkt3dModels = {
    "0x11708dc8a3ea69020f520c81250abb191b190110": {
        "Cryptokicks iRL “BLACKOUT” ⚫️":"https://cyber.mypinata.cloud/ipfs/QmeHDwHj8Rnhwsb1vUs1xHcmSY1Tb6no992kM2kHJYRMjQ?filename=c_irl_blackout_pbyxhh.glb",
        "Cryptokicks iRL “SPACE MATTER” 👾":"https://cyber.mypinata.cloud/ipfs/QmPtt2nfLsmicf2rHWGrWyDLsCaZwVa9VYwMXZg6Us5wYs?filename=c_irl_spacematter_fzcj9l.glb",
        "Cryptokicks iRL “ICE” 🥶":"https://cyber.mypinata.cloud/ipfs/QmVWsU9NeajDqMcecn6M1FjUChyFox4Y6PfSnrzfAnGbZX?filename=c_irl_icemag_zb6tal.glb",
        "Cryptokicks iRL “STONE” 🪨":"https://cyber.mypinata.cloud/ipfs/QmUQX2wzTJmUJhXCir4rAFkMtm8uX6dh3HFKAhEVGTcc3a?filename=c_irl_stone_bt2fxv.glb",
    },
    "0xa4ea8b820aabc2569ce42a88252a36a51103d0b1": {
        "RTFKT x D.O.A.F AR 🏈 Helmet":"https://cyber.mypinata.cloud/ipfs/QmNQ8XEQHV5unFGQi22cBsdkZDwirVuVYLMUsQ1MLhqooJ?filename=duck_helmet_efzwki.glb"
    },
    "0x4fb48c4da0a633aa9de199ad43bf70e316310541": {
        "SKIN VIAL 🧪 EVO RPTL":"https://cyber.mypinata.cloud/ipfs/QmYhMbx6Ch5H6dNwSVktRU7hQmurcGj3smf82sxfT7qovR?filename=vial_reptile_fj7e0d.glb",
        "SKIN VIAL 🧪 EVO HMN":"https://cyber.mypinata.cloud/ipfs/QmTWu68ZnV33XhBoReRYyPVBErhQQGeUi9sEDqDPpNGJSz?filename=vial_human_kffjlo.glb",
        "SKIN VIAL 🧪 EVO RBOT":"https://cyber.mypinata.cloud/ipfs/QmSvtpz6kDvK61jRY8w4D7RWB6MHNdH9rUwvYRySLKYGfx?filename=vial_robot_pesoam.glb",
        "SKIN VIAL 🧪 EVO UNDD":"https://cyber.mypinata.cloud/ipfs/QmVc11zMMUt7qbRFaaDboqTeqkWzPnAvUpjvZUeVJV3fgU?filename=vial_undead_qgec0l.glb",
        "SKIN VIAL 🧪 EVO ANGL":"https://cyber.mypinata.cloud/ipfs/QmYkn7BWWe3NU31qV3GpunmVkESnfT6xPviF9EUwcKiL8M?filename=vial_angel_giqwpy.glb",
        "SKIN VIAL 🧪 EVO DMN":"https://cyber.mypinata.cloud/ipfs/QmZbwMnMbrmSaPXNZKZJPxPYp9DGCJoPyqaLRjc2fzK1uW?filename=vial_demon_kf9xr0.glb",
        "SKIN VIAL 🧪 EVO ALN":"https://cyber.mypinata.cloud/ipfs/QmXzs5CWsyksZ1KMiQbBbNcoTieSyQPrySekLFSZLi8ukD?filename=vial_alien_bbegok.glb",
        "SKIN VIAL 🧪 EVO TM":"https://cyber.mypinata.cloud/ipfs/QmbCpSvL9Ak9awXYBucZGktWUjAiUr6eAnkseNL54rAfLo?filename=vial_murakami_afinxb.glb",
    },
    "0x9a06ef3a841316a9e2c1c93b9c21a7342abe484f": {
        "SKIN VIAL 🧪 EVO RPTL":"https://cyber.mypinata.cloud/ipfs/QmYhMbx6Ch5H6dNwSVktRU7hQmurcGj3smf82sxfT7qovR?filename=vial_reptile_fj7e0d.glb",
        "SKIN VIAL 🧪 EVO HMN":"https://cyber.mypinata.cloud/ipfs/QmTWu68ZnV33XhBoReRYyPVBErhQQGeUi9sEDqDPpNGJSz?filename=vial_human_kffjlo.glb",
        "SKIN VIAL 🧪 EVO RBOT":"https://cyber.mypinata.cloud/ipfs/QmSvtpz6kDvK61jRY8w4D7RWB6MHNdH9rUwvYRySLKYGfx?filename=vial_robot_pesoam.glb",
        "SKIN VIAL 🧪 EVO UNDD":"https://cyber.mypinata.cloud/ipfs/QmVc11zMMUt7qbRFaaDboqTeqkWzPnAvUpjvZUeVJV3fgU?filename=vial_undead_qgec0l.glb",
        "SKIN VIAL 🧪 EVO ANGL":"https://cyber.mypinata.cloud/ipfs/QmYkn7BWWe3NU31qV3GpunmVkESnfT6xPviF9EUwcKiL8M?filename=vial_angel_giqwpy.glb",
        "SKIN VIAL 🧪 EVO DMN":"https://cyber.mypinata.cloud/ipfs/QmZbwMnMbrmSaPXNZKZJPxPYp9DGCJoPyqaLRjc2fzK1uW?filename=vial_demon_kf9xr0.glb",
        "SKIN VIAL 🧪 EVO ALN":"https://cyber.mypinata.cloud/ipfs/QmXzs5CWsyksZ1KMiQbBbNcoTieSyQPrySekLFSZLi8ukD?filename=vial_alien_bbegok.glb",
        "SKIN VIAL 🧪 EVO TM":"https://cyber.mypinata.cloud/ipfs/QmbCpSvL9Ak9awXYBucZGktWUjAiUr6eAnkseNL54rAfLo?filename=vial_murakami_afinxb.glb",
    },
    "0xf661d58cfe893993b11d53d11148c4650590c692": {
        "RTFKT x Nike Dunk Genesis CRYPTOKICKS":"https://cyber.mypinata.cloud/ipfs/QmYnSaUQcxQwdfyyFpZRkhu8GQ7f547fuNJzA6aAkjqQku?filename=dunk_lowpoly_zde22v.glb"
    },
    "0xa49a0e5ef83cf89ac8aae182f22e6464b229efc8": {
        "RTFKT x Nike Air Force 1 - Genesis 🧬":"https://cyber.mypinata.cloud/ipfs/QmfVsh5AZ2KVVDQ3BvBhYW258eKrvbU6kcq4sJbf99wV8r?filename=M_rigged_CloneX_AF1_mwalan.glb",
        "RTFKT x Nike Air Force 1 - Angel 😇":"https://cyber.mypinata.cloud/ipfs/QmNyJEyFKHeGm4SJG1yqK7Z4otDWXfkFZ1oTEzNnbU5e81?filename=M_rigged_Angel_AF1_fp2m6r.glb",
        "RTFKT x Nike Air Force 1 - Alien 👽":"https://cyber.mypinata.cloud/ipfs/QmRNzUDbLydxUoo2tGLUEJSyXbhDJMfr5q74fLzboTAXLX?filename=M_rigged_Alien_AF1_rllpor.glb",
        "RTFKT x Nike Air Force 1 - Robot 🤖":"https://cyber.mypinata.cloud/ipfs/QmUyEbzVwLyEzy9JQ56SdkKkwNYVsRR9JdboFnHiXVfosS?filename=M_rigged_Robot_AF1_dp89ag.glb",
        "RTFKT x Nike Air Force 1 - Human 🖐":"https://cyber.mypinata.cloud/ipfs/QmVGeeqqMaugbXZXKsjsPWn7YNdWRi5dKN67S8wER3RFhb?filename=M_rigged_Human_AF1_zypfev.glb",
        "RTFKT x Nike Air Force 1 - Undead ☠️":"https://cyber.mypinata.cloud/ipfs/QmYvsiRsWQHbZrGFe5yJQwJCdf1kXQJR8GfsMh9Ngd32fo?filename=M_rigged_Undead_AF1_nvfzec.glb",
        "RTFKT x Nike Air Force 1 - Demon 😈":"https://cyber.mypinata.cloud/ipfs/QmcSQLnzdyhcmRiJmkimJmq82kEcE5xrdkR3g8PWdQMpT2?filename=M_rigged_Demon_AF1_zpyrbf.glb",
        "RTFKT x Nike Air Force 1 - Murakami DNA 🌸":"https://cyber.mypinata.cloud/ipfs/QmeM74GoRtbMZMk2t9xNnb7SPXPmWzsA2PWTozn3N8vFBX?filename=M_rigged_Murakami_DNA_AF1_tvycwq.glb",
        "RTFKT x Nike Air Force 1 - Murakami Drip 🌸💧":"https://cyber.mypinata.cloud/ipfs/QmXuteTHBfWJvcE26f3d9459gSG8TCgvMePK5NTwX9ADaB?filename=M_rigged_Murakami_Drip_AF1_a3j29w.glb",
        "RTFKT x Nike Air Force 1 - Reptile 🦎":"https://cyber.mypinata.cloud/ipfs/QmSqZ4zc98QPR5XYBsdtZuf5Jv9QWZtUarUKxCmM5pVKDB?filename=M_rigged_Reptile_AF1_xds37g.glb",
    },
    "0x029af5c555807c2b5d337478e5f895e8f3b557e2": {
        "RTFKT Space Drip x Nike Air Force 1 : ARNO KISS":"https://cyber.mypinata.cloud/ipfs/QmV8QRAn5Hhr3bsNFnLW7XRhFQwLjauPDqGcQdJQdEWW3m?filename=M_rigged_Arno_Space_Drip_AF1_1_gpk1rg.glb",
        "RTFKT Space Drip x Nike Air Force 1 : JASTI":"https://cyber.mypinata.cloud/ipfs/QmShDTxXi7gMH5MUx5a5ptqqx9qP8YaF3oUqZX4z1MbrFU?filename=M_rigged_Jasti_Space_Drip_AF1_archtq.glb",
        "RTFKT Space Drip x Nike Air Force 1 : JONATHAN WOLFE":"https://cyber.mypinata.cloud/ipfs/QmZXmiGx8hn7gH2uZuV62G5mcsLjVdnyoLDDKhvLpShz17?filename=M_rigged_Wolfe_Space_Drip_AF1_x63qzf.glb",
        "RTFKT Space Drip x Nike Air Force 1 : SEAN WILLIAMS":"https://cyber.mypinata.cloud/ipfs/QmbN725A3L8f7rTjTuvz8G4RKxuHiErDpUM7sVgQ3DEshX?filename=M_rigged_Sean_Space_Drip_AF1_wx9dnl.glb",
        "RTFKT Space Drip x Nike Air Force 1 : PETIO":"https://cyber.mypinata.cloud/ipfs/QmNvLMJqwW2UonyvcASmDmysc7qUYhUvjnxH8FhJ2R978S?filename=M_rigged_Petio_Space_Drip_AF1_waoml3.glb",
        "RTFKT Space Drip x Nike Air Force 1 : ZAID KIRDSEY":"https://cyber.mypinata.cloud/ipfs/QmazjjkNfR9Bnbwf98Rx9w8YEbJZbMsk6PtZbptjjQjxT9?filename=M_rigged_Zaid_Space_Drip_AF1_yz93jy.glb",
        "RTFKT Space Drip x Nike Air Force 1 : Viii":"https://cyber.mypinata.cloud/ipfs/QmRLbC7LqqAvg3k4vG3ajcNHvPRSDupAjuLFJmQEza22Wv?filename=M_rigged_Viii_Space_Drip_AF1_cix2vs.glb",
        "RTFKT Space Drip x Nike Air Force 1 : ZWIST":"https://cyber.mypinata.cloud/ipfs/QmNexXboRZNrAhMM1TztMb1MuavGXz7hrQskZg5CVURnH3?filename=M_rigged_Zwist_Space_Drip_AF1_lvzeuv.glb",
        "RTFKT Space Drip x Nike Air Force 1 : ODIOUS":"https://cyber.mypinata.cloud/ipfs/QmPdokJ7nRNvvGL2eh5zrpvsKdGCNGEz39La4SeP3g78sp?filename=M_rigged_Odious_Space_Drip_AF1_jchz7n.glb",
        "RTFKT Space Drip x Nike Air Force 1 : DEFACED":"https://cyber.mypinata.cloud/ipfs/QmduUEv93qPUDnLFBVbJuHEKsXmMjbweLhoKWD7egWK7vh?filename=M_rigged_Defaced_Space_Drip_AF1_crjfvf.glb",
        "RTFKT Space Drip x Nike Air Force 1 : CLEGFX":"https://cyber.mypinata.cloud/ipfs/QmbQjkRwxiXwoKf9aJni1RKoNWjeNtFLYvAQYn2RF9B2LE?filename=M_rigged_Clegfx_Space_Drip_AF1_tzlmog.glb",
        "RTFKT Space Drip x Nike Air Force 1 : EQUINOZ":"https://cyber.mypinata.cloud/ipfs/QmStRN6QCGqVf3m2J7JmQe4YXZjie2wPZLywizqi2Z9J8S?filename=M_rigged_Equinoz_Space_Drip_AF1_stfqhh.glb",
        "RTFKT Space Drip x Nike Air Force 1 : LOOPIFY":"https://cyber.mypinata.cloud/ipfs/QmbTuwjxVLhZR6LHyQSySURafCywdaSJBYJp5hKfc5osBp?filename=M_rigged_Loopify_Space_Drip_AF1_uienka.glb",
        "RTFKT Space Drip x Nike Air Force 1 : DELADESO":"https://cyber.mypinata.cloud/ipfs/QmRSkCftaSDuMjDddDoJHBcC644bXsyXzhmQNPFhL7HC7a?filename=M_rigged_RichieDeladeso_Space_Drip_AF1_vwsps1.glb",
        "RTFKT Space Drip x Nike Air Force 1 : MGXS":"https://cyber.mypinata.cloud/ipfs/QmPBqBEraGpmKzyjzNCzUcxDdUGJ3iTTfATSRUC34Xet66?filename=M_rigged_MgxsFernando_Space_Drip_AF1_kvochb.glb",
        "RTFKT Space Drip x Nike Air Force 1 : CORY VAN LEW":"https://cyber.mypinata.cloud/ipfs/QmNYWmtvjdtJz6GP8Lv1BxiSECjHHpBpGu1rCDd75MUn8u?filename=M_rigged_CoryVanLew_Space_Drip_AF1_a7ltvt.glb",
        "RTFKT Space Drip x Nike Air Force 1 : PARIS HILTON":"https://cyber.mypinata.cloud/ipfs/QmWh1wN4JA5EE74FL1ykdRx3eczSbo77hRQ1veDw91pKJR?filename=M_rigged_ParisHilton_Space_Drip_AF1_p5fvty.glb",
        "RTFKT Space Drip x Nike Air Force 1 : ERIC LEFAURE":"https://cyber.mypinata.cloud/ipfs/QmfF8om5ukzSu9Nu2Vbm1fX6zXbEsrJuBkyxi27wpHTmya?filename=M_rigged_EricLafaure_Space_Drip_AF1_r6s7ru.glb",
        "RTFKT Space Drip x Nike Air Force 1 : BEN MAURO":"https://cyber.mypinata.cloud/ipfs/QmXok7sEj1QS9qCupreJocREWNzhUdy6zSbdBgaxnEiVNs?filename=M_rigged_BenMauro_Space_Drip_AF1_mg5tk4.glb",
    },
    "0x1bb6edf7b129967d512086fbdf489ed659580916": {
        "RTFKT x NIKE AR HOODIE  🕊✔️":"https://cyber.mypinata.cloud/ipfs/QmdZ9giXiqScvwgsfG6PMtFHB4jVAEERzbg1NTDELrdQPV?filename=ar_hoodie_lp_icsneh.glb"
    },
    "0x212590b0dac9502e0591b79db4cedeb6356dcc36": {
        "[UNFORGED] RTFKT x NIKE AR HOODIE  🕊✔️":"https://cyber.mypinata.cloud/ipfs/QmdZ9giXiqScvwgsfG6PMtFHB4jVAEERzbg1NTDELrdQPV?filename=ar_hoodie_lp_icsneh.glb"
    },
    "0x6c410cf0b8c113dc6a7641b431390b11d5515082": {
        "RTFKT Animus Egg 🥚":"https://cyber.mypinata.cloud/ipfs/QmNP1P1PQhfTgD3gyUZJgxvsj4g2bbfXya2EMyFNSqCu3U?filename=animus_egg_xafjyj.glb"
    },
    "0x56a67d475ded20f1120d6377988ae12992888ac4":{
        "RTFKT MNLTH X 🗿": "https://cyber.mypinata.cloud/ipfs/QmUHc2d3Cm2qJLzsjeWzgYr9fPcAxy7aYaWDdfp91HqrDG?filename=mnlth3_zph5hi.glb"
    }
}