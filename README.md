# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m12

# m12a
- For each command, add an number field id. If the id does not exist or is 0, then set it to the next smallest number that is not in use among all the commands.

# m12b
- Instead of specifying start and end for the youtube player, load the entire video
- Instead of needsReplayManagerReinit check, just have a set of indices of what youtube player has 

# wishlist
- alwaysTether defaults to true as an Editor field.


- Allow editing pos 1 column
  - `enter`, `alt+left` and `alt+right`
- Add links back to Dur by computing the footage end time in seconds (round down)
- Add links for the subcommands based on the parent command
- Add `d` shortcut to get debug info based on the current play

- better shortcuts for borders in various directions.
  - shift+arrow to increase border, shift+cmd+arrow to decrease border
  - o to cycle through opacity [0.25, 0.5, 1], defaulting to 1.
- Design color coding
  - Base: Is not contained in other segments
  - A Group of bases: multiple bases with almost identical overlap
  - Glue: overlap with multiple groups of bases
  - Adornment: contained in a single group of base
- Design how to tether persistently and how to display
  - do we need an internal ID? Or is tether a property between consecutive rows???
  - display the tether by removing the border between the 2 rows for those 2 columns
  - remove tether if the 2 rows have
- Load a bigger window so that the players don't constantly need to reload
  - Test with just the entire player window
- Need to migrate from startMs to inputStartMs and endMs to inputEndMs, and positionMs to outputStartMs
