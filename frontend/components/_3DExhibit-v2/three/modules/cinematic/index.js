import SplineEditor from './splines/editor'

import Scene   from '@3scene'

import {

	DEBUG,

	IS_RECORDING,

	WEB_CODECS,

	RECORD_END,

	SET_IS_RECORDING,

	CURRENT_SPACE,

	CANVAS,

    CURRENT_USER,

    CINEMATIC,

    ERROR_CODES

} from '@3constants'

import { nodeEnv } from "@env";

import Events from '@3events'

import Camera from '@3camera'

import Emitter from '@3emitter'

import EditCinematicCamera from '@3cameras/editcinematic.js'

import CinematicCamera from '@3cameras/cinematic.js'

import Composer from './composer'

import Root from "@3gl/root"

import {

	LAYOUT_CURRENT

} from './composer/constants.js'

import {

	CameraHelper

} from 'three'

import gsap from 'gsap'

import CustomEase from "gsap/CustomEase"

import Curve from './splines/curve.js'

import DummyData from './data.json'

/** How a call to record() ended. A failed recording rejects instead. */
export const RECORD_STATUS = {

	DONE: 'done',

	CANCELLED: 'cancelled',

	FAILED: 'failed',

	BUSY: 'busy'
}

class Cinematic {

	constructor(){

		if ( DEBUG ) {

			window.cinematic = this
		}

		this.currentSplineID = 0

		this.curves = []

		this.recordRequested = false

		// the recording under way: see record()
		this.recording = null

		// settles when the recorder last stopped has handed the scene back
		this.recorderStopped = null

		this.splines = []

		this.displaycamera 	= CinematicCamera

		this.editcamera 	= EditCinematicCamera

		this._duration 		= 0

		this._progression 	= 0

		this._active = false

		this.composerActive = true

		this.composer = Composer

		this.advanced = CINEMATIC == true

		this.requestPlay = false

	}

	async init( edit = false, opts ){

		if ( opts.advanced == true ) {

			this.advanced = true
		}

		await this.fetch()

		await Composer.init( opts )

		await this.load()

		this.createEditor()

		await this.initRecorder()

		this.edit = false

		if( this.advanced == true ) {

			await this.addGui()

		}
	}

	async initRecorder(){

		if( WEB_CODECS && this.recorder == null ) {

			this.recorder =  (await import('@3modules/recorder')).default
		}
	}


	createEditor(){

		this.splineEditor = new SplineEditor()

		this.splineEditor.visible = CINEMATIC

		this.splineEditor.loadCurves( this.curves )

		this.updateEvent = this.update.bind(this)

		this.splineEditor.on('reload', this.update.bind(this))

		this.splineEditor.on('selection', this.selection.bind(this))

		this.alignView()
	}

	selection(){

		this.alignView()
	}

	alignView(){

		let select = this.splineEditor.getSelection()

		this.editcamera.position.copy( select.position )

		this.editcamera.lookAt(select.lookAt)

	}

	async fetch(){

		console.log(  CURRENT_SPACE.cinematic )
		console.log(  CURRENT_SPACE.cinematic )
		console.log(  CURRENT_SPACE.cinematic )
		console.log(  CURRENT_SPACE.cinematic )
		console.log(  CURRENT_SPACE.cinematic )
		console.log(  CURRENT_SPACE.cinematic )

        if( CURRENT_SPACE?.cinematic?.export  && CURRENT_SPACE?.cinematic?.export.length > 0 ){

        	this.data = {

        		export : CURRENT_SPACE.cinematic.export.slice(0)
        	}
        }

        else {

        	this.data = JSON.parse( JSON.stringify( DummyData ) )
        }
	}

	load(){

		let i = 0

		while( i < this.data.export.length ) {

			this.loadCurve(this.data.export[i])

			i++
		}

		this._duration = this.data.export[0].duration
	}

	loadCurve( entry ){

		this.curves.push(

			{
				position 	: new Curve('position', entry.position ),

				lookAt 		: new Curve('lookat',   entry.lookat 	),

				duration 	: entry.duration
			}
		)

	}

