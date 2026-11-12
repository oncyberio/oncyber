import helper from '@3gl/utils/fbohelper.js'

import Emitter from '@3emitter'

import { FBO_DEBUG } from '@3constants'

import Renderer from '@3renderer'

import Events from  '@3events'

var FBOHelper = null


if (FBO_DEBUG) {
  
  var FBOHelper = new helper(Renderer)

  FBOHelper.setSize(window.innerWidth, window.innerHeight)

  Emitter.on(Events.RESIZE, (w, h) => {
    FBOHelper.setSize(w, h)
  })

  Emitter.on(Events.POST_UPDATE, () => {


    let older = Renderer.getRenderTarget()

    FBOHelper.update()

    Renderer.setRenderTarget(older)

  })
} else {
  FBOHelper = {
    attach: () => {},
  }
}

export default FBOHelper
