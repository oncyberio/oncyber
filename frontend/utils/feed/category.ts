export const CATEGORIES = {
    popular: {
        title: "Most Popular", // Needs to be same title as tag
        key: "most-visited",
        filter: true,
        //fetchable: true,
    },
    trending: {
        title: "Trending", // Needs to be same title as tag
        key: "trending",
        filter: true,
        hidden: true,
    },
    lastModified: {
        title: "Latest", // Needs to be same title as tag
        key: "latest",
        filter: true,
        // fetchable: true,
    },
    community: {
        title: "Community", // Needs to be same title as tag
        key: "community",
        hidden: true,
        filter: true,
    },
    staffpicks: {
        title: "Staff Picks", // Needs to be same title as tag
        key: "staffpicks",
        hidden: true,
        filter: true,
    },
    recommendations: {
        title: "Recommended", // Needs to be same title as tag
        key: "recommendations",
        hidden: true,
        filter: false,
        // hideTag: true,
        nonClickable: true,
    },
    oncyberlabs: {
        title: "oncyber labs",
        key: "oncyberlabs",
        // icon: "labs",
        rooms: ["brute", "coal", "chalk", "altitude", "rtfktspacepod"],
    },
    oncybercurated: {
        title: "oncyber curated",
        key: "oncybercurated",
        // icon: "labs",
        rooms: ["temple", "genesis", "void"],
    },
    // rtfkt: {
    //     title: "RTFKT Pods",
    //     icon: "rtfkt",
    //     key: "rtfkt",
    //     hidden: true,
    //     rooms: ["rtfktspacepod", "rtfktlootpod"],
    // },
};