	addSpline(){

		let lastIndex = this.data.export.length - 1

		let copiedEntry = Object.assign({}, this.data.export[ lastIndex ])

		this.data.export.push( copiedEntry )

		lastIndex = this.data.export.length - 1

		this.loadCurve( this.data.export[ lastIndex ])

		this._duration = this.data.export[ lastIndex ].duration

		if( this.splineEditor ) {

			this.splineEditor.loadCurve( this.curves[ lastIndex ] )
		}

		this.currentSplineID = this.data.export.length - 1

		if( this.advanced ) {

			this.updateSplineSelector()

		}


		this.selectSpline( lastIndex )

		if( this.splineEditor ) {

			this.splineEditor.updateSelectionGui( 0 )
		}

		this.alignView()
	}

	removeSpline( force = false ){

		if ( this.curves.length == 1 && force == false ){

			return
		}



		this.data.export.splice( this.currentSplineID , 1 )

		let curves = this.curves[ this.currentSplineID ]



		// if( curves != null ) {

		if( this.splineEditor ) {

			this.splineEditor.removeCurve( this.currentSplineID )
		}

		curves.position.dispose()

		curves.position = null

		curves.lookAt.dispose()

		curves.lookAt = null



		this.curves.splice( this.currentSplineID , 1 )

		this.currentSplineID = this.currentSplineID == 0 ? 0 : this.currentSplineID - 1

		this.updateSplineSelector()


		if( this.curves.length > 0 ) {

			this.selectSpline( this.currentSplineID )
		}
		// }

	}

	async download(){

		this.recorder.download()
	}

	/**
	 * Records the cinematic to a video. A recording ends in one of three
	 * ways, and the caller is told which:
	 *
	 * - done: resolves with { status: 'done' }
	 * - cancelled by cancel(): resolves with { status: 'cancelled' }
	 * - failed: rejects with the error
	 *
	 * In all three the recording flags are cleared and the camera, the
	 * composer and the scene are handed back. A call made while another
	 * recording is under way does nothing and resolves with
	 * { status: 'busy' }.
	 *
	 * One case is left pending on purpose: dispose(), see endRecording().
	 */
	async record( opts = {} ){

		if( this.recording != null ) {

			console.warn('already recording')

			return { status: RECORD_STATUS.BUSY }
		}

		const recording = { over: false }

		const result = new Promise(( resolve, reject )=>{

			recording.resolve = resolve

			recording.reject = reject
		})

		// set before the first await, so that cancel() ends a recording
		// that is still loading its recorder
		this.recording = recording

		this.recordRequested = true

		this.requestPlay = true

		this.runRecording( recording, opts ).then(

			()=> this.endRecording( recording, RECORD_STATUS.DONE ),

			( err )=> this.endRecording( recording, RECORD_STATUS.FAILED, err )
		)

		return result
	}

	async runRecording( recording, opts ){

		if( IS_RECORDING ) {

			// a recorder left running without a recording
			this.recorderStopped = this.stopRecorder()
		}

		// the recording before this one has handed the scene back
		await this.recorderStopped

		await this.initRecorder()

		if( recording.over ) return

		if( this.recorder == null ) {

			throw new Error('cannot record, webcodec are not in the browser')
		}

		recording.oldComposerActive = Composer.active

		Composer.active = true

		recording.oldEdit = this.edit

		this.edit = false

		recording.viewTaken = true

		await this.play({

			...opts,

			record: true,

			recording,

			callback: ( frame )=> this.onRecordFrame( recording, opts.callback, frame )
		})
	}

	/**
	 * The recorder reports each frame, and the finished video, here.
	 */
	onRecordFrame( recording, callback, frame ){

		if( recording.over ) {

			// the recorder got going after its recording had ended: it was
			// still creating its encoder when it was stopped. Stop it again.
			this.recorderStopped = this.stopRecorder()

			return
		}

		try {

			callback?.( frame )
		}
		catch( err ){

			// the recorder would stop here without a word, still recording
			this.endRecording( recording, RECORD_STATUS.FAILED, err )
		}
	}

