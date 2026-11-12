// @ts-check

export const POST_TYPES = {

    BLOOM : 'Bloom',

    SELECTIVE_BLOOM : 'SelectiveBloom',

    LOOK_UP_TABLE : 'LookUpTable',

    TRIPPY        : 'Trippy',

    CYBERCITY     : 'CyberCity'
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

        opts : {

        	threshold 	: 0.75,

        	smoothing 	: 0.29,

        	intensity 	: 0.6,

        	radius 		: 0.7,

            color       : "#ffffff"

        }
    },

    LookUpTable: {

        name : POST_TYPES.LOOK_UP_TABLE,

        opts : {

            image      : LUTMAPS.hudson,
        }
    },

    CyberCity : {

        name  : POST_TYPES.CYBERCITY,

        opts : {

            correctColor: 0.13,

            intensity   : 1,

            radius      : 0.87

        }

    },

    Trippy : {

        name : POST_TYPES.TRIPPY,

        opts : {

            speed : 0.1
        }

    }
}

//hudson, kodak, sunset

export const postprocessingPresets = [
    {
        name: "Small Bloom",
        image: "https://cyber.mypinata.cloud/ipfs/QmPNcxJrbhpmECGbtL19F1f9pNLA7bfJKXb7orPj8Q5jwv?filename=lowbloom_cvd8uf.jpg",
        data: {
            enabled: true,
            postProType: POST_TYPES.BLOOM,
            bloomOpts: POST_PROCESSINGS.Bloom.opts,
        },
    },
    {
        name: "Big Bloom",
        image: "https://cyber.mypinata.cloud/ipfs/QmeLG56nipyTXKKnUHEFrSDsGRBX8tSe8vLeFkPRWAd2rh?filename=highbloom_ixiozc.jpg",
        data: {
            enabled: true,
            postProType: POST_TYPES.BLOOM,
            bloomOpts: {
                threshold: 0.15,
                smoothing: 0.2,
                intensity: 0.3,
                radius: 0.7,
                color: "#ffffff",
            },
        },
    },
    {
        name: "Hudson",
        image: "https://cyber.mypinata.cloud/ipfs/QmeqdtFDxqM2yZ4yYNtzqknYKXdksA6RwGEnv1M7UWDxrW?filename=Hudson_zrimfh.jpg",
        data: {
            enabled: true,
            postProType: POST_TYPES.LOOK_UP_TABLE,
            lutOpts: {
                image: LUTMAPS.hudson,
            },
        },
    },
    {
        name: "Kodak",
        image: "https://cyber.mypinata.cloud/ipfs/QmatY4RGxhitLdc7JaWWcrGNAUt6MgpCyfiEwqqoDm7Fb5?filename=kodak_olwqls.jpg",
        data: {
            enabled: true,
            postProType: POST_TYPES.LOOK_UP_TABLE,
            lutOpts: {
                image: LUTMAPS.kodak,
            },
        },
    },
    {
        name: "Sunset",
        image: "https://cyber.mypinata.cloud/ipfs/QmSG2fXvQPn1tLp9G9pHoXGTsyfE7gKHVSPq6ekjLkP3e3?filename=sunset_grdof0.jpg",
        data: {
            enabled: true,
            postProType: POST_TYPES.LOOK_UP_TABLE,
            lutOpts: {
                image: LUTMAPS.sunset,
            },
        },
    },
    {
        name: "Default",
        image: "https://cyber.mypinata.cloud/ipfs/QmYLjGF768o1q4D4BudRzkLyxWzBsQjCBx4xgxmtGuiwhN?filename=Default_pznrf6.jpg",
        data: {
            enabled: false,
        },
    },
];

export function getDefaultPostProcessingData() {

    return {
        id: "postprocessing",
        kit: "cyber",
        type: "postprocessing",

        enabled: true,

        postProType: POST_TYPES.BLOOM,

        bloomOpts: POST_PROCESSINGS.Bloom.opts,

        lutOpts: POST_PROCESSINGS.LookUpTable.opts,

        cybercityOpts: POST_PROCESSINGS.CyberCity.opts,

        trippyOpts : POST_PROCESSINGS.Trippy.opts
    }
}

export function getPostProcessingDataFromRoom(room) {

    let data = getDefaultPostProcessingData()

    if (room.usePostProcessing?.enabled) {
        //
        data.enabled = true

        const { type, value } = room.usePostProcessing

        data.postProType = type

        if (type === POST_TYPES.BLOOM) {

            data.bloomOpts = structuredClone(value)
        }
        else if (type === POST_TYPES.LOOK_UP_TABLE) {

            data.lutOpts = structuredClone(value)
        }
        else if (type === POST_TYPES.CYBERCITY) {

            data.cybercityOpts = structuredClone(value)
        }
        else if (type === POST_TYPES.TRIPPY) {

            data.trippyOpts = structuredClone(value)
        }
    }

    return data
}

export function updateRoomParamsFromPostProcessingData(params, data) {

    if (data == null) {

        return
    }

    if (params.usePostProcessing == null) {

        params.usePostProcessing = {}
    }

    params.usePostProcessing.enabled = data.enabled

    params.usePostProcessing.type = data.postProType

    if (data.postProType === POST_TYPES.BLOOM) {

        params.usePostProcessing.value = structuredClone(data.bloomOpts)
    }
    else if (data.postProType === POST_TYPES.LOOK_UP_TABLE) {

        const defPath = params.usePostProcessing.value?.image?.path || LUTMAPS.hudson.path

        params.usePostProcessing.value = structuredClone(data.lutOpts)

        if (data.lutOpts.image.id == "custom" && !data.lutOpts.image.path) {

            params.usePostProcessing.value.image.path = defPath
        }
    }
    else if (data.postProType === POST_TYPES.CYBERCITY) {

        params.usePostProcessing.value = structuredClone(data.cybercityOpts)
    }

    else if ( data.postProType === POST_TYPES.TRIPPY ) {

        params.usePostProcessing.value = structuredClone(data.trippyOpts)
    }
}
