# The Revolving Hotel

## Game
Reach the lift at the far end of a thirty-two-metre hotel corridor. Its floor, walls and ceiling take turns bearing the visitor’s weight. Clear the two agents before time runs out.

## Players
One person controls the traveller in each run. Visitors share Oncyber’s hotel social room.

## Formats
Corridor run is a solo encounter. Watch sequence stages a separate 29-second performance with the visitor playing the lead.

## Arrival
Walk the quiet corridor as the avatar selected in Oncyber. Choose Enter the corridor to start a run or Watch sequence to see the choreography.

## Devices
WASD moves, Shift runs, Space jumps, J strikes, E confirms, C watches the sequence and Backspace returns. The manifest provides corresponding touch and gamepad bindings.

## Kits
The avatar kit handles identity, VRM loading, retargeting and the travel pose. The locomotion kit controls the walkable arrival. The game UI kit supplies the controls. During the encounter a normalized pose drives the selected avatar, including wrist contacts, surface alignment and landings.

## Sound and pausing
The page owns chat, voice, volume and input focus. A solo run pauses with the host. The corridor uses the platform audio output.

## Leaving and results
A win, capture or timeout ends the run and reports one result. Leave run returns to the walkable arrival. The page handles departure for the lobby.

## Saved data
A run is session-local and has no persistent save keys.

## Inspect
The lifecycle reports the current screen, selected avatar, arrival, position, grounded state, roll and sequence time.

## Bot
The scenario walks, watches the sequence, enters a run, strikes and jumps. The process bot plays a complete run and returns to the hotel.
