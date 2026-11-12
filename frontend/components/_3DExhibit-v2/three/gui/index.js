export const POST_TYPES = {

    BLOOM : 'Bloom',

    SELECTIVE_BLOOM : 'SelectiveBloom',

    LOOK_UP_TABLE : 'LookUpTable',

    CYBERCITY     : 'CyberCity',

    SSAO : 'SSAO',

    TRIPPY : 'Trippy'
}

export const LUTMAPS = {
    hudson: {
        id: "hudson",
        name: "hudson",
        image: "/textures/luts/hudson.png",
        path: "/textures/luts/hudson.png"
    },

    kodak: {

        id: "kodak",
        name: "kodak",
        image: "/textures/luts/kodak2.png",
        path: "/textures/luts/kodak2.png"
        
    },

    sunset: {

        id: "sunset",
        name: "sunset",
        image: "/textures/luts/sunset.png",
        path: "/textures/luts/sunset.png"
        
    },
    custom: {
        id: "custom",
        name: "custom",
    },

    
};

export const POST_PROCESSINGS = {

    Bloom: {

        name  : POST_TYPES.BLOOM,

        values : {

        	threshold 	: 0.23,

        	smoothing 	: 0.59,

        	intensity 	: 1,

        	radius 		: 0.7

        }
    },

    LookUpTable: {

        name : POST_TYPES.LOOK_UP_TABLE,

        values : {

            image      : LUTMAPS.hudson

        }
    },

    CyberCity : {

        name  : POST_TYPES.CYBERCITY,

        values : {

            correctColor: 0.13,

            intensity   : 1,

            radius      : 0.87

        }
    },

    SSAO : {

        name : POST_TYPES.SSAO,

        values: {

            intensity : 0.5,

            // color: 
        }
    }
}


// export const LIGHTING = {

//     lightDirection : {

//         x: -1,
//         y: -1,
//         z: -1
//     },
//     lightPosition: {

//         x: 200,
//         y: 200,
//         z: 200
//     },
//     bias: -0.002,

//     near: 139.4,

//     far: 513,

//     intensity: 1,

//     size : 500,

//     helper: false
// }