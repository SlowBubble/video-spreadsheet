# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.


# m14a

- Box overlay
  - Need better UX for specifying the position of the box.

# m13a
- When users request replay, instead of dis-allowing it, make it play after all the players are loaded
  - Show a banner that says waiting

# m13b
- instead of waiting for all the players to load
  - Look at which commands/subcommands contains the specified resume time
  - If the yt players for all those are already loaded, then you can start the reply instead of blocking.

# wishlist
- Design color coding for base, glue and adornment
- `h` to hide the table (for smaller screens)
- Add `d` shortcut to get debug info based on the current play
- Animate the box overlay
- load yt players on demand (yagni)
- see if we need to add buffer to the start/end of yt players (yagni)

- better shortcuts for borders in various directions.
  - shift+arrow to increase border, shift+cmd+arrow to decrease border
  - o to cycle through opacity [0.25, 0.5, 1], defaulting to 1.
- Load a bigger window so that the players don't constantly need to reload
  - Test with just the entire player window
- Need to migrate from startMs to inputStartMs and endMs to inputEndMs, and positionMs to outputStartMs
