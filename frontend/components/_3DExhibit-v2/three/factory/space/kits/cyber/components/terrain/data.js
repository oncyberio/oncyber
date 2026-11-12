export const presetImages = {
    wooden: {
        id: "wooden",
        name: "Wooden",
        image: "/textures/hardwood2_diffuse 2.jpeg",
        path: "/textures/hardwood2_diffuse 2.jpeg",
        format: ".jpg",
    },
    rock: {
        id: "rock",
        name: "Rock",
        image: "/textures/rocks.jpg",
        path: "/textures/rocks.jpg",
        format: ".jpg",
    },
    grass: {
        id: "grass",
        name: "Grass",
        image: "https://cyber.mypinata.cloud/ipfs/QmfURY8crGAHcyWh5fi3iZ3QojqL5zHdKa2NbyBf6X18c2?filename=ground_grass_gen_01_mrbton.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmfURY8crGAHcyWh5fi3iZ3QojqL5zHdKa2NbyBf6X18c2?filename=ground_grass_gen_01_mrbton.jpg",
        format: ".jpg",
    },
    sand: {
        id: "sand",
        name: "Sand",
        image: "https://cyber.mypinata.cloud/ipfs/QmZAXXjPDXSfmw13HatNakNas67fY8qKTxKYvihQToYd8r?filename=beach_sand_owyhwn.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmZAXXjPDXSfmw13HatNakNas67fY8qKTxKYvihQToYd8r?filename=beach_sand_owyhwn.jpg",
        format: ".jpg",
    },
    snow: {
        id: "snow",
        name: "Snow",
        image: "https://cyber.mypinata.cloud/ipfs/QmStSrtwDyRN4f2DXRgV2h1UtjLzZu4HeCybxDsnpUWFed?filename=snow01_tybt2w.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmStSrtwDyRN4f2DXRgV2h1UtjLzZu4HeCybxDsnpUWFed?filename=snow01_tybt2w.jpg",
        format: ".jpg",
    },
    rust: {
        id: "rust",
        name: "Rust",
        image: "https://cyber.mypinata.cloud/ipfs/QmQp4HpQucZ1EQ8p94BpURfScse5bhYUB9iWMFLhS4TQYQ?filename=rustyiron_oydyj6.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmQp4HpQucZ1EQ8p94BpURfScse5bhYUB9iWMFLhS4TQYQ?filename=rustyiron_oydyj6.jpg",
        format: ".jpg",
    },
    marble: {
        id: "marble",
        name: "Marble",
        image: "https://cyber.mypinata.cloud/ipfs/QmdTcQBqSK7HgNC1osBaAuqD2NgSkVwczgWAYfQpSbpWpk?filename=whitemarble_auawpy.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmdTcQBqSK7HgNC1osBaAuqD2NgSkVwczgWAYfQpSbpWpk?filename=whitemarble_auawpy.jpg",
        format: ".jpg",
    },
    brick: {
        id: "brick",
        name: "Brick",
        image: "https://cyber.mypinata.cloud/ipfs/QmW417q8tck2knu6bAnhVdeRHmmCqfuTVcMoiKESQ34MEX?filename=redbrick_glkhyh.jpg",
        path: "https://cyber.mypinata.cloud/ipfs/QmW417q8tck2knu6bAnhVdeRHmmCqfuTVcMoiKESQ34MEX?filename=redbrick_glkhyh.jpg",
        format: ".jpg",
    },
    custom: {
        id: "custom",
        name: "Custom",
    },
}



export const textureOpts = Object.values(presetImages)


export const MODES = {

    texture: 'texture',

    shader : 'shader',

    color  : 'color'
}


export const SHADERS = {

    grid : 'grid',

    biplanar : 'biplanar'
}



