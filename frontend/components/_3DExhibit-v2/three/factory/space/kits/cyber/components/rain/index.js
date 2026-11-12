// @ts-check

import RainFactory from '@3factory/rain'

import { Component3D } from '@3factory/space/kits/abstract'
// import { getDefaultGridData } from "./data";



export class RainComponent  extends Component3D {

    static getInfo() {
        return {
            type: "rain",
            title: "Rain",
            image: "/components/rain.png",
        }
    }

    static getDefaultData() {

        // const pos  = Component3D.getInitDefaultPosition()

        return {
            id: "rain",
            kit: "cyber",
            type: "rain",
            intensity: 0.5
        }
    }

    static isSingleton() {
        return true
    }

    constructor(opts = {}) {

        super(opts)

        this.opts = opts

        this.data = opts.data

        const meta = {
          intensity: {
              type: "number",
              value: [this.data, "intensity"],
              min: 0,
              max: 1,
              step: 0.01,
              onChange:( val )=>{

                this.rain.material.uniforms.intensity.value = val

              }

          },
      }

        this.setProps(meta)
    }

    async init() {  

        this.rain = RainFactory.get( this.data )

        this.add(this.rain)
    }

    getGUI() {

        return {
            type: "group",
            children: this.props.meta,
        }
    }

    onDispose() {
        
    }

}