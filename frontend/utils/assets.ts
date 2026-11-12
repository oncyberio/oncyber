export function selectUserId(user): string {
    // Guest Studio has no wallet until the visitor connects one.
    if (!user) return "";
    let userId = user;

    //snowfro
    switch (userId.toLowerCase()) {
        case "0xf3860788d1597cecf938424baabe976fac87dc26":
            userId = "0xC896866E927e6F8a416Ba209976115E79fA0a66F";
            break;
        case "0x88d3574660711e03196af8a96f268697590000fa":
            userId = "0xf8be957f65e67fb0342992a51c30290d5758f880";
            break;
        case "0x7556cc553036e8e67ca77b72fca81657988de13e":
            userId = "0xe7079eec020ddfc3f1c0abe1d946c55e6ed30eb3";
            break;
        case "0xe03a5189dac8182085e4adf66281f679fff2291d":
            userId = "0x99c63b3f73d8cf8a56a4621c74d0ac5fda357f8a";
            break;
        case "0x2ebb3cf9d35e5a69419b9c9a7764f2fa4fe2b930":
            userId = "0x29f52bd05118586b6918cf735139a97f50b59a4e";
            break;
        case "0xc544d97da53aee9cc1680760538093a688bd2e47":
            userId = "0xa62da2ea9f5bb03a58174060535ae32131973178";
            break;
        case "0xfd22004806a6846ea67ad883356be810f0428793":
            userId = "0xc6400a5584db71e41b0e5dfbdc769b54b91256cd";
            break;
        case "blerdxw1lyabhhqizwpthjpr7gwuhbd9pbb12jxudr8c":
            userId = "4u3fcK5UYrfujBtcdFhXbwFCVjSLxXWHGeWVSEYbE87s";
            break;
        case "0x6f7b1295f21658b7695294c8f73bb464f2ea530e":
            userId = "0xbc49de68bcbd164574847a7ced47e7475179c76b";
            break;
        case "0xcbfce6c23285f52cda0bc8a185d09f833a14ddc9":
            userId = "0x9ec4bdf1fa30738faa83f950be25bb1b87f853dd";
            break;
        case "0x9e58bb2844eceb85adf6167316013d99b979c886":
            userId = "0x104c78d9b89684ab370ae68b1e0377e684b83b56";
            break;
        case "0x8c6f6278a20ef1fa6b3fc1912424f5e9ea13fd05":
            userId = "0x7956302fe62df98c5c7f35354a2d03eb8b160f0e";
            break;
        case "0xe54fe12e4de8160abbe9e56b9bf9b681153264fd":
            userId = "0x3852471d266d9e2222ca9fdd922bafc904dc49e5";
            break;
        // curatedxyz
        case "0x6403d0e123c9e0f73265ab3f3dfd4c8ba3599f85":
            userId = "0xC98A513970F320b11aB408C12EEF176292E227BF";
            break;
        case "0x6414258ee299b740c19a11b938afe30a373d1afd":
            userId = "0x9eedbfcffa62587fa5e17d1f556d17308c4a049a";
            break;
        case "0xe5675377efd5416a7984780ac0cc5f835ecc8acc":
            userId = "0x9EeDbFCFFA62587Fa5E17d1f556d17308C4a049a";
            break;
        case "ebaqvrbsrysu8svkl2ayzvjrhbfiu9nrpxsycjyrrla5":
            userId = "9NzGTxEy8vt37NNRQ2mmZ4iXqzWSbpFP1fLAVoNh2L5q";
            break;
        case "0xdc48c1a598790a58cc6e5056fbe1fd0b93b8ecfa":
            userId = "0x931E8194D361571cC8476b15f8cE2f6e72d593F5";
            break;
        case "0xeeec0dc13dc88d302d3f381e078d37e1880555ce":
            userId = "0xCe90a7949bb78892F159F428D0dC23a8E3584d75";
            break;
        case "tz1ltz1dsedsfae52xas9js2b9jkkvwe2vgv":
            userId = "tz1fNn9Z7wKb2SQxvaaM9insRSwS2vDUvT3u";
            break;
        case "0xdd4bad879c18916746f532b52662c44d071f0b44":
            userId = "0x8fbACd6bA681C6fa80B35c11C69A7c881a08D802";
            break;
        case "0x5e37a4406c2a987b1548df789cb330e23bd77c1d":
            userId = "0xc02a2ba6e0fffb5379f1617348239b2b26872827";
            break;
        case "0xa031aefd71a3ba12d6af033401fe176396cc031f": 
            userId = "0xd6756f7032cf147d9672968f1e27416071341a42";
            break;
        case "0x8128d8683815abef4e67d27900f84263f0f1f40d":
            // gmoney 1
            userId = "0xf0d6999725115e3ead3d927eb3329d63afaec09b";
            break;
        case "0xdadf045a6c416118ce6d33ca0fe33d743a3352f4":
            // gmoney 2
            userId = "0xCF74E42266dE87Aa1A3DFe1E1C5f46db0Ac752B2"
            break;
    }
    
    return userId;
}
