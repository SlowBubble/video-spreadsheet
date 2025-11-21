# Design Document: Pause/Resume Playback

## Overview

This design implements a three-state playback system for the video editor: stopped, playing, and paused. The key challenge is enabling resume functionality that continues playback from an arbitrary pause point by regenerating the replay plan with an offset.

## Architecture

### State Management

The ReplayManager will track three distinct states:
- **Stopped**: Initial state, no playback active, position at 0ms
- **Playing**: Active playback with timers running
- **Paused**: Playback halted but position preserved

### Key Components

1. **ReplayManager** (src/replay.ts)
   - Add `paused` boolean state
   - Add `pausedAtMs` number to store pause position
   - Modify `startReplay()` to accept optional resume offset
   - Add `pauseReplay()` method
   - Modify `stopReplay()` to clear pause state

2. **Editor** (src/edit.ts)
   - Update keyboard handler to distinguish between `space` and `shift+space`
   - Implement three-way logic: start → pause → resume vs stop

## Components and Interfaces

### ReplayManager State Properties

```typescript
class ReplayManager {
  replaying: boolean;      // true when actively playing
  paused: boolean;         // true when paused
  pausedAtMs: number;      // position when paused (only set when paused)
  // ... existing properties
}
```

### Method Signatures

```typescript
// Start or resume playback
startReplay(resumeFromMs?: number): void

// Pause playback at current position
pauseReplay(): void

// Stop and reset to beginning
stopReplay(): void
```

## Data Models

### Pause State

The pause state is captured by two properties:
- `paused: boolean` - indicates if currently paused
- `pausedAtMs: number` - the absolute timeline position in milliseconds where pause occurred (only set when transitioning to paused state)

When resuming:
- If `pausedAtMs >= endTime`, resume from the beginning (0ms)
- Otherwise, regenerate the replay plan and resume from `pausedAtMs`

## Implementation Details

### Pause Logic

When `pauseReplay()` is called:
1. Calculate current playback position: `pausedAtMs = replayOffset + (Date.now() - replayStart)`
2. Set `paused = true` and `replaying = false`
3. Clear all timers (`_stepTimeoutId`, `_intervalId`)
4. Pause all YouTube players but keep them visible
5. Keep position display visible showing paused time

### Resume Logic

When `startReplay(resumeFromMs)` is called with a resume offset:
1. If `resumeFromMs >= endTime` (where endTime is the last point in the plan), treat as starting from beginning (resumeFromMs = 0)
2. Generate full replay plan
3. Filter plan to find the step containing `resumeFromMs`
4. Calculate which player should be visible at that time
5. Seek that player to the correct video position
6. Start executing remaining plan steps with adjusted timing
7. Set `paused = false` and `replaying = true`

### Plan Adjustment for Resume

To resume from an arbitrary position:
1. Find the plan step where `step.start <= resumeFromMs < step.end`
2. If the step has a player (idx !== -1), calculate video seek position:
   - `elapsedInStep = resumeFromMs - step.start`
   - `videoElapsed = elapsedInStep` (accounting for speed in the original plan)
   - `seekTo = cmd.startMs + videoElapsed`
3. Start executing from that step with reduced duration: `step.end - resumeFromMs`

### Keyboard Handler Logic

```
if (space pressed):
  if (replaying):
    pauseReplay()
  else if (paused):
    startReplay(pausedAtMs)
  else:
    startReplay()  // start from beginning
    
if (shift+space pressed):
  if (replaying or paused):
    stopReplay()
```

## Error Handling

- When playback reaches the end (black screen interval with idx === -1), automatically transition to paused state with `pausedAtMs` set to the end time
- If resume is attempted when `pausedAtMs >= endTime`, restart from the beginning (0ms)
- Invalid resume positions (negative) will default to starting from beginning

## Testing Strategy

### Manual Testing Scenarios

1. **Basic Pause/Resume**
   - Start playback, pause mid-video, resume → should continue from pause point

2. **Multiple Pause/Resume Cycles**
   - Start, pause, resume, pause again, resume → should work correctly each time

3. **Pause During Overlap**
   - Pause when two videos overlap → correct video should be visible on resume

4. **Stop After Pause**
   - Start, pause, stop → should reset to beginning, next space should start fresh

5. **Pause at Different Speeds**
   - Test with commands at different playback speeds → position calculation should be accurate

6. **Playback Completion**
   - Let playback run to completion → should automatically pause at end time
   - Press space after completion → should restart from beginning

7. **Edge Cases**
   - Pause immediately after start
   - Pause just before end
   - Pause during black screen transition

### Verification Points

- Position display shows correct time when paused
- Position display continues correctly when resumed
- Correct YouTube player is visible after resume
- Video seeks to correct position within the clip
- Volume and speed settings are maintained
- Console logs show correct operations
