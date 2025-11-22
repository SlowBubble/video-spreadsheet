# Implementation: m13a - Wait for Players to Load on Replay

## Overview
When users request replay before all YouTube players are loaded, instead of disallowing it with a temporary banner, the system now waits for all players to load and shows a persistent "Waiting for players to load..." banner.

## Changes Made

### Modified: `src/replay.ts`

**Location:** `startReplay()` method

**Before:**
- Checked if `!this.isInitialized`
- Showed a 2-second yellow banner saying "Loading is not finished."
- Returned immediately, preventing replay from starting

**After:**
- Checks if `!this.isInitialized`
- Shows a yellow banner saying "Waiting for players to load..." (5 second duration)
- Polls every 100ms to check if `this.isInitialized` becomes true
- Once initialized:
  - Clears the polling interval
  - Removes the waiting banner (if still visible)
  - Recursively calls `startReplay()` to begin playback

## Technical Details

### Polling Mechanism
- Uses `setInterval` with 100ms interval to check initialization status
- Clears interval once players are ready
- Removes banner by ID (`loading-banner`) before starting replay

### Banner Configuration
- **Message:** "Waiting for players to load..."
- **Position:** top
- **Color:** yellow
- **Duration:** 5000ms (5 seconds)

## Additional Changes

### Removed: `showInitBanner()` method
- Previously showed "Player loaded!" banner when all players were ready
- No longer needed since users can start replay immediately

### Removed: State tracking variables
- `playersReadyCount` - removed from class properties
- `totalPlayersExpected` - removed from class properties
- These are now local variables in the `onYouTubeIframeAPIReady` callback

## User Experience
1. User clicks replay before players are loaded
2. Yellow banner appears at top: "Waiting for players to load..." (5 seconds)
3. System polls every 100ms for player initialization
4. Once all players are ready:
   - Banner is removed (if still visible)
   - Replay starts automatically from the requested position

## Testing Considerations
- Test with slow network connections to verify banner appears
- Verify banner is removed once players load
- Ensure replay starts correctly after waiting
- Test with resume positions (resumeFromMs parameter)
- Test with endMs parameter