	/**
	 * The one way a recording ends, whatever ended it. Clears the recording
	 * flags, stops the recorder unless it has finished by itself, hands the
	 * camera and the composer back, then settles record().
	 *
	 * `leaving` is for dispose(). The camera is not handed back, because the
	 * app is switching to another one. And record() is left pending: its
	 * caller is the transition into the cinematic state, and letting that
	 * transition complete now would mark the app as being in the cinematic
	 * state after it has left it.
	 */
	endRecording( recording, status, err = null, leaving = false ){

		if( recording.over ) return

		recording.over = true

		if( this.recording === recording ) {

			this.recording = null
		}

		this.recordRequested = false

		this.requestPlay = false

		try {

			if( status !== RECORD_STATUS.DONE ) {

				this.recorderStopped = this.stopRecorder()

				Composer.reset()

				this.stop()
			}

			if( recording.viewTaken ) {

				if( leaving == false ) {

					this.edit = recording.oldEdit
				}

				Composer.active = recording.oldComposerActive
			}
		}
		catch( teardownErr ){

			// record() settles all the same
			console.error( teardownErr )
		}

		if( leaving ) return

		if( status === RECORD_STATUS.FAILED ) {

			recording.reject( err )
		}
		else {

			recording.resolve({ status })
		}
	}

	/**
	 * Stops the recorder: the recording flag is cleared and the scene gets
	 * its size, its pixel ratio and its render loop back. Never rejects.
	 */
	async stopRecorder(){

		const recorder = this.recorder

		if( recorder == null ) return

		try {

			await recorder.stop()
		}
		catch( err ){

			console.error( err )

			try {

				// stop() gave up while ending its encoder, before it handed
				// the scene back: without the encoder it goes through
				recorder.encoder = null

				await recorder.stop()
			}
			catch( err ){

				console.error( err )

				SET_IS_RECORDING( false )
			}
		}
	}

	async recordAll(){

		await this.record({playAll : true})
	}

	pause(){

		if(this.tween){

			this.tween.pause()
		}
	}

	stop(){

		this.currentSplineID = 0

		this.progression = 0

		Composer.layout(LAYOUT_CURRENT, true)
	}

	/**
	 * Ends the recording under way, at whatever stage it is.
	 *
	 * @param { boolean } [leaving] only for dispose(), see endRecording()
	 */
	cancel( leaving = false ){

		if( this.recording != null ) {

			this.endRecording( this.recording, RECORD_STATUS.CANCELLED, null, leaving )
		}
		else if( IS_RECORDING ) {

			// a recorder left running without a recording
			this.recorderStopped = this.stopRecorder()
		}
	}

