# m12a (done)
- For each command, add an number field id. If the id does not exist or is 0, then set it to the next smallest number that is not in use among all the commands.

# m12b (done)
- In the replayer, it may be simpler to use command id instead of idx to track the yt players, which can change as we move commands around.
  - Keep using the cmdIdx for the action generation flow though.
  
# m11f (done)

alt+up for subcommand

# m11g (done)
- copy-paste the overlay, excluding TextDisplay
- cmd+c cmd+v append row

# m11h (done)
- Need to refactor fromJSON to be available all classes used inside Project
  - See if this is possible: there are many instances of `new ProjectCommand` with lots of args, but I want to see if we have fromJSON individually, we can avoid expanding like this.
  
# m11b (done)

- Implement left and right border using the shortcut `v`, similar to what `b` is doing with top and bottom border.
  - will use mouse drag later.


# m11c (done)
- subcommand editing for the Fill column
  - mouse double-click or `enter`

# m11d (done)

- Display Pos 0 and Pos 1
- Allow editing Pos 0 of a subcommand row
  - `enter` will open up a prompt with the computed value as in the cell and if the user change it, you will need to compute the corresponding startMs for the subcommand
  - Make `alt+left` and `alt+right` work for subcommand rows at Pos 0 column as well

# m11e (done)
- Fix replay at non-zero time (certain visuals are not displayed; I suspect some DisplayAction from before the resume time is skipped) 

# m11a (done)
- Implemented Subcommand class with fields: startMs, endMs, name, overlay
- Added subcommands field to ProjectCommand
- Implemented serialization/deserialization for subcommands
- Added cmd+enter keyboard shortcut to create subcommands
- Updated replay logic to handle subcommand overlays:
  - Added ADD_OVERLAY OpType
  - Added cmdIdxToOngoingSubcmdIndices tracking to OpEvtsGroup
  - Updated plan generation to create overlay events for subcommands
  - Subcommand overlays are rendered on top of command overlays

See SUBCOMMAND_IMPLEMENTATION.md for full implementation details.


