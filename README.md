# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m12i (done)
- Add id for subcommands similar to command id (make sure they don't clash with both other command ids and subcommand ids)

# m12j (done)
- autoTether defaults to true as an Editor field; use shift+t to toggle it
- Design autoTether work
  - When the pos 0 or pos 1 change for a row and another row has the same old value, modify the positionMs of that other row to keep that value matching
  - Have 2 Editor's fields that store idToPos0 and idToPos1 state before the change
  - Whenever something triggers a change/save, compute the new idToPos0 and idToPos1.
  - Diff each of idToPos0 and idToPos1 against the old one and if there is a change, say for id_a, from old_pos0_a to new_pos0_a, then you go through all the other ids in the old idToPos0 (and idToPos1) to see if there is a matching old_pos0_a and if so, adjust the positionMs for that id so that the new value becomes new_pos0_a
  - After making the adjustments, then compute the new idToPos0 and idToPos1 again and use these to update the Editor's field, and display a banner about how many additional values has changed if >= 1 values are updated as a result of the tethering.
- How do users know which things are auto-tethered: make the cells in pos 0 and pos 1 that are tethered to something else have dark blue font color

# m12k (done)
Add a disabled field for subcommand and have it displayed and toggled and interpreted the same way as command.

# m12l
- Have a method that generates hNames for all rows when the Editor first load and store the result in an internal field..
  - Display hName in the first column (the checkbox column) only if available and the row is not disabled; leave it unchanged otherwise.
## How to compute hName for each row
- Let 75 be containment percentage
- Definition:
  - If rowA overlaps with rowB for > 75% of rowA's duration, then rowA is considered to be contained in rowB.
  - If rowA is contained in rowB and vice versa, then rowA and rowB are siblings.
  - If rowA is contained in rowB but not vice versa, then rowB is a parent of rowA and rowA is a child of rowB.
  - rows that don't have parents are considered roots
- Compute all the containment relationship
  - Can track things via command/subcommand ids
- hName convention
  - Start with roots grouped by siblings and sort these groups by min positionMs
    - hName for the first root group of siblings is '1', '1a', '1b', ...
    - hName for the second root group of siblings is '2', '2a', '2b', ...
  - Then iterate through the children of the roots in the above order, '1', '1a', ... and name the children (ordered by positionMs) of '1' as '1-1', '1-2', ...
    - Name the child of '1a' that hasn't been named previously as '1a-1', '1a-2'.
    - Continue with the rest until everything is named.


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
