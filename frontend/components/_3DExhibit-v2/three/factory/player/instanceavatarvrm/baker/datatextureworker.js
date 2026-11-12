import {


    DataTexture,

    RGBAFormat,

    FloatType,

    NearestFilter,

    LinearFilter,

} from 'three'

export default class DataBake extends DataTexture {

    constructor( w, h ){
 
        super( new Float32Array(w * h * 4), w, h  )

        this.format = RGBAFormat

        this.type = FloatType

        this.minFilter = NearestFilter
        this.magFilter = NearestFilter

        this.needsUpdate = true;

    }

    update(src, targetX, targetY) {
      // get the width and height of the images

    
      const sourceWidth = src.source.data.width;
      const sourceHeight = src.source.data.height;
      const targetWidth = this.source.data.width;
      const targetHeight = this.source.data.height;

      // compute the starting position of the target image within the source image
      const startX = targetX;
      const startY = targetY;

      // console.log( src, targetX, targetY)

      // overwrite the data of the target image with the data of the source image
      for (let y = 0; y < sourceHeight; y++) {
        for (let x = 0; x < sourceWidth; x++) {
          const sourceIndex = (y * sourceWidth + x) * 4;
          const targetIndex = ((startY + y) * targetWidth + (startX + x)) * 4;
          this.source.data.data[targetIndex] = src.source.data.data[sourceIndex];
          this.source.data.data[targetIndex + 1] = src.source.data.data[sourceIndex + 1];
          this.source.data.data[targetIndex + 2] = src.source.data.data[sourceIndex + 2];
          this.source.data.data[targetIndex + 3] = src.source.data.data[sourceIndex + 3];

          if( this.source.data.data[targetIndex] != 0 ) {

            // console.log('override')
          }

        }
      }

      this.needsUpdate = true
    }
}

