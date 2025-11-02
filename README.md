# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# Design

- Think of how to make things look more seamless
  - Idea 1: give a few seconds to play all the videos near their startMs time (invisibly)
  - Idea 2: play in slow motion 1 second before to make sure the header is not visible and avoid buffering
  - Idea 3: add some transition to black screen
- How to make the recording from an extension easier
  - Have a countdown
  - Open a window that has the right size (1080x720)
  - For preview, we can use a smaller window
- Make editing easier
  - Anchor the position to the end of another asset (may be start with a static impl)
  - Display the video title instead of the link.

# M1 implementation

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

# M1f

