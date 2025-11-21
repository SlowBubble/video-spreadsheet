# Implementation: Auto-Tether (m12j)

## Overview
Auto-tether automatically keeps position values synchronized across commands and subcommands when they share the same time position.

## Features Implemented

### 1. Editor Fields
- `autoTether: boolean = true` - Defaults to enabled
- `idToPos0: Map<number, number>` - Maps id to Pos 0 (positionMs)
- `idToPos1: Map<number, number>` - Maps id to Pos 1 (end position)

### 2. Core Methods

#### `computeTetherMaps()`
- Computes current position maps for all commands and subcommands
- Called on editor load and after tether updates

#### `applyAutoTether(): number`
- Detects position changes by comparing old and new maps
- Finds other ids with matching old positions
- Updates their positionMs to match the new position
- Returns count of updated positions
- Only runs if `autoTether` is enabled

#### `updatePositionMsForId(id, newPositionMs)`
- Updates positionMs for a command or subcommand by id
- For commands: directly updates `positionMs`
- For subcommands: adjusts `startMs` and `endMs` to achieve desired absolute position

#### `getTetheredIds(targetPos): Set<number>`
- Returns all ids that share a given position value

#### `isPositionTethered(id, isPos0): boolean`
- Checks if a position is tethered (shared by multiple ids)
- Used for visual indication

### 3. Visual Indication
- Tethered positions in Pos 0 and Pos 1 columns display in **dark blue** color
- Applied to both command and subcommand rows

### 4. Keyboard Shortcut
- **Shift+T**: Toggle auto-tether on/off
- Shows banner indicating current state (enabled/disabled)

### 5. Integration
- `maybeSave()` calls `applyAutoTether()` before saving
- Shows banner if positions were updated: "Auto-tether updated N position(s)"
- Tether maps are recomputed after updates

### 6. Documentation
- Added Shift+T to shortcuts modal

## How It Works

1. When editor loads, compute initial tether maps
2. User edits a position value (Pos 0 or Pos 1)
3. On save, `applyAutoTether()` runs:
   - Computes new position maps
   - Compares with old maps to detect changes
   - For each changed position, finds other ids with matching old value
   - Updates those ids to the new position value
   - Shows banner if updates occurred
4. Visual feedback: tethered positions show in dark blue

## Example Scenario

1. Command A has Pos 0 = 5000ms
2. Command B has Pos 0 = 5000ms (tethered to A)
3. User changes Command A's Pos 0 to 6000ms
4. Auto-tether detects the change and updates Command B's Pos 0 to 6000ms
5. Banner shows: "Auto-tether updated 1 position"
6. Both positions now display in dark blue (still tethered)
