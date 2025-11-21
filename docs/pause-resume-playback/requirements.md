# Requirements Document

## Introduction

This feature enhances the video playback controls in the spreadsheet video editor by implementing pause/resume functionality. Currently, pressing `space` toggles between starting and stopping replay (which resets to 0 seconds). The new behavior will allow users to pause playback at any point and resume from that exact position, while `shift+space` will stop and reset playback.

## Glossary

- **ReplayManager**: The system component responsible for managing video playback, including starting, pausing, resuming, and stopping replay operations
- **Replay Plan**: A data structure containing timed actions that specify which YouTube player should be visible at each time interval during playback
- **Pause State**: The system state where playback is temporarily halted but maintains the current playback position for later resumption
- **Resume Offset**: The time position in milliseconds from which playback should continue after being paused

## Requirements

### Requirement 1

**User Story:** As a video editor, I want to pause playback with the space key, so that I can temporarily halt the video without losing my current position

#### Acceptance Criteria

1. WHEN the user presses the space key AND the ReplayManager is currently replaying, THE ReplayManager SHALL pause the playback and preserve the current time position
2. WHEN the ReplayManager pauses playback, THE ReplayManager SHALL display all YouTube players in a paused state
3. WHEN the ReplayManager pauses playback, THE ReplayManager SHALL maintain the position display showing the paused time
4. WHEN the ReplayManager pauses playback, THE ReplayManager SHALL store the pause time offset for later resumption

### Requirement 2

**User Story:** As a video editor, I want to resume playback from where I paused, so that I can continue watching without restarting from the beginning

#### Acceptance Criteria

1. WHEN the user presses the space key AND the ReplayManager is in a paused state, THE ReplayManager SHALL resume playback from the stored pause position
2. WHEN the ReplayManager resumes playback, THE ReplayManager SHALL regenerate the replay plan starting from the pause offset
3. WHEN the ReplayManager resumes playback, THE ReplayManager SHALL display the correct YouTube player based on the current time position
4. WHEN the ReplayManager resumes playback, THE ReplayManager SHALL update the position display to reflect the continuing playback time

### Requirement 3

**User Story:** As a video editor, I want to stop and reset playback with shift+space, so that I can return to the beginning and start over

#### Acceptance Criteria

1. WHEN the user presses shift+space AND the ReplayManager is replaying or paused, THE ReplayManager SHALL stop all playback
2. WHEN the ReplayManager stops playback, THE ReplayManager SHALL reset the playback position to 0 milliseconds
3. WHEN the ReplayManager stops playback, THE ReplayManager SHALL hide all YouTube players and display the black screen
4. WHEN the ReplayManager stops playback, THE ReplayManager SHALL hide the position display
5. WHEN the ReplayManager stops playback, THE ReplayManager SHALL clear any stored pause state

### Requirement 4

**User Story:** As a video editor, I want the space key to start playback when not playing, so that I can begin watching the video

#### Acceptance Criteria

1. WHEN the user presses the space key AND the ReplayManager is not replaying or paused, THE ReplayManager SHALL start playback from the beginning
2. WHEN the ReplayManager starts playback from the beginning, THE ReplayManager SHALL generate the full replay plan starting at 0 milliseconds
