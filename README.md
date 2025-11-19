# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.


# m11b (done)

- Implement left and right border using the shortcut `v`, similar to what `b` is doing with top and bottom border.
  - will use mouse drag later.


# m11c (done)
- subcommand editing for the Fill column
  - mouse double-click or `enter`

# m11d

- Display Pos 0 and Pos 1
- Allow editing Pos 0 of a subcommand row
  - `enter` will open up a prompt with the computed value as in the cell and if the user change it, you will need to compute the corresponding startMs for the subcommand
  - Make `alt+left` and `alt+right` work for subcommand rows at Pos 0 column as well

# m11e
- Fix replay at non-zero time (certain visuals are not displayed; I suspect some DisplayAction from before the resume time is skipped) 

# m11f
- Allow editing pos 1 column
  - `enter`, `alt+left` and `alt+right`
- Add links back to Dur by computing the footage end time in seconds (round down)
- Add links for the subcommands based on the parent command
- copy-paste the overlay, excluding TextDisplay
- Add `d` shortcut to get debug info based on the current play


# wishlist

- cmd+c cmd+v append row
- alwaysTether defaults to true as an Editor field.
- instead of needsReplayManagerReinit check, just have a map in replayer to store what players are loaded and the duration and load new players as needed.


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
