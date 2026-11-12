export async function NOTNYC_ForceSit({ playerData, mesh, player }) {
    const NYCUser = NOTNYC[playerData?.userData?.walletId];

    if (NYCUser) {
        if (
            NYCUser.slug === playerData.exhibit.info?.customLink &&
            mesh.userData.id === NYCUser.chairId
        ) {
            player.sit({
                mesh: mesh,
            });

            player.deactivated = true;

            if (!mesh?.object?.geometry?.parameters?.height) {
            }
        }
    }
}

export function NOTNYC_getUserChairId(userData) {
    const NYCUser = NOTNYC[userData?.walletId];

    if (NYCUser) {
        return NYCUser.chairId;
    }
}

export function NOTNYC_getUser(playerData) {
    const slug = playerData?.exhibit?.info?.customLink;

    const isNYCSpace = NYC_SPACES.includes(slug);

    const NYCUser = NOTNYC[playerData?.userData?.walletId];

    if ((isNYCSpace || !NYCUser?.slug) && NYCUser) {
        const isSpecialUser = !NYCUser.slug || NYCUser.slug === slug;

        if (isSpecialUser) {
            return NYCUser;
        }
    }
}

const NYC_SPACES = [
    "notnyccreators",
    "notnycgaming",
    "notnycai",
    "notnycidentity",
];

export function NOTNYC_cansit({ playerData, mesh }) {
    if (!NYC_SPACES.includes(playerData?.exhibit?.info?.customLink))
        return true;

    const NYCUser = NOTNYC[playerData?.userData?.walletId];

    if (NYCUser) {
        return (
            NYCUser.slug === playerData.exhibit.info?.customLink &&
            mesh.userData.id === NYCUser.chairId
        );
    }

    return false;
}

