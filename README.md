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
- Display the absolute end time of the asset in the table (but won't be editable as it will be computed)
- console log the YT player operations so that I can understand what's happening
- Instead of stopping with `space`, let's stop with `shift+space`, and instead have `space` pause, but the tricky bit is to figure out how to resume with the plan-based architecture (plan generation need to happen based on the current time)
- Name each row with an id and display that instead of the asset link
  - When you press enter, it should display 2 prompt; 1 for the name and 1 for the link (if the name is not "@id"); if the name is blank, then just use the entire link as the name.

P2:
- Design slow motion start and stop
  - For row "main", we want to slow-mo from 1:12 to 1:14
  - In a new row, we will set the asset to "@main", set position to "", set start to "1:12" and end to "1:14", set speed to "0.2".
- Design mute volume start and stop
  - In a new row, we will set the asset to "@main", set position to "", set start to "1:12" and end to "1:14", set volume to "0".

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


