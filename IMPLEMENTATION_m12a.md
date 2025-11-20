# Implementation: m12a - Command ID Assignment

## Summary
Added an `id` field to each `ProjectCommand` that automatically assigns unique IDs to commands.

## Changes Made

### 1. ProjectCommand Class (src/project.ts)
- Added `id: number` field to the class
- Updated constructor to accept optional `id` parameter (defaults to 0)
- Updated `fromJSON` to read and preserve the `id` field from JSON data

### 2. Project Class (src/project.ts)
- Added `ensureCommandIds()` method that:
  - Finds the highest existing ID among all commands
  - Assigns the next available ID to any command with id === 0 or undefined
- Called `ensureCommandIds()` in the Project constructor to ensure IDs are assigned on load

### 3. Editor Integration (src/edit.ts)
- Updated all locations where commands are created to pass `id: 0` (will be auto-assigned)
- Added calls to `this.project.ensureCommandIds()` after:
  - Pasting a command from clipboard
  - Creating a new command from asset URL
  - Inserting a command via splice

## Behavior

### New Commands
When a new command is created without an ID (or with id === 0), the system automatically assigns it the next available ID.

### Existing Commands
Commands loaded from JSON that already have IDs keep their existing IDs.

### Mixed Scenarios
When a project has both commands with IDs and commands without IDs:
1. The system finds the maximum existing ID
2. Assigns sequential IDs starting from max + 1 to commands without IDs

## Example
```typescript
// Commands with no IDs
const cmd1 = new ProjectCommand(..., 0); // Will get id: 1
const cmd2 = new ProjectCommand(..., 0); // Will get id: 2

// Commands with existing IDs
const cmd3 = new ProjectCommand(..., 5); // Keeps id: 5
const cmd4 = new ProjectCommand(..., 0); // Will get id: 6

const project = new Project('My Project', [cmd1, cmd2, cmd3, cmd4]);
// After construction: cmd1.id=1, cmd2.id=2, cmd3.id=5, cmd4.id=6
```

## Testing
- TypeScript compilation: ✅ Passes
- Build: ✅ Succeeds
- Logic verification: ✅ Tested with multiple scenarios
