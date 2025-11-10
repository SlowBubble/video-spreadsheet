# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# Design

- Think of how to make things look more seamless
  - Idea 1: give a few seconds to play all the videos near their startMs time (invisibly)
  - Idea 2: play in slow motion 1 second before to make sure the header is not visible and avoid buffering
  - Idea 3: add some transition to black screen
- How to make the recording from an extension easier
  - Have a countdown
  - Open a window
  - For preview, we can use a smaller window
- Make editing easier
  - Anchor the position to the end of another asset (may be start with a static impl)
  - Display the video title instead of the link.

# Wishlist

P1:
- Design subcommands
  - Add a subcommands field to the ProjectCommand class which will have type (ProjectCommand[] vs Subcommand[]) and default to an empty list.
    - Think about the use case before deciding; see `Other subcommands`
  - Press `shift+enter` on a row will add a subcommand to the command.

P2:
- Other subcommands
  - slow-mo a certain segment
  - silence a certain segment
  - skip a certain segment
  - pause a certain segment  (may need to slo-mo and repeat instead due to unwanted recommendations showing up)
  - Add text
  - Add arrow or box at a certain location
  - Add filter (likely the full segment)
  - Zooming in may be hard
    - Instead, put a border around to block stuff

P3:
- Present mode
  - warm up all the assets
  - display the first YT player's screen
- alt-up: move row up

# m5 impl

Overlay and subcommands

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

# wip: m5g

- Autofill the position field of a row using the current time at creation

# m5h
- Decide if I need subcommands
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


