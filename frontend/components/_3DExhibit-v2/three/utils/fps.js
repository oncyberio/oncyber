import {

    DEBUG,

    IS_DESKTOP,

    UA_RESULT
    // DESKTOP,
    // MOBIL

} from '@3constants'

class FPSCalc {

    constructor(){

        if( DEBUG ) {

            window.FPSCalc = this
        }

        this.init()
    }

    init(){

        this.sampleCount = 120

        this.frames = 0

        this.sessionFPS = []

        this.maxFPS = 0

        this.minFPS = Infinity

        this.monitorFreshRate = 0

        this.performance = 100

        this.monitorFreshRateOptions = [60, 120, 240]

        this.currentFPSArray  = []

        this.sessionFPS       = 0

        this.frame            = 0

        this.exhibitFPS       = 0

        this.exhibitFrame     = 0


    }
 

    totalled(array){

        return array.reduce((previousValue, currentValue) => previousValue + currentValue, 0)
    }

    meanAverage(array){

        return this.totalled(array) / array.length;
    }

    getSupposedRefreshRate( val ){

        let i = 0

        let r = 0

        while( i < this.monitorFreshRateOptions.length - 1 ) {

            if(val > this.monitorFreshRateOptions[i] + 10) {

                r = this.monitorFreshRateOptions[i + 1]
            }

            i++
        }

        return r
    }

    addFrame( val ){

        this.currentFPSArray.push( val )

        if( this.currentFPSArray.length > this.sampleCount ) {

            this.currentFPSArray.shift()
        }

        this.exhibitFrame++
        this.frame++

        this.sessionFPS += (val - this.sessionFPS)/this.frame;
        this.exhibitFPS += (val - this.exhibitFPS)/this.exhibitFrame;

        if(this.frame % 300 == 0 ) {

            const average = Math.floor( this.meanAverage( this.currentFPSArray ) )

            this.monitorFreshRate = Math.max( this.monitorFreshRate, this.getSupposedRefreshRate( average ) )

            this.maxFPS = Math.max( this.maxFPS, average )
            this.minFPS = Math.min( this.minFPS, average )
        }

        // console.log(this.currentFPSArray.length)
    }

    reset(){

        this.exhibitFrame = 0

        this.exhibitFPS   = this.monitorFreshRate == 0 ? 0 : this.monitorFreshRate
    }

    get(){

        const average = Math.floor( this.meanAverage( this.currentFPSArray ) )

        this.monitorFreshRate = Math.max( this.monitorFreshRate, this.getSupposedRefreshRate( average ) )
        // if(av)

        const currentPerf = Math.round(average / this.monitorFreshRate * 100)

        const newPerf     = Math.round((this.performance + currentPerf) / 2)

        this.performance = newPerf

        return {

           maxFPS           : this.maxFPS,
           minFPS           : this.minFPS, 
           monitorFreshRate : this.monitorFreshRate,
           currentFps       : average,
           sessionFPS       : this.sessionFPS,
           exhibitFPS       : this.exhibitFPS,
           deviceType       : IS_DESKTOP ? 'desktop' : 'phone',
           browser          : UA_RESULT.browser,
           os               : UA_RESULT.os,
           cpu              : UA_RESULT.cpu,
           gpu              : UA_RESULT.gpu,
           score            : newPerf
        }

    }
}

export default new FPSCalc()