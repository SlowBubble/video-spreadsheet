# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m9a

- alt+left and alt+right for cycling left and right through (and wraps around when the end is reached) the options for the volume and speed columns
  - speed options: [25, 50, 75, 100]
  - volume options: [0, 25, 50, 75, 100]

# wishlist

- alt+left and alt+right for volume and speed
  - speed [25, 50, 75, 100]
  - volume [0, 25, 50, 75, 100]
- display 0.1 precision for all the times
- tether permanently (persist)
  - do we need an internal ID? Or is tether a property between consecutive rows???
  - display the tether by removing the border between the 2 rows for those 2 columns
  - remove tether if the 2 rows have
- Load a bigger window so that the players don't constantly need to reload
  - Test with just the entire player window
- subcommands for overlay
- better shortcuts for borders in various directions.
- Need to migrate from startMs to inputStartMs and endMs to inputEndMs, and positionMs to outputStartMs
