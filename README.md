# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m12c (done)
- track the startMs and endMs of each yt player using cmdId
- refactor the loading of each yt player into a method
  - console.log the cmdId of the yt player being reloaded and done reloading
- instead of needsReplayManagerReinit loading every players, just see if the given cmdId has startMs and endMs outside of the loaded yt players, and if so load that.

# m12d
- When opening with the "Short" button, add a short=1 url param
- When short=1, enabled this feature:
  - For a subcommand, if there is non-zero left or right borderFilter, then for that time period during the replay, position the corresponding yt player so that the middle of the browser window width is closer to the middle of the left and right of the borderFilter, but don't move it so far that the border of the yt player is moved into the browser window.

# wishlist
- alwaysTether defaults to true as an Editor field.
- Allow editing pos 1 column
  - `enter`, `alt+left` and `alt+right`
- Add links back to Dur by computing the footage end time in seconds (round down)
- Add links for the subcommands based on the parent command
- Animate underlined box

- Add `d` shortcut to get debug info based on the current play
- load yt players on demand (yagni)
- see if we need to add buffer to the start/end of yt players (yagni)

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
