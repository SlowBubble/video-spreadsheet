# Implementation m12c: Selective Player Reloading

## Summary
Refactored the YouTube player loading system to track the loaded range (startMs/endMs) for each player and only reload individual players when their range changes, instead of reinitializing the entire replay manager.

## Changes Made

### 1. Added Player Range Tracking
- **New field**: `playerRanges: Map<number, { startMs: number; endMs: number }>`
  - Tracks the loaded startMs and endMs for each player by command ID
- **New field**: `getYouTubeId: ((url: string) => string | null) | null`
  - Stores the YouTube ID extraction function for later use

### 2. Created `loadPlayer()` Method
Refactored player loading into a reusable method:
- **Parameters**: `cmd: any, onReady?: () => void`
- **Functionality**:
  - Extracts YouTube ID and validates
  - Creates or reuses div element for the player
  - Destroys existing player if present (for reloading)
  - Creates new YouTube player with proper configuration
  - Stores player in `players` Map
  - Stores range in `playerRanges` Map
  - Logs cmdId when loading starts and completes
  - Calls optional `onReady` callback when player is ready

### 3. Created `needsPlayerReload()` Method
Checks if a specific player needs reloading:
- **Parameters**: `cmd: any`
- **Returns**: `boolean`
- **Logic**:
  - Returns `true` if player doesn't exist
  - Returns `true` if cmd.startMs < loaded range startMs
  - Returns `true` if cmd.endMs > loaded range endMs
  - Returns `false` otherwise (player can handle the current range)

### 4. Updated Constructor
- Stores `getYouTubeId` function for later use
- Initializes `playerRanges` Map
- Uses `loadPlayer()` method instead of inline player creation
- Maintains initialization tracking with callbacks

### 5. Created `reloadPlayersIfNeeded()` in edit.ts
Replaced `needsReplayManagerReinit()` with a simpler method:
- **Name**: `reloadPlayersIfNeeded()`
- **Parameters**: None
- **Returns**: `void`
- **Functionality**:
  - Gets all enabled commands
  - Iterates through each command
  - Calls `needsPlayerReload()` to check if reload is needed
  - Calls `loadPlayer()` directly if reload is needed
  - No boolean return - just performs the reloads

### 6. Updated `maybeSave()` in edit.ts
Simplified the save logic:
- Removed conditional reinit logic
- Simply calls `reloadPlayersIfNeeded()` when changes are detected
- No longer needs to check return value or decide on full reinit
- Full reinit only happens when explicitly needed (new commands, etc.)

## Console Logging
Added console.log statements:
- `[loadPlayer] Loading player for cmdId=X, startMs=Y, endMs=Z` - when loading starts
- `[loadPlayer] Done loading player for cmdId=X` - when loading completes

## Key Benefits

1. **Performance**: Only reloads affected players instead of all players
2. **Stability**: Maintains playback state for unaffected players
3. **Flexibility**: Can reload individual players on demand
4. **Debugging**: Clear console logs show which players are being reloaded
5. **Efficiency**: Avoids unnecessary player destruction and recreation

## Testing Notes

- Verify that editing startMs/endMs only reloads that specific player
- Check console logs show correct cmdId during reload
- Ensure player works correctly after reload
- Test that adding new commands still triggers full reinit
- Verify that changing assets triggers full reinit
- Test that expanding range (making startMs smaller or endMs larger) triggers reload
- Test that shrinking range (within loaded bounds) doesn't trigger reload
