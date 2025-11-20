# Implementation m12b: Use Command ID Instead of Index for YouTube Players

## Summary
Refactored the replayer to use command IDs instead of array indices to track YouTube players. This makes the system more robust when commands are moved around, as IDs remain stable while indices change.

## Changes Made

### 1. Changed Players Data Structure
- **Before**: `players: any[] = []` (array indexed by cmdIdx)
- **After**: `players: Map<number, any> = new Map()` (map from command ID to player)

### 2. Updated Player Creation (Constructor)
- Changed initialization from `this.players = []` to `this.players = new Map()`
- Changed from `this.players.push(player)` to `this.players.set(cmdId, player)`
- Removed `this.players.push(null)` for non-YouTube commands (Map only stores actual players)
- Use `cmd.id` instead of array index for player identification
- Updated div IDs to use command ID: `yt-player-edit-${cmdId}` instead of `yt-player-edit-${idx}`

### 3. Updated Player Access Methods

#### `executeActions()`
- Changed from iterating over players array to using command ID lookup
- For play actions: `this.players.get(cmd.id)` instead of `this.players[i]`
- For pause actions: Same pattern using `this.players.get(cmd.id)`
- Updated display logic to use command ID for showing/hiding iframes
- Calculate `visibleCmdId` from `visibleCmdIdx` to compare with Map keys

#### `seekAndPlayAllActiveVideos()`
- Renamed `activeCommands` to `activeCommandIndices` for clarity
- Added logic to find command index from command ID using `findIndex`
- Changed visibility check to compare command IDs instead of indices
- Updated to use `this.players.forEach((player, cmdId) => ...)`
- Calculate `visibleCmdId` from `visibleIdx` for comparison

#### `hideAllPlayers()`
- Updated to iterate using Map's forEach with cmdId
- Changed div lookup to use command ID: `yt-player-edit-${cmdId}`

#### `pauseReplay()`
- No changes needed - already iterates over players correctly

## Key Benefits

1. **Stability**: Command IDs don't change when commands are reordered
2. **Consistency**: Action generation flow still uses cmdIdx (as requested), only player tracking uses IDs
3. **Robustness**: Players remain correctly associated with their commands regardless of array position
4. **Cleaner Code**: No need to store null entries for non-YouTube commands

## Testing Notes

- Verify that players work correctly after moving commands around
- Check that play/pause/display actions still work as expected
- Ensure debug mode still shows all players correctly
- Test resume functionality with command reordering
- Verify that div IDs match the command IDs in the DOM
