# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m8b
- Add an optional endMs param for startReplay, which will generate and execute a plan where everything stops (displaying a black screen) at endMs.
- Instead of just opening a window for the Short button, prompt for start and finish in seconds, which will be displayed as 2 numbers separated by a space.
  - Parse the numbers into millisecond units and store it in 2 new Project fields, called shortStartMs and shortEndMs
    - If these fields are populated previously, then you should put them in the prompt opened by the Short button.
  - When space bar is pressed, instead of playing from start to finish like the other modes, it will just play from shortStartMs to shortEndMs.

# m8a (done)
- For short or present, where we only show the iframes, make the not covered by the iframes black.
- Add a Short button next to Present, which opens a window of width 854 and height 1520