export const terrainPresets = [
    {
        name: "Grid",
        image: "https://cyber.mypinata.cloud/ipfs/QmYvSrVs423L3ecKtQWoW9JUKvgSQ1Z828uK9PLgkTiPgs?filename=grid_fxyxkz.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#bbbbbb",
            noiseEnabled: false,
            definition: 100,
            seed: 4321,
            noiseDomain: 5,
            smoothCenter: 0.5,
            tiles: 20,
            collision: true,
            mode: MODES.shader,
            shader: SHADERS.grid,
            griddiv: 180,
        },
    },
    {
        name: "Mountains",
        image: "https://cyber.mypinata.cloud/ipfs/QmSDQE596wiU4Vr6D8Shmbcfkj5C4fzhjLZ6UhyJ7kFDua?filename=mountains_ntp162.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: true,
            definition: 100,
            seed: 4321,
            noiseDomain: 8.8,
            smoothCenter: 0.3,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.rock,
        },
    },
    {
        name: "Hills",
        image: "https://cyber.mypinata.cloud/ipfs/QmejGdRpmp8j5iLo3BAWZ81nTX94ErSqcuD6dq2wGJ1Jqh?filename=hills_z4pzsv.jpg",
        data: {
            scale: { x: 1000, y: 70, z: 1000 },
            color: "#ffffff",
            noiseEnabled: true,
            definition: 100,
            seed: 5208,
            noiseDomain: 2.1,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.grass,
        },
    },
    {
        name: "Desert",
        image: "https://cyber.mypinata.cloud/ipfs/QmanbXVgYmx6b6sBLBSRnN8NTZDUuYeTP7vG4hS2SLtPfM?filename=sand_qacwg1.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: true,
            definition: 100,
            seed: 44567,
            noiseDomain: 2.1,
            smoothCenter: 0,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.sand,
        },
    },
    {
        name: "Snow",
        image: "https://cyber.mypinata.cloud/ipfs/QmUZPAauY8yVKZSqTfGaYissgFbftJMhQBCBKJga7HH1G9?filename=Snow_gnnl5q.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: true,
            definition: 100,
            seed: 5208,
            noiseDomain: 3,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.snow,
        },
    },
    {
        name: "Rust",
        image: "https://cyber.mypinata.cloud/ipfs/QmQU5R1UeytYXoTh9phiVrXJdGEr7oh86shtdXebEPzA7e?filename=Rust_gatlwx.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: false,
            definition: 100,
            seed: 5208,
            noiseDomain: 2.1,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.rust,
        },
    },
    {
        name: "Marble",
        image: "https://cyber.mypinata.cloud/ipfs/QmQjEuLQ5jTN1VV9jakC4sRJMuqmprNP4SCTXWXCk3YmPU?filename=marble_avb45g.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: true,
            definition: 100,
            seed: 5208,
            noiseDomain: 2.1,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.marble,
        },
    },
    {
        name: "Brick",
        image: "https://cyber.mypinata.cloud/ipfs/QmRKzq8hKMLb2b1RRyvFELcYD3rgSbdEvcM5fuWzXu6ApT?filename=brick_1_lphpel.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#ffffff",
            noiseEnabled: false,
            definition: 100,
            seed: 5842,
            noiseDomain: 2.1,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.brick,
        },
    },
    {
        name: "Wood",
        image: "https://cyber.mypinata.cloud/ipfs/QmZjhU9dNTax4tbirBLc9GFtVALTqkQjrEG5itjYbETP7Z?filename=wood_alcvrr.jpg",
        data: {
            scale: { x: 1000, y: 150, z: 1000 },
            color: "#d9975e",
            noiseEnabled: false,
            definition: 100,
            seed: 5842,
            noiseDomain: 2.1,
            smoothCenter: 0.2,
            tiles: 90,
            collision: true,
            mode: MODES.texture,
            textureOpts: presetImages.wooden,
        },
    },
];

export function getDefaultData() {

    return {
        id: `terrain-${Date.now()}`,

        kit: "cyber",

        type: "terrain",

        position: { x: 0, y: 0, z: 0 },

        rotation: { x: 0, y: 0, z: 0 },

        scale:    { x: 1000, y: 150, z: 1000 },

        color: "#bbbbbb",

        noiseEnabled: false,

        definition: 100,

        seed : 4321,

        noiseDomain : 5,

        smoothCenter: 0.5,

        textureOpts : presetImages.wooden,

        tiles : 20,

        collision : true,

        mode: MODES.shader,

        shader : SHADERS.grid,

        griddiv  :  180,

        edgeTransition : 5,

        noTileDisplacement: 1,
        
        smoothAngle: 0.7,

        textureSideOpts : presetImages.grass,
    }
}

export function getDefaultGridTerrain() {

    const data = getDefaultData()

    data.mode = MODES.shader

    data.shader = SHADERS.grid

    data.noiseEnabled = true

    return data
}