# m10d (done)
Rewrite plan generation (note that the behavior should not change, so if I'm missing any info propagation, feel free to add them as needed to ensure the behavior stays the same):
- Create a class OpEvtsGroup with OpEvt[] field OpEvts and field ongoingCmdIndices (a set of numbers) where class OpEvt has fields isStart, timeMs and mediaType (enum AUDIO, VISUAL, AUDIO_AND_VISUAL)
- (Do this in a private method) Process the commands being passed into 2 OpEvt each, and then group them by timeMs and sort the resulting OpEvtsGroup[] groups by ascending timeMs.
  - If there is extendAudioSec, there should be 3 events (first start AUDIO_AND_VISUAL, then stop VISUAL, then stop AUDIO_AND_VISUAL)
- (Do this in a private method) Go thru the groups and populate the ongoingCmdIndices (oci) set for each group.
    - The cmdIdx is defined as the index of the commands.
    - When passing the start of 1 or more commands, add them to oci
    - When passing the end of 1 or more commands, remove them to oci
- (Do this in a private method) Generate PlayVideoAction[].
- (Do this in a private method) Generate PauseVideoAction[].
- (Do this in a private method) Generate DisplayAction[], by using the max of the oci for each group.
  - Have a clean up step where if consecutive display actions have the same cmdIdx deduplicate (the reason to break it up into a separate step is to keep generation logic simple, i.e. only depend on info for a single group)
- (Do this in a private method) Generate OverlayAction, appending the overlay for cmdIdx being max of oci, 1 per group (okay to have empty overlay).
  - Have a clean up step where if overlay actions have empty overlay, remove that action
- Merge them together using the existing sorting impl.

# m10c (done)
- Change OverlayAction to use a list of overlays instead of 1 overlay
  - The replayer will then draw the on the canvas by following all the overlays instruction.

# m10b (done)
- Break PlanAction into these types:
  1. PlayVideoAction
    - volume
    - playbackRate
  2. OverlayAction. Fields
    - overlay
  3. DisplayAction (decide which youtube player iframe to display and the rest will be hidden)
  4. PauseVideoAction
- All of them will have these fields, so may just have PlanAction be an abstract class for them to inherit from to have these fields:
  - replayPositionMs
  - cmdIdx
  - debugAssetName (originally assetName; this is just needed to help with debugging, not actually needed for replay)
- Preserve the existing replay behavior after these changes (the original spec is in `m5o` in DONE.md). Feel free to add extra fields if the ones above are not sufficient to make everything work.
- Before executing the actions, may sure they are sorted:
  - ascending in replayPositionMs
  - if replayPositionMs is tied, sort them in the above listed order (PlayVideoAction first, OverlayAction etc.)


# m10a
- Rename start to replayStartMs and end to replayEndMs within PlanAction and its usages.


# m9e (done)
- Disable replay until players loading is complete. If the user try to replay before that, display a banner that says "Loading is not finished."

# m9d (done)
- shortcut `p` will toggle to round the 4 columns with the time to round the value displayed to 0/1 decimal place.

# m9c (done)
- Change the "End" column to "Dur" instead and show the duration up to 0.1 precision
  - Don't modify how the underlying data is stored, just compute the duration using endMs - startMs.
  - The editing operations will still be modifying the underlying endMs.

# m9b (done)
- display 0.1 precision for all the column involving times
- also, when loading the edit prompt value, don't round, but display the actual precision (if it's 5, display 5; if it's 5.2, display 5.2 in the prompt)

# m9a (done)
- alt+left and alt+right for cycling left and right through (and wraps around when the end is reached) the options for the volume and speed columns
  - speed options: [25, 50, 75, 100]
  - volume options: [0, 25, 50, 75, 100]

# m8c (done)
- When the "Short" button is pressed, prompt for the % of the default window size to open the new window in. Default the value to be 100.
  - Note: The current default window size is set to 854 by 1520.
- When the % is smaller, the window will cut off the right part iframe. So if % < 100, change the iframe position so that it is still centered at the center of the smaller window, so that both the left and right part are cut off evenly.

# m8b (done)
- Add an optional endMs param for startReplay, which will generate and execute a plan where everything stops (displaying a black screen) at endMs.
- Instead of just opening a window for the Short button, prompt for start and finish in seconds, which will be displayed as 2 numbers separated by a space.
  - Parse the numbers into millisecond units and store it in 2 new Project fields, called shortStartMs and shortEndMs
    - If these fields are populated previously, then you should put them in the prompt opened by the Short button.
  - When space bar is pressed, instead of playing from start to finish like the other modes, it will just play from shortStartMs to shortEndMs.

# m8a (done)
- For short or present, where we only show the iframes, make the not covered by the iframes black.
- Add a Short button next to Present, which opens a window of width 854 and height 1520

# m7f (done)

Test firebase out

# m7e (done)
- Remove the id field from Project.
- Show the last edit date in the home page when listing out the projects

# m7d (done)
- Create a class called TopLevelProject that contains:
  - Project
  - Metadata
    - id: same as the Project's id field
    - owner: use the auth.currentUser.uid if available when the project is first initialized; if auth is not available, just ''.
    - createdAt: Date.now() when the project is first created
    - lastEditedAt: Date.now() updated whenever you make a save to the project.
- Make import/export only paste/copy the Project part and not the Metadata
- Change the saving and loading from dao to use TopLevelProject instead of project
  - To make it compatible with existing project, when you first load from the dao and it is a Project instead of TopLevelProject, handle it by wrapping it in a TopLevelProject and setting the Metadata field appropriately
- Reason: This allows for more flexibility, like if we need to add project-unrelated fields, e.g. editor specific settings

# m7c (DONE)

- Use a new firestore project
  - Set up the same rules as before


# m7b (DONE)
- Add a sign in button in the homepage using firebase/auth and google as the auth provider.
- The homepage now includes Google sign-in functionality
- User email is displayed when signed in with a "Sign Out" button

# m7a (DONE)
- Refactor all the localStorage related logic into localStorageDao.ts, which should follow the same interface as firestoreDao.ts, because I'm planning to have a url param to toggle between using localStorage and firestore
- Storage Toggle: Use `&storage=firestore` URL parameter to switch between localStorage (default) and Firestore
- Both storage backends implement the same `IDao` interface

# m6 impl (DONE)

All basic funcionality without subcommands (which may be too complex).

## m6a

- Have export/import use a textarea modal instead

## m6b
- `cmd+shift+s`: clone project
  - Suffix the project name with '*'
  - the id with be generated so it doesn't clash with the old id
  - navigate to the new url
- `cmd+backspace`: delete the current row
- `cmd+shift+backspace`: delete the project after a confirm prompt and navigate to home page

## m6c
- Replace the current shortcut `a` with setting the current row's start to the previous row's end.

## m6d
- Change `0` to also resume replaying if it was paused
  - Impl `1`, ..., `9` to be like `0` but to be set to 1/10, ..., 9/10 of the replaying duration.

## m6e
- Add a left-most '✅' column that just have a checkbox for each row
  - This correspond to the opposite of a field in ProjectCommand called `disabled`, which is a boolean or undefined (so we don't even need to init the field)
  - If disabled is true, then the replayer will ignore it.
  - You can toggle it by being on the cell and pressing `enter`.

## m6f
- Fix copy-paste
  - `cmd+c` now copies to the system clipboard:
    - Checkbox column: copies entire row/command as JSON (pretty with 2 space indent)
    - Asset column: copies the asset link (not the name)
    - Time fields: copy the ms quantity as a string
    - Other fields: copy as string
  - `cmd+v` now pastes from the system clipboard:
    - Checkbox column: detects JSON and replaces entire row with pasted command
    - Asset column: pastes the asset link
    - Time fields: parse string as number (shows error if invalid)
    - Text column: pastes as string
  - Works with clipboard from other apps

## m6g
- Add another field to command (no need to display it in the table), called extendAudioSec
  - Implement it by just adding this number to the endSec for playerVars, so that the player will play for longer even after the visual stop showing
- Control this field via decrement/increment of 1 second via `[` and `]`, staying >= 0.
  - Have banner to indicate extendAudioSec when it changes

# m5 impl

Overlay

## m5a

- Implement overlay over the iframe that is replaying (don't worry about debug mode where multiple iframes will be showing)
  - The overlay will just be a canvas with a higher z-index
  - The purpose is that we want to add different things to the canvas, such as text and filters.
  - For testing purpose, just add a red filter by drawing a rectangle that covers the entire canvas with 'rgba(255, 0, 0, 0.2)' as the fillStyle.

## m5b

- Only enable the red filter based on a new field called `overlay` in ProjectCommand of type Overlay
  - Overlay will be a class will just one field called `fullScreenFilter` of type FullScreenFilter (will add more fields later).
  - FullScreenFilter will have just one field called the fillStyle, that default to 'rgba(255, 0, 0, 0.15)'.
  - Propagate the `overlay` in the PlanAction so that the replayer will know to enable the filter.
- Keyboard shortcut `f` on the selected row will add the red filter or green filter.

## m5c

- Implement a borderFilter in Overlay, where BorderFilter has the field topMarginPct and bottomMarginPct default them to 8 for now and a fillStyle field that defaults to 'rgba(0, 0, 0, 0.85)'
- Implement it by drawing top and bottom rectangles based on the specified percentage and fillStyle
- Enable it via `b` on the selected row.

## m5d

- Add a text field to the ProjectCommand
- Add a column in the table to edit it.
- If it's non-empty:
  - Propagate it to the overlay as a new field called `textDisplay` with type TextDisplay which has the field called `content`
  - Default to writing the text to the upper left of the canvas above the other filters
  - Write the text in white with 36px with black background of opacity 0.6

## m5e
- Add shortcut `t`; if there is text, then toggle alignment of TextDisplay among 4 options, upper left, lower left, upper right and lower right

## m5f

- a: Autofill position using current time
- alt+right: increment time value by 0.5 seconds (positionMs, startMs and endMs) if the cursor is on one of those columns
- alt+left: decrement time value by 0.5 seconds similar to alt+right

# m5g

- Autofill the positionMs field of a row using the current time at creation

#  m5h

- Separate the Position column into `Pos 0` and `Pos 1`, where `Pos 1` column that is not editable

# m5i
- Make it easy to copy cells.
  - `cmd+c`: For the 4 column about time in ms, Implement it internally by storing the actual integer in ms as a string; for the asset column, copy the underlying asset link as a string; for the rest, store the string itself.
  - `cmd+v`: Disallowed for `Pos 1` column. For asset, pasting will modify the asset link. For column of type number, you need to parse the string into number; if it's a NaN, then just display a banner "Failed: Invalid number" and return early.

# m5j

- Show the start and end column values as achored links, where the link to use is the asset link with a slight modification
  - Remove the "t=" url param from the link if it's there
  - construst the "t=123s" based on the value of that cell.

# m5k
- Make Pos 0 and Pos 1 texts into buttons, which will start the replayer at the specified time of the cell.
  - If the replayer is already playing, pause before performing this action.

#  m5l

- create undo.ts
- Implement undo/redo in an UndoManager class in undo.ts
  - 3 fields: pastStates, currentState, futureStates
  - Initialize to [], the current project's json string, []
  - public methods: hasChanged(currJsonString), updateIfChanged(currentJsonString), undo() and redo(), getCurrentState()
- `cmd+z`: call undo and getCurrentState to update the editor and save the project
- `cmd+shift+z`: call redo and getCurrentState to update the editor and save the project
- For all keyboard events (so just have 1 call at the end of handleKey): call a new method, maybeSave, which first check if the editor's state has changed from the UndoManager's currentState
  - If so, call updateIfChanged and save the project
  - If not, don't save the project.

# m5m

- in maybeSave, do a fine-grain check to see if we actually need to call initReplayManager
  - yes only if a new asset has been added or if startMs or endMs has changed.

# m5n
Design plan action fields to be cleaner and more explicit so that the plan generation can also be cleaner. PlanAction should have:
- playVideoFromStart (opposite of resume; let's just get rid of resume, which is a confusing term)
- resumeVisual (all other videos will be hidden except for this one)

E.g. playVideoFromStart without resumeVisual means the viewer will just hear the sound
E.g. resumeVisual without playVideoFromStart means the video will be visible again, but not restarting because it is previously playing in the background

# m5o
At this point it is simpler to rewrite generateReplayPlan in a separate method, called generateReplayPlan2
- Given the commands from the project, we know the commandIdx for each command is 0, 1, 2, etc. This is used to determine precedence for what is visible (higher commandIdx, higher precendence when there is overlap)
- Find all the important points:
  - Start of a command
  - End of a command
- Group them into a list of objects: {starting: [cmdIdx0, ...], ongoing: [cmdIdx1, ...], ending: [cmd2, ...],  timeMs: 123} ascending in timeMs
  - Create a class for the object, called Surrouding
  - ongoing command means the start < timeMs and end > timeMs 
- You can then generate Plan Actions based of the list of Surrounding
  - Have a function getVisibleCommand(timeMs, commands, surroundings)
   - It should be the max commandIdx from the starting and ongoing.
  - For each starting command, you will generate a Plan Action to trigger playFromStart
    - And decide whether showVideo needs to trigger
  - If the previously visible command is ending, then you will need to generation an action to trigger showVideo
    - And decide whether playFromStart is needed depending on whether it is for a starting or ongoing command.

Then call generateReplayPlan2 instead of generateReplayPlan.

# m5p
- shortcut: `backspace` will remove the asset. Add a confirm prompt
- In a new row, when entering '' for asset link, create a new row as usual, but set the asset name to 'Black' and when replaying treat it as 'Black Screen'

# m5q

SUpport mouse click
- clicking on a cell will move the selected cell to it (except for the header)
- double-clicking will move to it and then have the same action as pressing enter (so refactor accordingly)

# m5r
- Add a "Fill" column (non-editable) where each cell will have a canvas (scaled down by 1/18 of the 480x854 video canvas)
  - You will fill the canvas with the overlay of that row, except it will be scaled way down by 1/18.

# m5s
- Start editing a real project and decide if I need subcommands
  - I mainly want slow-mo to dramatize a stroke
  - May be add in some pauses

# m4 impl
Make it easy to screen-record a good-looking video
- Present mode
  - open a window of the correct size

## m4a

1. Add a button next to shortcuts that says "Present", which will open the same url but with present=1 added to the hash but in a new window of size 480px by 854px.
2. Add a present mode that is triggered when url hash has the param present=1
  - We can assume debug mode will not be enabled so don't worry about weird interactions between the 2 things
  - In this mode, only show the YT players or the black screen and don't show anything else (we can assume only 1 of these will be shown at the 1 time)
3. The result of 1 and 2 will be that a new window will be open and there should not be anything overflowing, so no scroll-bar should be visible

# M3 implementation
Make it easier to edit a 2-minute video

## M3a
- Display the position in seconds when replaying (so that I know the position when adding extra assets)

## M3b
- `space` works fine for starting replay, but can you implement stop when `space` is hit while it is replaying, which will reset everything back to 0 seconds.

## M3c
- In the position column, also render the end time (e.g. "0:00-1:12") by computing it via position + (end - start)

## M3d
- Add a speed column, so that the user can enter the playback speed, which will be a number. Make the default 1.
- During replay, you will need to generate a plan with that as a field and then use that to set the playback rate for the YT player.
- Change the position end time computation to account for playback speed, and this will affect the plan actions mentioned in M2c
- console log the YT player operations so that I can understand what's happening

# M3e
- Export: When the user press `x`, open up a prompt with the serialized project data selected, so that the user can copy it.
  - If the user then press cancel, then nothing happens
  - If the user press enter in the prompt (after possibly changing it), then the editor should treat that as serialized project data and deserialize and load it as the current project.

# M3f
- Add a name (string) field for the command that defaults to ''.
  - When a user press enter on the asset column, and the asset field is already populated, then open a prompt to edit the name field instead.
  - If the name field is non-empty, then display the name instead of the asset in the asset column.

# M3g
- Instead of stopping with `space`, let's stop with `shift+space`, and instead have `space` be pause, but the tricky part is to then play from the time when things are paused; to do that we need to account for that in the generated plan.

# M3h
- M3g has various issues. 
- When just the first asset is playing, resume works correctly, but when there is an overlap of 2 assets, then resume needs to handle it by generating a plan that starts both assets, so the plan generation need to account for this overlap

# M3i
Debugged:
- Just realized that things are stopped automatically by how we initiate YT player
- Need to decide if that's a good design and see if we need to name things better for PlanAction

# M3j
- implement the keyboard shortcut j to rewind 4 seconds for the replay
  - if the replayer is not paused, pause it first, rewind and then resume

# M3k
- Refactor rewind to call a common function that set the time (and if not paused, pause first and resume after) and then:
  - implement the keyboard shortcut l to fast-forward 4 seconds similar to rewind

# M3l
- In editor, implement a function that sets the replayer to the start position of the selected row.
  - Call this function after up or down or the position column is updated.

# M3m
- pausedAtMs should never be undefined; it should default to 0
  - Is there a good reason why it can be undefined? If not, remove it and logic that checks it being undefined

# M2 implementation
Get it working with a 1 small overlap

## M2a
- Add a column for volume, which will be a value from 0 to 100
  - During playback, set the volume based on that value
- Currently, I to have reload for this change to reflect, but it's okay due to some complex preloading logic

## M2b
- Currently, we can handle 2 non-overlapping asset. But we need to handle overlapping assets.
  - E.g. if asset 1 has position 0ms and ends at 8000ms, while asset 2 has position 3000ms and ends at 5000ms, then you will show the iframe for asset 1 from 0ms to 3000ms, asset 2 from 3000ms to 5000ms and then asset 1 again from 5000ms to 8000ms
  - When 2 assets overlap, pick the lower one in the table to show the iframe when replaying, but once the overlap is done, display the iframe
  - Even though only 1 iframe is displayed, both still need to keep playing, since we may need the audio going in the background.
- To make it easier to debug, have an intermediate step to generate a plan of the actions to be taken and then have the ReplayManager execute the actions. 

## M2c
- The action plan architecture is done, but there are bugs, so let me clarify how to generate the plan.
- Each command has a position field, which indicates when things will start in absolute term in ms.
- Each command will also indicates when things will end via position + end - start
- So each command provides an interval.
- Given the list of intervals [a0, b0], [a1, b1], ..., first figure out all the points of changes in ascending order, and for each point of change, determine which YT player/iframe should be the visible one (for the very last point of change, use idx -1 and interpret that as a black screen)
  - Given a point of change c, go through the list of intervals in reverse and let's say the interval of interest is [ai, bi], see if c >= ai and c < bi. If so, then that should be the visible TY player/iframe

# M1 implementation
Goal: have something that I can play back to see something
## M1a
- A table that consists of 4 columns
  - Asset
  - Position
  - Start
  - End

## M1b
- A cursor that boldens the border of a table cell and navigates in the 4 directions via the arrow key
- When the enter key is pressed, open a prompt that allows user to type in a string to update the selected table cell.
- When a row is becomes non-empty (filled with some data), make sure there is also an empty row added to the table automatically.
- Make tab and shift+tab serve as right and left navigation as well

## M1c
- Replace the current title with an editable div (user can double-click to edit it), which will be the project's title
  - The editable doesn't seem to work. Instead of this, let's just open a prompt when you click on an edit icon to the left of the title

## M1d
- Move the current main.ts logic to edit.ts have the index.html with no hash, which serves as the homepage that the list of saved projects and a button to create a new project.
- When the button is clicked, navigate to #id=timestamp which will serve as the edit page, where timestamp is a date string with seconds precision and serves as the id of the project.
- When you press cmd+s, then save the data as the following JSON string in local storage with the key being the id of the project. JSON format:
```
{
  "title": <title of the project>,
  "id": <id of the project>,
  "commands": [
    {
      "asset": <string>,
      "positionMs": <number>,
      "startMs": <number>,
      "endMs": <number>
    },
    ...
  ]
}
```
  - Since we will be adding to this data structure, let's make a Project class in project.ts for this and has a serialize function that simply calls JSON.stringify and a static deserializeFromSpreadsheet.
  - In edit.ts have function that takes Project and render it to the table.

# M1e
- Implement replay in replay.ts: When you press space in edit.ts, it will play a video according to the commands of the project. Here is how to interpret each command
  - Sort the commands by increasing positionMs
  - The asset will be a youtube link which you will use to load the video in an iframe (1080x1920)
  - positionMs tells you when to start playing the specified video in the iframe and startMs tells you where the video should be set to when you play it, and endMs tells you when to stop the video, so you will be playing the video for duration, endMs - startMs.
  - Repeat this for all commands, using setTimeout to start the command based on positionMs


# Abandoned
Too hard/too general (avoided using simple copy-paste)
- Impl snap group:
  - The project will need a new field snapGroups of type SnapGroup[]
  - SnapGroup has a points field of type SnapPoint[]
  - SnapPoint has asset field of type string and useStartAsSnapPoint of type boolean
  - Whenever the positionMs, start, end
- Shortcut: press `s` to set the snap1 (should be on the start or end column so that we can create a SnapPoint)
  - Move to another cell and press `s` to set the snap2 (should be the start or end column so that we can create a SnapPoint)
  - If the snap1 and snap2 do not belong to an existing SnapGroup, create a SnapGroup of the 2 things and add them to the project
  - Else, add them to the existing SnapGroup, or if they belong to 2 different SnapGroups, merge the 2 groups.
  - Sync the time of the things in the same SnapGroup using snap1's data as the source of truth. 

