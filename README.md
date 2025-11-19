# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m11
- Make subcommands work for overlay

## m11a
- Define its own class called Subcommand with these fields
```
  startMs: number;
  endMs: number;
  name: string;
  overlay?: Overlay;
```
- Add a field, subcommands of type []Subcommand to ProjectCommand
  - Make persisting subcommands work (serialize to and deserialize from JSON string)
- How to add a subcommand in the UI?
  - When the user press `cmd+enter` for a row that is a command, add a subcommand with the following fields:
    - startMs: same as startMs of the command
    - endMs: same as endMs of the command
    - name: 'Subcommand'
    
### How to interpret a subcommand?

Plan generation changes:
- Add a OpType option, ADD_OVERLAY
- Add a field cmdIdxToOngoingSubcmdIndices (ci2osi) to OpEvtsGroup, tracking what are the ongoing subcommands for each ongoing command
  - The subcommandIdx is defined as the index of the subcommand array of a given command.
  - When passing the start of 1 or more subcommands, add them to ci2osi
  - When passing the end of 1 or more subcommands, remove them from ci2osi
- Update generateOverlayActions if there are osi with overlay for the currently visible cmdIdx.

# m10d (done)
Rewrite plan generation (note that the behavior should not change, so if I'm missing any info propagation, feel free to add them as needed to ensure the behavior stays the same):
- Create a class OpEvtsGroup with OpEvt[] field OpEvts and field ongoingCmdIndices (a set of numbers) where class OpEvt has fields isStart, timeMs and mediaType (enum AUDIO, VISUAL, AUDIO_AND_VISUAL)
- (Do this in a private method) Process the commands being passed into 2 OpEvt each, and then group them by timeMs and sort the resulting OpEvtsGroup[] groups by ascending timeMs.
  - If there is extendAudioSec, there should be 3 events (first start AUDIO_AND_VISUAL, then stop VISUAL, then stop AUDIO_AND_VISUAL)
- (Do this in a private method) Go thru the groups and populate the ongoingCmdIndices (oci) set for each group.
    - The cmdIdx is defined as the index of the commands.
    - When passing the start of 1 or more commands, add them to oci
    - When passing the end of 1 or more commands, remove them to oci
- (Do this in a private method) Generate PlayVideoAction[].
- (Do this in a private method) Generate PauseVideoAction[].
- (Do this in a private method) Generate DisplayAction[], by using the max of the oci for each group.
  - Have a clean up step where if consecutive display actions have the same cmdIdx deduplicate (the reason to break it up into a separate step is to keep generation logic simple, i.e. only depend on info for a single group)
- (Do this in a private method) Generate OverlayAction, appending the overlay for cmdIdx being max of oci, 1 per group (okay to have empty overlay).
  - Have a clean up step where if overlay actions have empty overlay, remove that action
- Merge them together using the existing sorting impl.

# m10c (done)
- Change OverlayAction to use a list of overlays instead of 1 overlay
  - The replayer will then draw the on the canvas by following all the overlays instruction.

# m10b (done)
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
