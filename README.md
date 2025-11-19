# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m10
Clean up PlanAction

# m10b
- Break PlanAction into these types:
  1. PlayVideoAction
    - volume
    - playbackRate
  2. OverlayAction. Fields
    - overlay
  3. DisplayAction (decide which youtube player iframe to display and the rest will be hidden)
  4. PauseVideoAction
- All of them will have these fields, so may just have PlanAction be an abstract class for them to inherit from to have these fields:
  - replayPositionMs
  - cmdIdx
  - debugAssetName (originally assetName; this is just needed to help with debugging, not actually needed for replay)
- Preserve the existing replay behavior after these changes (the original spec is in `m5o` in DONE.md). Feel free to add extra fields if the ones above are not sufficient to make everything work.
- Before executing the actions, may sure they are sorted:
  - ascending in replayPositionMs
  - if replayPositionMs is tied, sort them in the above listed order (PlayVideoAction first, OverlayAction etc.)


# m10a
- Rename start to replayStartMs and end to replayEndMs within PlanAction and its usages.

# wishlist
- Consider getting rid of cmdIdx once we have a good way to id things (may be use name + id to identify html elements to avoid dealing with cmdIdx)
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
