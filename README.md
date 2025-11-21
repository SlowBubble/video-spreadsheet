# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.


# m12g
- Allow editing pos 1 column
  - `enter`, `alt+left` and `alt+right`
- Add id for subcommands similar to command id (make sure they don't clash with both other command ids and subcommand ids)
- alwaysTether defaults to true as an Editor field; use shift+t to toggle it
  - color things that are tethered with (different shades of) blue font color
- Design how to be reactive
  - When the pos 0 or pos 1 change for a row and another row has the same old value, modify the positionMs of that other row to keep that value matching
  - Have 2 Editor's fields that store idToPos0 and idToPos1 state before the change
  - Whenever something triggers a change/save, compute the new idToPos0 and idToPos1.
  - Diff each of idToPos0 and idToPos1 against the old one and if there is a change, say for id_a, from old_pos0_a to new_pos0_a, then you go through all the other ids in the old idToPos0 (and idToPos1) to see if there is a matching old_pos0_a and if so, adjust the positionMs for that id so that the new value becomes new_pos0_a
  - After making the adjustments, then compute the new idToPos0 and idToPos1 again and use these to update the Editor's field, and display a banner about how many tethered values has changed.

# wishlist
- Add links back to Dur by computing the footage end time in seconds (round down)
- Add links for the subcommands based on the parent command

- `h` to hide the table (for smaller screens)
- Add a home button.
- Add `d` shortcut to get debug info based on the current play
- Animate underlined box (yagni)
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
