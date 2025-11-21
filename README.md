# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.




# wishlist
- Design color coding for base, glue and adornment
- `h` to hide the table (for smaller screens)
- Add `d` shortcut to get debug info based on the current play
- Animate underlined box (yagni)
  - Need better UX for specifying the position of the box.
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
