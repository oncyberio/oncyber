var Packer = function(w, h) {
  this.init(w, h);
};

const dummy =  
{  

  textureIndex : 5, 
  fit: {
    dummy : true,
    x: 0,
    y: 0,
    w: 1024,
    h: 1024,
    used: true,
    down: {
        x: 0,
        y: 256,
        w: 1024,
        h: 768
    },
    right: {
        x: 256,
        y: 0,
        w: 768,
        h: 256
    },
  }

}

Packer.prototype = {

  init: function(w, h) {
    this.root = { x: 0, y: 0, w: w, h: h };
    this.loop = 0
    this.size=  {
        w: w,
        h: h
    }
    this.seen = {}
    this.index = 0
    this.packingNB = 0
    this.maxSize = {w: 0, h: 0}
   
  },

  reset : function(w, h){

    this.seen = {}
    this.root = { x: 0, y: 0, w: this.size.w, h: this.size.h }
    this.loop = 0
    this.index = 0
    this.packingNB = 0

    this.maxSize = {w: 0, h: 0}
    // this.root.used = false
  },

  fit: function(blocks, opts = {} ) {

    var index = 0

    var n, node, block;

    const TEXTURE_SIZE = opts.needsFitData

    for (n = 0; n < blocks.length; n++) {

      block = blocks[n];

     
      if( opts.max == null || (opts.max) >= this.loop + 1 ){

        delete block.textureIndex

        delete block.fit


        this.refit(block)

      }

      else {

         block = Object.assign(block, dummy)

         block.textureIndex = dummy.textureIndex
      }

      // console.log("max size ", block.fit.x + block.w)


      this.maxSize.w = Math.max( this.maxSize.w, block.fit.x + block.w )
      this.maxSize.h = Math.max( this.maxSize.h, block.fit.y + block.h )

      if( opts.needsFitData != null ) {

        block.uvScale = {
            x: block.w / TEXTURE_SIZE,
            y: block.h / TEXTURE_SIZE,

        }

        block.uvPos = {
            x:  block.fit.x / TEXTURE_SIZE,
            y:  block.fit.y / TEXTURE_SIZE
        }
      }
    }

    return this.loop
  },

  refit: function(block) {

      this.packingNB++

      var next = false

      var node;

      if(this.seen[block.url]){

        const seenBlock = this.seen[block.url]
        
        block.fit = Object.assign({}, seenBlock.fit)

        block.textureIndex = seenBlock.textureIndex
      }

      else {

        if (node = this.findNode(this.root, block.w, block.h))

        block.fit = this.splitNode(node, block.w, block.h);

        if( block.fit ) {


          block.textureIndex = this.loop

          this.seen[block.url] = block

        }

        else {

          // A block that can't fit on an EMPTY page can never fit: oversized,
          // or invalid dimensions (NaN/undefined/0 fail every comparison) —
          // a fresh page won't help, so recursing would overflow the stack.
          // Park it in the dummy slot like the max-pages path does. The loop
          // cap is a backstop against any other unforeseen non-termination.
          const fitsEmptyPage =
            Number.isFinite(block.w) &&
            Number.isFinite(block.h) &&
            block.w > 0 &&
            block.h > 0 &&
            block.w <= this.size.w &&
            block.h <= this.size.h

          if (!fitsEmptyPage || this.loop > 64) {

            console.error(
              "[Packer] block can never fit, using dummy slot",
              {
                url: block.url,
                name: block.name,
                w: block.w,
                h: block.h,
                loop: this.loop,
                pageSize: this.size,
                block,
              }
            )

            Object.assign(block, dummy)

            return
          }

          this.root = { x: 0, y: 0, w: this.size.w, h: this.size.h }

          this.loop++

          this.refit(block)
        }
      }
  },

  findNode: function(root, w, h) {
    if (root.used)
      return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
    else if ((w <= root.w) && (h <= root.h))
      return root;
    else
      return null;
  },

  splitNode: function(node, w, h) {
    node.used = true;
    node.down  = { x: node.x,     y: node.y + h, w: node.w,     h: node.h - h };
    node.right = { x: node.x + w, y: node.y,     w: node.w - w, h: h          };
    return node;
  }

}

export default Packer