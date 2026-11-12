import { SpaceDiskCursor } from "./spacediskcursor"



class DiskCursorFactory {


    /**
     * @param { { roomParameters: import("@uitypes/roomParameters").RoomParameters } } opts
     */
    get(opts) {

        return new SpaceDiskCursor(opts)
    }
}

export default new DiskCursorFactory()
