import CyberLoaderJson from "./json/cyber-loader.json";

import SpaceLabelJson  from "./json/spacelabel.json";

import CinematicLogoJson  from "./json/logosprite2.json";

var TYPES = {

	CYBER_LOADER : {

		json  : CyberLoaderJson,

		image : '/sprites/cyber-loader.png'
 	},

 	SPACE_LABEL : {

 		json : SpaceLabelJson,

 		image : '/sprites/label.png'
 	},


 	CINEMATIC_LOGO : {

 		json : CinematicLogoJson,

 		image : '/sprites/logosprite2.png'
 	}
}

export default TYPES