# Goal

- Build a spreadsheet editor which is a video director that instructs the browser how to play out the desired video.

# m10c (done)
- Change OverlayAction to use a list of overlays instead of 1 overlay
  - The replayer will then draw the on the canvas by following all the overlays instruction.

# m10d
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
 
Rewrite plan generation:
- Track the potentiallyVisibleCmdIndices (pvci) set.
  - The cmdIdx is defined as the index of the commands.
  - When passing the start of 1 or more commands, add them to pvci
  - When passing the end of 1 or more commands, remove them to pvci
- Track the cmdIndexToPotentiallyVisibleSubcommandIndices (ci2pvsi)
  - The subcommandIdx is defined as the index of the subcommand array of a given command.
  - When passing the start of 1 or more subcommands, add them to ci2pvsi
  - When passing the end of 1 or more subcommands, remove them to ci2pvsi
- For each group of events (grouped by time) in ascending order:
  - Update the tracking of pvci and ci2pvsi
  - Generate PlayVideoAction and PauseVideoAction for each event with isSubcommand === false
  - Generate DisplayAction for the max of pvci
  - Generate OverlayAction appending the overlay for cmdIdx being max of pvci, and then appending overlays from subcommands by looking them up in ci2pvsi.

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
