# Subcommand Implementation

## Overview
This implementation adds support for subcommands within ProjectCommands, allowing overlays to be displayed at specific time ranges within a command's playback.

## Changes Made

### 1. Data Model (src/project.ts)

#### New Subcommand Class
```typescript
export class Subcommand {
  startMs: number;
  endMs: number;
  name: string;
  overlay?: Overlay;
}
```

#### Updated ProjectCommand
- Added `subcommands: Subcommand[]` field
- Updated constructor to accept subcommands parameter
- Updated serialization/deserialization in `Project.fromJSON()` and `TopLevelProject.fromData()` to handle subcommands with their overlays

### 2. UI Integration (src/edit.ts)

#### New Keyboard Shortcut
- **cmd+enter**: Adds a subcommand to the currently selected command
  - Creates subcommand with same startMs/endMs as parent command
  - Default name: "Subcommand"
  - Shows banner with count of subcommands

#### Implementation
- Added `handleCmdEnterKey()` method
- Imported `Subcommand` class
- Added keyboard handler in `handleKey()` method

### 3. Replay Logic (src/replay.ts)

#### New OpTypes
- Added `ADD_OVERLAY` to OpType enum for subcommand overlay start events
- Added `REMOVE_OVERLAY` to OpType enum for subcommand overlay end events

#### Updated OpEvt
- Added optional `subcommandIdx?: number` field to track which subcommand an event belongs to

#### Updated OpEvtsGroup
- Added `cmdIdxToOngoingSubcmdIndices: Map<number, Set<number>>` (ci2osi)
  - Maps command index to set of ongoing subcommand indices
  - Tracks which subcommands are active at each time point

#### Updated Event Generation
**createOpEvts()**:
- Now generates ADD_OVERLAY events for subcommand start times
- Now generates REMOVE_OVERLAY events for subcommand end times
- Calculates absolute time based on command's position and playback speed
- Formula: `subStartTime = cmdStartTime + (subStartOffset / playbackRate)`

**populateOngoingCmdIndices()**:
- Processes ADD_OVERLAY events to add subcommands to ci2osi map
- Processes REMOVE_OVERLAY events to remove subcommands from ci2osi map
- Clears all subcommands when parent command ends (HIDE_VISUAL or PAUSE_VIDEO)

**generateOverlayActions()**:
- Collects overlays from both command and its ongoing subcommands
- Adds command overlay first, then subcommand overlays
- Only includes overlays from the currently visible command

## How It Works

### Adding a Subcommand
1. User selects a command row in the editor
2. User presses `cmd+enter`
3. New subcommand is created with:
   - `startMs`: same as command's startMs
   - `endMs`: same as command's endMs
   - `name`: "Subcommand"
   - `overlay`: undefined (can be edited later)

### Interpreting Subcommands During Replay
1. **Plan Generation**: 
   - ADD_OVERLAY events are created for each subcommand's start
   - REMOVE_OVERLAY events are created for each subcommand's end
   - Events are sorted and grouped by time
   
2. **Tracking State**:
   - `ci2osi` map tracks which subcommands are active for each command
   - When processing ADD_OVERLAY event: add subcommand to ci2osi
   - When processing REMOVE_OVERLAY event: remove subcommand from ci2osi
   
3. **Overlay Rendering**:
   - For the visible command, collect its overlay (if any)
   - Add overlays from all ongoing subcommands
   - Multiple overlays are drawn in order (command first, then subcommands)

## UI for Editing Subcommands

### Table Display
- Subcommand rows appear directly below their parent command
- Visually distinguished with:
  - Light gray background (#f5f5f5)
  - Indented name with arrow: `  ↳ Subcommand`
- Only relevant columns are shown:
  - Asset: Shows subcommand name (editable)
  - Start: Shows startMs relative to command (editable)
  - Dur: Shows duration (editable via endMs)
  - Text: Shows overlay text (editable)
  - Fill: Shows overlay preview canvas

### Editing Subcommands
Press `Enter` on a subcommand row to edit:
- **Column 1 (Asset)**: Edit subcommand name
- **Column 4 (Start)**: Edit startMs time
- **Column 5 (Dur)**: Edit endMs time
- **Column 8 (Text)**: Edit overlay text (opens textarea modal)
- **Column 9 (Fill)**: Overlay editing (not yet implemented)

### Navigation
- Arrow keys navigate through all rows (commands and subcommands)
- Selection works the same way for both command and subcommand rows

## Keyboard Shortcuts

### Working with Subcommands
- **cmd+enter**: Add a new subcommand to the selected command
- **backspace**: Remove selected command or subcommand (with confirmation)
- **f**: Cycle fullscreen filter (works on both commands and subcommands)
- **b**: Toggle border filter (works on both commands and subcommands)
- **a**: Toggle text alignment (works on both commands and subcommands)
- **alt+left/right**: Adjust time values for Start/Dur columns (works on subcommands)

### Command-Only Shortcuts
- **[/]**: Adjust extendAudioSec
- **Volume/Speed cycling**: Only works on commands

### Reordering
- **alt+up/down**: Move command or subcommand up/down
  - For commands: Reorders in the main command list
  - For subcommands: Reorders within the parent command

## Fixed Issues
- **Backspace removal**: Now correctly handles row offsets when subcommands are present
- **All keyboard shortcuts**: Updated to use rowTypes system instead of direct array indexing
- **Copy/paste**: Works correctly with subcommands (copy supported, paste for subcommands coming soon)
- **Overlay removal**: Fixed issue where subcommand overlays weren't being removed at end time
  - Removed `removeEmptyOverlayActions` which was filtering out empty overlay actions
  - Empty overlay actions are now kept (needed to clear overlays when subcommands end)
  - All overlay actions are generated and executed, ensuring proper overlay state changes

## Future Enhancements
- Paste support for subcommands
- Keyboard shortcuts to move subcommands between commands
- Bulk operations on subcommands
