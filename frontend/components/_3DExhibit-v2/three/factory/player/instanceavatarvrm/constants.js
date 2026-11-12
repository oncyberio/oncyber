import { READY_IDLE_DURATION } from './baker/readyIdle.js'

const IDLE = {

	name: 'IDLE',

	loop: true

}

const IDLE_CC0 = {

	name: 'IDLE_CC0',

	duration: READY_IDLE_DURATION,

	loop: true

}

const RUN = {

	name: 'RUN',

	loop: true

}

const WALK = {

	name: 'WALK',

	timeScale : 1,

	loop: true

}

const JUMP = {

	name         : 'JUMP',

	timeScale    : 0.5,

	loop 	     : true,

	resetOnFloor : true,

	fadeRatio    : 0.8

}

const FLY = {

	name         : 'FLY',

	loop: true
}



const TAUNT = {

	name: 'TAUNT',

	timeScale : 1,

	loop 	     : true,

	sync         : true

}

const HIPHOP = {

	name: 'HIPHOP',

	timeScale : 1,

	loop 	     : true,

	sync         : true

}

const WAVING = {

	name: 'WAVING',

	timeScale 	 : 1,

	loop 	     : true,

	sync         : true

}

const SEXY = {

	name: 'SEXY',

	timeScale : 1,

	loop 	     : true,

	sync         : true
}

const CHAABI = {

	name: 'CHAABI',

	timeScale : 1,

	loop 	     : true,

	sync         : true

}

const CHAABI2 = {

	name: 'CHAABI2',

	timeScale : 1,

	loop 	     : true,

	sync         : true

}

const SHUFFLING = {

	name         : 'SHUFFLING',

	timeScale    : 1,

	loop 	     : true,

	sync         : true

}

const MOONWALK = {

	name         : 'MOONWALK',

	timeScale    : 0.6,

	loop 	     : true,

	sync         : true

}

const FLOSS = {

	name         : 'FLOSS',

	timeScale    : 1,

	loop 	     : true,

	sync         : true

}

const LIKETHIS = {

	name         : 'LIKETHIS',

	timeScale    : 0.6,

	loop 	     : true,

	sync         : true

}

const WANNAROCK = {

	name         : 'WANNAROCK',

	timeScale    : 0.6,

	loop 	     : true,

	sync         : true

}

const TECHNO = {

	name         : 'TECHNO',

	timeScale    : 0.6,

	loop 	     : true,

	sync         : true

}

const DEATH = {

	name         : 'DEATH',

	timeScale    : 0.6,

	loop 	     : false,

	sync         : false

}

const PRAYING = {

	name         : 'PRAYING',

	timeScale    : 0.6,

	loop 	     : true,

	sync         : false

}

const CRIP = {

	name         : 'CRIP',

	timeScale    : 1,

	loop 	     : true,

	sync         : true

}


const SITTING = {

    name         : 'SITTING',

    timeScale    : 1,

    loop 	     : true,

    sync         : false
}


const FLOORSITTING = {

    name         : 'FLOORSITTING',

    timeScale    : 1,

    loop 	     : true,

    sync         : true
}

const SITTALKING = {

    name         : 'SITTALKING',

    timeScale    : 1,

    loop 	     : true,

    sync         : true
}


const EMOTES = [

	WAVING,

	HIPHOP,

	MOONWALK,

	TECHNO,

	SHUFFLING,

	CHAABI,

	CHAABI2,

	SEXY,

	DEATH,

	PRAYING,

	WANNAROCK,

	CRIP,

    SITTING,

    FLOORSITTING,

    SITTALKING
]



const AWAY = 100000

const POSSIBLE_ACTIONS = [ IDLE, RUN, WALK, JUMP, FLY ]

let i = 0

while( i < EMOTES.length ) {

	POSSIBLE_ACTIONS.push( EMOTES[i] )

	i++
}

// Append after existing actions so their baked metadata indices stay stable.
POSSIBLE_ACTIONS.push( IDLE_CC0 )

export {

	AWAY,

	EMOTES,

	IDLE,

	IDLE_CC0,

	RUN,

	WALK,

	JUMP,

	FLY,

	POSSIBLE_ACTIONS

}
