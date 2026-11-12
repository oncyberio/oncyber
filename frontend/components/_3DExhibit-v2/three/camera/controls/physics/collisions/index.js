//@ts-check


import { OctreeCollisions } from "./octreecollisions";


class Collisions {

    async get(opts) {

        let collisions = new OctreeCollisions(opts)

        await collisions.init()

        return collisions
    }
}

export default new Collisions()
