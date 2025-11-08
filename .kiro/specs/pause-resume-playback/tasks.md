# Implementation Plan

- [x] 1. Add pause state management to ReplayManager
  - Add `paused: boolean` property initialized to `false`
  - Add `pausedAtMs: number` property (uninitialized, only set when paused)
  - Store references to `replayStart` and `replayOffset` as instance properties for pause calculation
  - _Requirements: 1.1, 1.4_

- [x] 2. Implement pauseReplay() method in ReplayManager
  - [x] 2.1 Calculate current position: `pausedAtMs = replayOffset + (Date.now() - replayStart)`
    - Store the calculated position in the `pausedAtMs` property
    - _Requirements: 1.1, 1.4_
  
  - [x] 2.2 Update state flags and clear timers
    - Set `paused = true` and `replaying = false`
    - Clear `_stepTimeoutId` and `_intervalId` timers
    - _Requirements: 1.1_
  
  - [x] 2.3 Pause all YouTube players without hiding them
    - Call `pauseVideo()` on all players but keep their divs visible
    - Keep position display visible showing the paused time
    - _Requirements: 1.2, 1.3_

- [x] 3. Modify startReplay() to support resume functionality
  - [x] 3.1 Add optional `resumeFromMs` parameter to startReplay()
    - Default to `undefined` for starting from beginning
    - _Requirements: 2.1, 4.1_
  
  - [x] 3.2 Implement resume-from-end detection
    - Generate the full replay plan
    - Calculate `endTime` as the last point in the plan
    - If `resumeFromMs >= endTime`, set `resumeFromMs = 0` to restart from beginning
    - _Requirements: 2.2_
  
  - [x] 3.3 Implement plan filtering for resume
    - Find the plan step where `step.start <= resumeFromMs < step.end`
    - Calculate the remaining duration for that step: `step.end - resumeFromMs`
    - Start executing from that step with adjusted timing
    - _Requirements: 2.2, 2.3_
  
  - [x] 3.4 Implement video seeking for resume
    - Calculate elapsed time within the current step
    - Seek the YouTube player to the correct position within its video clip
    - Account for playback speed in the seek calculation
    - _Requirements: 2.3_
  
  - [x] 3.5 Update state flags for resume
    - Set `paused = false` and `replaying = true`
    - Update `replayStart` and `replayOffset` for position tracking
    - _Requirements: 2.4_

- [x] 4. Modify stopReplay() to clear pause state
  - Add logic to set `paused = false` when stopping
  - Clear `pausedAtMs` by setting it to `undefined` or not referencing it
  - _Requirements: 3.5_

- [x] 5. Handle automatic pause at playback end
  - Modify the `nextStep()` function to detect when reaching the final black screen step
  - When `step >= plan.length - 1` and `idx === -1`, transition to paused state instead of stopping
  - Set `pausedAtMs` to the end time of the plan
  - _Requirements: 1.4, 3.2_

- [x] 6. Update keyboard handler in Editor for pause/resume/stop
  - [x] 6.1 Add `shift+space` key detection
    - Use `matchKey(e, 'shift+space')` to detect the stop command
    - Call `stopReplay()` when detected during replay or pause
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 6.2 Modify `space` key handler for three-state logic
    - If `replaying`, call `pauseReplay()`
    - Else if `paused`, call `startReplay(pausedAtMs)`
    - Else call `startReplay()` to start from beginning
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 7. Add console logging for debugging
  - Log pause events with the pause position
  - Log resume events with the resume position
  - Log when resuming from end (restarting from beginning)
  - _Requirements: 1.1, 2.1_
