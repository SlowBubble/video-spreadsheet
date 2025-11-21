# Implementation m12g - Pos 1 Column Editing

## Summary
Made the `Pos 1` column editable to allow adjusting the end position of commands and subcommands. The column now modifies `endMs` (not `positionMs` or `startMs`).

## Changes Made

### 1. Enter Key Editing (handleEnterKey)
- **Commands**: When pressing Enter on Pos 1 column, prompts user to edit the end position
  - Calculates current end time using `computeCommandEndTimeMs(cmd)`
  - Converts new end position back to `endMs` accounting for playback speed
  - Formula: `endMs = startMs + (newEndTime - positionMs) * rate`

- **Subcommands**: When pressing Enter on Pos 1 column, prompts user to edit absolute end position
  - Calculates current absolute end position accounting for parent's speed
  - Converts new absolute position back to relative `endMs`
  - Formula: `endMs = cmd.startMs + (newAbsoluteEnd - cmd.positionMs) * rate`

### 2. Alt+Left/Right Adjustment (adjustTimeValue)
- **Commands**: Alt+Left/Right now adjusts the end position by ±500ms
  - Modifies `endMs` to achieve the desired end position
  - Shows banner with updated end position

- **Subcommands**: Alt+Left/Right adjusts absolute end position by ±500ms
  - Modifies subcommand `endMs` accounting for parent command's speed
  - Shows banner with updated absolute end position

### 3. Paste Support (pasteCell)
- Updated paste functionality to support Pos 1 column
- Parses clipboard value as milliseconds
- Converts to appropriate `endMs` value accounting for speed

## Technical Details

The key insight is that `Pos 1` displays a calculated value:
- For commands: `positionMs + (endMs - startMs) / rate`
- For subcommands: `cmd.positionMs + (subCmd.endMs - cmd.startMs) / rate`

When editing, we reverse this calculation to determine what `endMs` should be to achieve the desired end position.

## Testing
- Verify Enter key opens prompt with current end position
- Verify Alt+Left/Right adjusts end position by 500ms increments
- Verify paste works with numeric millisecond values
- Verify changes are reflected in the Dur column
- Test with different playback speeds to ensure calculations are correct