export const NOTNYC = {
    // "0xc17f374a2a1d23e88b2911706279596dcc749efe": {
    //     name: "Neferest",
    //     address: "0xc17f374a2a1d23e88b2911706279596dcc749efe",
    //     vrm: "notnyc_mungiscaled",
    //     role: "mod",
    //     chairId: "",
    //     slug: undefined,
    //     position: { x: 0, y: 0, z: 0 },
    //     rotation: { x: 0, y: -1.0494, z: 0 },
    // },
    "0x46bab2aae1fa10a6f19aa522558e03080311e01c": {
        name: "zhuk",
        address: "0x46bab2aae1fa10a6f19aa522558e03080311e01c",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },
    "0xdbd3ddabe5f593fedc64a7077636058bfac552fe": {
        name: "mungi",
        address: "0xdbd3ddabe5f593fedc64a7077636058bfac552fe",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },
    "0xb0de50afd36ca95377e6612662a1b91bf5441dc4": {
        name: "Georgia O'Eth",
        address: "0xb0de50afd36ca95377e6612662a1b91bf5441dc4",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0xc6a9b3826ddd065394bfbba7b118678371a823f9": {
        name: "C3",
        address: "0xc6a9b3826ddd065394bfbba7b118678371a823f9",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0xc72f40a397453051349f73cf2e2a04fac06e37a3": {
        name: "Guido",
        address: "0xc72f40a397453051349f73cf2e2a04fac06e37a3",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0x6215e708a7b61f5ed49642f692f28ba09b807725": {
        name: "Robness",
        address: "0x6215e708a7b61f5ed49642f692f28ba09b807725",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0xa924c904709671e168db129c6c56d62a8f717645": {
        name: "Lyndon",
        address: "0xa924c904709671e168db129c6c56d62a8f717645",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0x76db02500f7631d57bc2dcdca9d4cf782b99e119": {
        name: "Rayan",
        address: "0x76db02500f7631d57bc2dcdca9d4cf782b99e119",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },
    "0x0f69307e8383a6ec90056389e6b0ad47c9d9c5b1": {
        name: "Gina",
        address: "0x0f69307e8383a6ec90056389e6b0ad47c9d9c5b1",
        vrm: "notnyc_mungiscaled",
        role: "mod",
        chairId: "",
        slug: undefined,
    },

    // notnyccreators
    "0xeb1c22baacafac7836f20f684c946228401ff01c": {
        name: "Richerd",
        address: "0xeb1c22baacafac7836f20f684c946228401ff01c",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnyccreators",
        chairId: "-32.76X6.04X-133.66X0.00X1.57X0.00@f1681778896768",
        position: {
            x: -37.050285061395456,
            y: 2.8289046860849743,
            z: -153.67522489773145,
        },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x7b42a219bb14d0719757a391d7cc6aa7f371e144": {
        name: "Betty",
        address: "0x7b42a219bb14d0719757a391d7cc6aa7f371e144",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnyccreators",
        chairId:
            "-32.76X6.04X-133.66X0.00X1.57X0.00@f1681778896768168177893686016817789399101681778941415",
        position: {
            x: -37.050285061395456,
            y: 2.8289046860849743,
            z: -145.6375802259101,
        },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x808a2adbd0a3fc679e3f7cd18d4f579bfcaaec9c": {
        name: "Li Jin",
        address: "0x808a2adbd0a3fc679e3f7cd18d4f579bfcaaec9c",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnyccreators",
        chairId:
            "-32.76X6.04X-133.66X0.00X1.57X0.00@f16817788967681681778936860",
        position: {
            x: -37.050285061395456,
            y: 2.8289046860849743,
            z: -161.70532330012932,
        },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xc67c60cd6d82fcb2fc6a9a58ea62f80443e32683": {
        name: "Benoit",
        address: "0xc67c60cd6d82fcb2fc6a9a58ea62f80443e32683",
        vrm: "notnyc_scaledben",
        role: "mod",
        slug: "notnyccreators",
        chairId:
            "-32.76X6.04X-133.66X0.00X1.57X0.00@f168177889676816817789368601681778939910",
        position: {
            x: -37.050285061395456,
            y: 2.8289046860849743,
            z: -137.55881313701943,
        },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xa5d0ad68014026feee78a1fffd2a93797194750e": {
        name: "Natasha Hoskins",
        address: "0xa5d0ad68014026feee78a1fffd2a93797194750e",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnyccreators",
        chairId: "-23.77X10.25X-127.66X3.14X1.13X-3.14@f1681778839330",
        position: { x: -35.8646, y: 2.8289, z: -130.9081 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },

    // notnycgaming
    dwqdqwdqwdqwdqwd: {
        name: "Jiho",
        address: "dwqdqwdqwdqwdqwd",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycgaming",
        chairId:
            "-27.26X5.71X-135.35X3.14X1.57X-3.14@f1681779839488168177986040316817798619621681779863276",
        position: { x: -37.0503, y: 2.8289, z: -146.09125605524548 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xe0ec952c13d065ccf734a6700147c75f078db5be": {
        name: "Psych",
        address: "0xe0ec952c13d065ccf734a6700147c75f078db5be",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycgaming",
        chairId:
            "-27.26X5.71X-135.35X3.14X1.57X-3.14@f16817798394881681779860403",
        position: { x: -37.0503, y: 2.8289, z: -161.93815133059366 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x115ab9e1dbe84030719835dd3d4b74503be8921b": {
        name: "Gfunk",
        address: "0x115ab9e1dbe84030719835dd3d4b74503be8921b",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycgaming",
        chairId: "-23.15X5.71X-134.03X3.14X1.32X-3.14@f1681779811788",
        position: { x: -35.86455264330178, y: 2.8289, z: -130.90810420643618 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },

    "0x32b5be51b9b400c2fb1f28d1ff064786d0efacbc": {
        name: "hack3r",
        address: "0x32b5be51b9b400c2fb1f28d1ff064786d0efacbc",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycgaming",
        chairId:
            "-27.26X5.71X-135.35X3.14X1.57X-3.14@f168177983948816817798604031681779861962",
        position: { x: -37.0503, y: 2.8289, z: -137.78673584721673 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xe257e19a9b77230e9aa0f5ac48775b5bbde550bb": {
        name: "Josie Bellini",
        address: "0xe257e19a9b77230e9aa0f5ac48775b5bbde550bb",
        vrm: "notnyc_scaledjosie",
        role: "mod",
        slug: "notnycgaming",
        chairId: "-27.26X5.71X-135.35X3.14X1.57X-3.14@f1681779839488",
        position: { x: -37.0503, y: 2.8289, z: -154.0051495924072 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },

    // notnycai
    "0x148e2ed011a9eaaa200795f62889d68153eeacde": {
        name: "Coin Artist",
        address: "0x148e2ed011a9eaaa200795f62889d68153eeacde",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycai",
        chairId: "-3.47X2.81X-145.15X0.00X1.56X0.00@f1681870992014",
        position: { x: -40.4639, y: 9.7796, z: -161.8186 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x643369a63407525585d2c24ee75bae52d7d72eb3": {
        name: "Sasha Stiles",
        address: "0x643369a63407525585d2c24ee75bae52d7d72eb3",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycai",
        chairId: "-3.47X2.81X-145.15X0.00X1.56X0.00@f1681870988872",
        position: { x: -40.4639, y: 9.7796, z: -137.84904094675755 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x378698D858029F13f9855C42a6F6668E147Ed129": {
        name: "DCinvestor",
        address: "0x378698D858029F13f9855C42a6F6668E147Ed129",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycai",
        chairId: "-3.43X2.81X-145.15X0.00X1.56X0.00@f1681871124380",
        position: { x: -37.0503, y: 2.8289, z: -153.870641308149 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x9aaddc5040d2093dc0dafc0803cbfca822341bca": {
        name: "Claire Silver",
        address: "0x9aaddc5040d2093dc0dafc0803cbfca822341bca",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycai",
        chairId:
            "-3.43X2.81X-145.15X0.00X1.56X0.00@f16818711243801681872147167",
        position: { x: -37.0503, y: 2.8289, z: -145.93744949731587 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xb398447e51c621ed7f87c322bf1caa5f27e48feb": {
        name: "Timour",
        address: "0xb398447e51c621ed7f87c322bf1caa5f27e48feb",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycai",
        chairId: "-3.43X2.81X-145.15X0.00X1.56X0.00@f1681871096490",
        position: { x: -35.8646, y: 2.8289, z: -130.9081 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },

    // notnycidentity
    "0x0871deb34bfd2052b1c10dc4f6c0912a2a47e927": {
        name: "Bharat",
        address: "0x0871deb34bfd2052b1c10dc4f6c0912a2a47e927",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycidentity",
        chairId:
            "-25.49X4.65X-142.63X0.00X1.56X0.00@f16818704940351681870562553",
        position: { x: -35.8646, y: 2.8289, z: -130.9081 },
        rotation: { x: 0, y: -1.0494, z: 0 },
    },
    "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a": {
        name: "Jack Butcher",
        address: "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycidentity",
        chairId:
            "-25.49X4.65X-142.63X0.00X1.56X0.00@f1681870494035168187051688616818705233741681870525175",
        position: { x: -37.0503, y: 2.8289, z: -153.91166281994816 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xf21bf8f4a8ba78fbc8b118e2ecdb030078c3d3ed": {
        name: "Jon Moore",
        address: "0xf21bf8f4a8ba78fbc8b118e2ecdb030078c3d3ed",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycidentity",
        chairId:
            "-25.49X4.65X-142.63X0.00X1.56X0.00@f16818704940351681870516886",
        position: { x: -37.0503, y: 2.8289, z: -161.7837073030194 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0x701951206a1915395bb318529c0528ba82c5da43": {
        name: "Linda Adami",
        address: "0x701951206a1915395bb318529c0528ba82c5da43",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycidentity",
        chairId: "-25.49X4.65X-142.63X0.00X1.56X0.00@f1681870462767",
        position: { x: -40.4639, y: 9.7796, z: -145.8072 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
    "0xf3860788d1597cecf938424baabe976fac87dc26": {
        name: "Snowfro",
        address: "0xf3860788d1597cecf938424baabe976fac87dc26",
        vrm: "notnyc_scaledsquare",
        role: "mod",
        slug: "notnycidentity",
        chairId: "-25.49X4.65X-142.63X0.00X1.56X0.00@f1681870494035",
        position: { x: -37.0503, y: 2.8289, z: -137.7867 },
        rotation: { x: 0, y: -1.565077614925277, z: 0 },
    },
};
