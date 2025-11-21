# Implementation: m12l - Hierarchical Names (hNames)

## Overview
Added hierarchical naming system for rows in the Editor that displays relationship-based identifiers in the checkbox column.

## Implementation Details

### 1. Data Structure
- Added `idToHName: Map<number, string>` field to Editor class
- Maps each command/subcommand ID to its hierarchical name

### 2. hName Computation (`computeHNames()`)
The method computes hierarchical names based on containment relationships.

**Runtime Complexity: O(n²)** where n = total number of rows (commands + subcommands)
- Containment checking: O(n²) - compares every pair of rows
- Sorting and naming: O(n log n) - dominated by the containment check
- Practical impact: For typical projects with <100 rows, this runs in <10ms

#### Containment Logic (75% threshold)
- If rowA overlaps with rowB for >75% of rowA's duration, rowA is contained in rowB
- If mutual containment exists, rows are siblings
- If one-way containment, the containing row is the parent

#### Naming Convention
1. **Roots**: Commands/subcommands without parents
   - Grouped by siblings and sorted by minimum positionMs
   - First group: '1', '1a', '1b', ...
   - Second group: '2', '2a', '2b', ...
   
2. **Children**: Recursively named based on parent
   - Children of '1': '1-1', '1-2', '1-3', ...
   - Children of '1a': '1a-1', '1a-2', ...
   - Children of '1-1': '1-1-1', '1-1-2', ...

### 3. Display Logic
- hName is displayed in the checkbox column (column 0)
- Display rules:
  - If row has hName AND is enabled: show only hName (e.g., `1`, `1a-2`)
  - If row is disabled: show unchecked box `☐`
  - If row has no hName and is enabled: show checked box `☑`

### 4. Styling
- **Bold font**: First two columns (checkbox and asset) are bold for root-level rows
  - Root-level = hName exists and contains no dash (e.g., `1`, `2a`, `3b`)
  - Child rows with dashes (e.g., `1-1`, `2a-3`) remain normal weight

### 5. Integration Points
- `computeHNames()` is called in `loadEditor()` after `computeTetherMaps()`
- Display logic updated in `getDisplayValue()` for both commands and subcommands

## Usage
hNames are automatically computed when the editor loads and displayed in the first column for enabled rows.

## Performance Considerations
Given the O(n²) complexity, consider calling `computeHNames()`:
- ✅ **Good**: On editor load, after undo/redo, after import
- ⚠️ **Caution**: After every edit if project has >200 rows
- ❌ **Avoid**: On every keystroke or render cycle

For most projects (<100 rows), the computation is fast enough to call after any structural change (add/remove/move commands).
