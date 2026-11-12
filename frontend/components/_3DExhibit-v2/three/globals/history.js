// @ts-check

class History {

	constructor(){

        /**
         * @type { import("@gltypes").HistoryEntry3D[] }
         */
		this.past = []
	}

    /**
     *
     * @param { import("@gltypes").World3DOptions } opts
     * @param { import("@gltypes").TeleportState } backState
     * @returns
     */
	push( opts, backState ){

        /** @type { import("@gltypes").HistoryEntry3D } */
        const entry = {

            portalData: {

                roomParameters: opts.roomParameters,

                exhibit: opts.exhibit,

                user: opts.exhibit.ownerData,
            },

            backState
        }

		this.past.push(entry)

		return this.past
	}

    /** @returns { import("@gltypes").HistoryEntry3D } */
	getLast(){

		if ( this.past.length > 0 ) {

			return this.past[ this.past.length -1 ]
		}

		return null
	}

	pop() {

		this.past.pop()

		return this.past
	}

    isEmpty() {

        return this.past.length === 0
    }
}

export default new History()
