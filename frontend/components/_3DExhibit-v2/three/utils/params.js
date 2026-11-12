import { IS_FRONTEND_ENV } from "@utils/isFrontend";

const FRONT_END = IS_FRONTEND_ENV;

var grabParamaters = function (url) {
    var p = {};
    var pp = document.createElement("a");
    pp.href = url;
    var q = pp.search.substring(1);
    var v = q.split("&");
    let i = 0;
    while (i < v.length) {
        var pair = v[i].split("=");
        p[pair[0]] = decodeURIComponent(pair[1]);
        i++;
    }
    return p;
};

var conf = {}

if ( FRONT_END ) {

   conf = grabParamaters(window.location.search);

   for (const property in conf) {
     if(conf[property] == "true"){
       conf[property] = true
     }
     if(conf[property] == "false"){
       conf[property] = false
     }
   }
}

export default conf