	async play( opts = {} ){

		console.log('play')
		console.log('play')
		console.log('play')

		if( opts.record == true) {

			// console.log('init start')

			await this.recorder.init()

			// ended (cancelled, or failed) while the recorder was loading
			if( opts.recording?.over ) {

				// this.stop()

				return
			}

			// console.log('init end')
		}

		console.log("this", this);

		this.progression = 0

		if( this.tween ) {

			this.tween.kill()

			this.tween = null
		}

		Composer.reset()

		Composer.startTween.play()

		// Composer.fadeTween.play()


		this.tween = gsap.timeline()

		if( opts.playAll ) {

			this.currentSplineID = 0

			this.tween = gsap.timeline()

			let i = 0

			// this.tween.add( Composer.startTween )

			while(i < this.curves.length ) {

				let id = i

				let p = []

				p.push(gsap.to(this, {

					progression: 1,

					ease: i == 0 ? CustomEase.create("custom", "M0,0,C0.366,0,0.379,0.382,0.674,0.676,1.026,1.026,1,1,1,1") : 'none',

					duration: this.data.export[id].duration,

					onComplete:()=>{

						if( id != this.curves.length -1 ) {

							this.progression = 0

							this.currentSplineID = id + 1

							if( this.splineEditor ) {

								this.splineEditor.select( id + 1 )
							}
						}
					}
				}))

				// fade at the end of the animation if it is not the last one

				if( i != this.curves.length - 1 ) {

					// let fadeCacheTween =  Composer.fadeCache(1)

					// fadeCacheTween._delay = p[0].duration() - fadeCacheTween.duration()

					// p.push( fadeCacheTween )
				}

				// fade out if it is not the first curve

				if( i != 0 ){

					// p.push( Composer.fadeCache(0) )
				}


				// first
				if( i == 0 ){

					// p.push(Composer.fadeTween)
				}



				if( i == this.curves.length - 1 ){

					// Composer.endTween._delay = p[0].duration() - RECORD_END

					// Composer.endTween.play()

					// p.push( Composer.endTween )
				}

				this.tween.add( p )

				i++
			}



			// this.tween.play()
		}

		else {




			// Composer.startTween.play()

			// this.tween.add(


			// )

			// Composer.endTween._delay = this._duration - RECORD_END

			// Composer.endTween.play()

			this.tween.add(

				[
					Composer.startTween,
					// Composer.endTween,

					// Composer.fadeTween,

					gsap.to(this, {

						progression: 1,

						ease:   CustomEase.create("custom", "M0,0,C0.366,0,0.379,0.382,0.674,0.676,1.026,1.026,1,1,1,1"),

						duration : this._duration,

					})
				]
			)




		}

		if( opts.record == true){

			this.tween.pause()

			// resolves when the video is done; record() settles from there
			await this.recorder.start( this.tween, opts )
		}
	}

	async playAll(){

		await this.play( { record: false, playAll: true })
	}

	set active(val) {

		this.activate()

		this._active = val

		if( this._active == true ) {

			this.update()
		}
	}

	get active(){

		return this._active
	}

	activate(){

		if( this.advanced ) {

			this.helper = new CameraHelper( CinematicCamera )

			this.helper.visible = false
		}

		this.edit = true
	}

	set edit( val ){

		this._edit = val

		if( this.current != null ) {

			this.current.desactivate()

		}

		if( this._edit == false ) {

			this.current = CinematicCamera
		}

		else {

			this.current = EditCinematicCamera

		}

		this.current.activate()

		Camera.current = this.current
	}

	get edit () {

		return this._edit
	}

	set current(val){

		this._current = val

		if( this.advanced ) {

			if ( this._current == EditCinematicCamera ){

				Emitter.emit( Events.CINEMATIC_RENDER, false )

				this.addEvents()
			}

			else {

				Emitter.emit( Events.CINEMATIC_RENDER, true )

				this.removeEvents()
			}
		}
	}

	get current(){

		return this._current
	}

	update(){

		if( this.curves.length ) {

			let lookat   = this.curves[this.currentSplineID].lookAt.getPoints(this.progression)

			let position = this.curves[this.currentSplineID].position.getPoints(this.progression)

			this.displaycamera.position.copy( position )

			this.displaycamera.lookAt( lookat )

		}
	}

	set progression(val){

		this._progression = val

		this.update()

	}

	get progression(){

		return this._progression
	}


	onCinematicRender( val ){

		Scene.remove( this.helper )

		if( this._current == EditCinematicCamera ){

			Composer.visible = val

			this.helper.visible = !val
		}
		else {

			this.helper.visible = false
		}

		if(this.helper.visible == true){

			Scene.add( this.helper )

		}

		if( this.advanced ) {

			this.splineEditor.visible = !val
		}

		if(this.composerActive == false){

			Composer.visible = false
		}

	}

