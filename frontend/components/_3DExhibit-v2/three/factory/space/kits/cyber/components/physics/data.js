// @ts-check

export const physicsPresets = [
    {
        name: "Default",
        image: "https://cyber.mypinata.cloud/ipfs/QmbAKUdKxvWuyhLAaLc9C5iN3ydV45nAkJfuxm8ssHxtRR?filename=slow_i6y45n.jpg",
        data: {
            gravity: 15,
            playerSpeed: 70,
            jump: 8,
        },
    },
    {
        name: "Moon",
        image: "https://cyber.mypinata.cloud/ipfs/QmVQFAm7SAQ2CUFwQ4NrbhS1sidjUjwfQBhPwgA1WTPMY9?filename=Moon_qpvbm9.jpg",
        data: {
            gravity: 5,
            playerSpeed: 70,
            jump: 15,
        },
    },
    {
        name: "Fast",
        image: "https://cyber.mypinata.cloud/ipfs/QmQPztaCPHCSSwqhEqRm8zj2Vnx4A53DDNbQpyxGv4i8iJ?filename=fast_1_smoeaz.jpg",
        data: {
            gravity: 20,
            playerSpeed: 150,
            jump: 10,
        },
    },
];

export function getDefaultPhysicsData() {

    return {
        id: "physics",
        kit: "cyber",
        type: "physics",
        gravity: 15,
        playerSpeed: 70,
        jump: 8,
        quidditch: false,
    }
}

export function getPhysicsDataFromRoom(room) {

    let data = getDefaultPhysicsData()

    data.gravity = room.gravity
    data.playerSpeed = room.playerSpeed
    data.jump = room.jump
    data.quidditch = room.quidditch

    return data
}

export function updateRoomParamsFromPhysicsData(params, data) {

    if (data == null) {

        return
    }

    const { id, kit, type, ...opts } = data

    Object.assign(params, opts)
}
