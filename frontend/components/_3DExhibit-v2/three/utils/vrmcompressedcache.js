import { cloudinary } from "@utils/urlUtils"
import VRMS from "../factory/player/vrms.json"

class VRMCompressedCache {

	constructor(){
        // lod vrm (not in the list of default vrms)
		this.vrmCache = {
            "https://cyber.mypinata.cloud/ipfs/QmZVVaaYNqsZKDi3fNohAWmS3dDa4gtwu7w636TXowCdmg?filename=LOD_y6soy1.glb": "https://cyber.mypinata.cloud/ipfs/QmcdkKz1J8RCebgGVqa7TZkNUMojVxEEJsMtZS5Cns5LXh?filename=1684400720241.vrm"
        }

        Object.values( VRMS ).forEach( (vrm) => {

			const urlCompressed = vrm.urlCompressed

			if(!cloudinary.isBrokenCloudinaryUrl(urlCompressed)) {
				this.vrmCache[vrm.url] = urlCompressed
			}

        } )
		
	}

	set(name, val){

		this.vrmCache[name] = val
	}

	get(name){

		return this.vrmCache[name]
	}
}

export default new VRMCompressedCache()