	async addGui(){

		// The editing panel (and its React UI) loads only in advanced
		// cinematic mode, never for visitors.
		const { cinematicGUI } = await import("@3gl/globals/customGui")

		var layoutPossibilities = []

		for (const property in Composer.LAYOUT_TYPES) {

			layoutPossibilities.push(Composer.LAYOUT_TYPES[property])
		}


		var options = {

			active: true,

			composer: false,

			currentLayout : LAYOUT_CURRENT,

			layout: layoutPossibilities,

		    progression: 0,

		    pushKeyFromCamera: 10,

		    currentKey: 0,

		    key: [0, 1, 2, 3, 4],

		    currentSpline: 3,

		    spline: [0, 1, 2, 3, 4],

		    duration: 10,

		    showplaceholders : true
		}

		// VIEW

		const view = cinematicGUI.addFolder("View");

		view.add(options, 'showplaceholders').label('Show placeholders').onUpdate(( val )=>{

			console.log( val )

			Root.setShowPlaceholders( val )
		})

		view.add(this, 'edit').name('active')

		view.add(this, 'composerActive').name('Composer').onUpdate((val)=>{

			Composer.active = val
		})

		view.add(options, 'currentLayout', options.layout).name('Layout')
		.onUpdate((val)=>{
			Composer.layout( val )
		})

		// ===< VIEW

		if( this.advanced ) {

			this.splineFolder = cinematicGUI.addFolder("Splines");


			this.updateSplineSelector()


			this.splineFolder.add(this, 'addSpline').name("Add Spline").label('Add spline')

			this.splineFolder.add(this, 'removeSpline').name("Remove Spline").label('Remove Spline')

			this.splineFolder.add(this, '_duration').name("duration").label('Duration')
				.min(0)
				.max(30)
				.listen()
				.step(0.01)
				.onUpdate((val)=>{

					this.data.export[this.currentSplineID].duration = val

					this.splineEditor.setDuration( val )

				})

			this.splineEditor.addKeyGui(this.splineFolder)


			this.splineFolder.add(this.splineEditor, 'addPoint').name('Add Key').label('Add key')

			this.splineFolder.add(this.splineEditor, 'removePoints').name("Remove Key").label('Remove key')

			this.splineFolder.add(this.splineEditor, "addFromCamera").name("add key from camera view").label('Add key from view')

			this.splineFolder.add(this.splineEditor, "setFromCameraSelection").name("set key from camera view").label('Set key to view')

			this.splineFolder.add(this, "alignView").name("align camera view with key").label('Align')

			this.splineFolder.add(this.splineEditor, "far").name("push key from camera view").label('Move')
				.min(1)
				.max(30)
				.step(0.01)
				.onUpdate((val)=>{

					this.splineEditor.setFromCameraSelection()
				})

			this.sequencerFolder = cinematicGUI.addFolder("Sequencer");

			this.sequencerFolder
			    .add(this, "_progression").name("progression").label("Progression")
			    .min(0)
			    .max(1)
			    .step(0.01)
			    .listen()
			    .onUpdate((val) => {

			    	this.progression = val
			    })

			this.sequencerFolder
			    .add(this, "play").name("play")

			this.sequencerFolder
			    .add(this, "playAll").name("playAll").label('Play All')


			this.sequencerFolder
			    .add(this, "pause").name("pause")

			// this.sequencerFolder
			//     .add(this, "save").name("save")

			this.sequencerFolder
			    .add(this, "export").name("export")


			if(  WEB_CODECS ) {

				this.sequencerFolder.add(this, "record").name("record")

				this.sequencerFolder.add(this, "recordAll").name("recordAll").label('Record All')

			}

			this.addFileLoader()

		}

	}

	addEvents(){

		if(this.onCinematicRenderEvent == null){

			this.onCinematicRenderEvent = this.onCinematicRender.bind(this)

			Emitter.on( Events.CINEMATIC_RENDER, this.onCinematicRenderEvent)
		}
	}

	removeEvents(){

		if( this.onCinematicRenderEvent ){

			Emitter.off( Events.CINEMATIC_RENDER, this.onCinematicRenderEvent)

			this.onCinematicRenderEvent = null
		}
	}

	addFileLoader = () => {

		var input = document.createElement('input')

		input.type = 'file'

		input.style.visibility = 'hidden'

		input.addEventListener('change', (event) => {

			this.onDrop( event.target.files[0] )

			input.value = ''

		});

		var params = {

		    loadFile : function() {

		    	document.body.appendChild(input)

		        input.click()

		        document.body.removeChild(input)
		    }
		}

		this.sequencerFolder
		    .add(params, "loadFile").name("load file")

	}

