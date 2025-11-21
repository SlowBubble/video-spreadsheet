# Implementation m12e - ShortConfig with JSON Editor

## Summary
Created a `ShortConfig` class to consolidate short video settings and made it editable via a JSON textarea modal.

## Changes Made

### 1. Created ShortConfig Class (src/project.ts)
- Added `ShortConfig` class with three fields:
  - `shortStartMs`: number - start time in milliseconds
  - `shortEndMs`: number - end time in milliseconds  
  - `pctOfFullWidth`: number - window size percentage (e.g., 60 for 60%)
- Added `fromJSON()` static method for deserialization

### 2. Updated Project Class (src/project.ts)
- Added `shortConfig?: ShortConfig` field to Project class
- Updated constructor to accept shortConfig parameter
- Updated `serialize()` to include shortConfig
- Added migration logic in `fromJSON()`:
  - If `shortConfig` exists in JSON, use it
  - Otherwise, if old `shortStartMs`/`shortEndMs` exist, migrate them to new ShortConfig with default 60% width
  - Added TODO comment to remove migration code after data migration

### 3. Updated Edit Short Button (src/edit.ts)
- Changed "Edit Short" button to open a textarea modal
- Created `showEditShortConfigModal()` method that:
  - Shows user-friendly JSON with `startTime` and `stopTime` as time strings (e.g., "1:20.5")
  - Translates milliseconds to time strings for display using `msToEditString()`
  - Translates time strings back to milliseconds when saving using `timeStringToMs()`
  - Keeps underlying `ShortConfig` unchanged (still uses `shortStartMs` and `shortEndMs`)
  - Validates JSON structure and field types
  - Validates field values (startMs >= 0, endMs > startMs, pctOfFullWidth > 0)
  - Updates both `shortConfig` and old fields for backward compatibility
  - Shows success/error banners

### 4. Updated Short Button (src/edit.ts)
- Modified "Short" button to use `pctOfFullWidth` from shortConfig
- Falls back to 60% if shortConfig doesn't exist
- Removed prompt for percentage input

### 5. Updated Present Mode (src/edit.ts)
- Updated space key handler in present mode to check for `short=1` URL param
- Only uses shortConfig when `short=1` is present in URL
- In regular present mode (without `short=1`), plays normally from paused position
- Falls back to old shortStartMs/shortEndMs fields for backward compatibility

## Backward Compatibility
- Old `shortStartMs` and `shortEndMs` fields are still maintained
- Migration logic automatically converts old data to new format
- Fallback logic ensures old projects still work