	onDrop = (file) => {

	    var reader = new FileReader()

	    reader.onload = e2 => {

	    	var data = null

	    	console.log(e2.target)
	    	console.log(e2.target)
	    	console.log(e2.target)
	    	console.log(e2.target)

	    	try {

	    		data = JSON.parse(e2.target.result)

	    	}

	    	catch(e){

	    		Emitter.emit( Events.CUSTOM , {

	    		    type: Events.ERROR,

	    		    value: {

	    		    	code: ERROR_CODES.INVALID_JSON_CINEMATIC
	    		    }

	    		})

	    		console.log('error')
	    		console.log('error')
	    		console.log('error')
	    		console.log('error')
	    		console.log('error')
	    		console.log('error')
	    		console.log('error')

	    		return
	    	}

	        // try{



        	this.reset()

            this.data = data

            this.load()

        	this.splineEditor.loadCurves( this.curves )

            this.updateSplineSelector()

	    }

	    reader.readAsText(file)
	}

	updateSplineSelector(){

		if( this.advanced == false ){

			return
		}

		var possibilities = []

		let i = 0

		while ( i < this.data.export.length ) {

			possibilities.push(""+i+"")

			i++
		}

		var selection =
		{
		    currentSpline : this.currentSplineID,

		    possibilities : possibilities
		}

		if( this.splineSelector == null ) {

			this.splineSelector = this.splineFolder.add(selection, 'currentSpline',  possibilities).name('spline').label('Current spline')
			.onUpdate((val)=>{

				this.selectSpline( parseInt( val ) )
			})
		}

		else {

			this.splineSelector.update(selection, "currentSpline", possibilities)
		}

		this.progression = 0

	}

	selectSpline( val ){

		console.log( "selectSpline" )
		console.log( val )

		// console.trace()

		this.currentSplineID = val

		this._duration = this.data.export[val].duration

		if( this.splineEditor ) {

			this.splineEditor.select( val )
		}

		this.update()
	}

	reset(){

		let i = 0

		let ll = this.data.export.length

		console.log(this.data.export.length)

		while( i <  ll ) {

			this.removeSpline( true )

			i++
		}

		// this.loadCurves()
	}

	dispose(){


		if( this.tween  ) {

			this.tween.pause()

			this.tween.kill()

			this.tween = null
		}

		this.cancel( true )

		this.reset()

		Composer.dispose()

		if ( this.helper ) {

			Scene.remove(this.helper)
		}

	}

	setCinematicLayout( mode ){

		return new Promise( ( resolve ) => {

	    	Composer.layout( mode )

	    	resolve()

		} )

	}

	export(){

		var json = this.splineEditor.export()

		var form = JSON.parse(json)

		var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(form, null, 4));

		var a = document.createElement('a');

		a.href = 'data:' + data;

		a.download = (CURRENT_SPACE.roomParameters.description ? CURRENT_SPACE.roomParameters.description : 'cinematic') + '.json';

		var container = document.createElement('div');

		container.appendChild(a);

		a.click();

		container.removeChild(a);

		a = null

	}

	 getSplineExport () {
        //
        if(this.splineEditor == null) return null

		var json = this.splineEditor.export();
		var form = JSON.parse(json);
		return form
	}

    save() {

        var json = this.splineEditor.export();

        var form = JSON.parse(json);

        // For the moment
        fetch(
            `${nodeEnv.PUBLIC_API}/api/cinematic/update?id=${CURRENT_SPACE.exhibit.id}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    authorization: `Token ${CURRENT_USER.token}`,
                },
                body: JSON.stringify({
                    cinematic: form,
                }),
            }
        )
            .then((resp) => resp.json())
            .then((data) => {
                console.log(data);
                console.log(data);
                console.log(data);
            });
    }
}

export default new Cinematic()
