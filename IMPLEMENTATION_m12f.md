# Implementation m12f - Two-Column Layout

## Summary
Restructured the editor layout into a two-column design with independent scrolling.

## Changes Made

### Layout Structure (src/edit.ts)
- Created a flex container with two columns:
  - **Left column** (fixed width, no scrolling):
    - Project title with edit icon
    - Replay video container
    - Action buttons (Shortcuts, Present, Short, Edit Short) stacked vertically
  - **Right column** (flexible width, independent scrolling):
    - Command table with all editing functionality
    - Scrolls independently when content overflows

### Benefits
- Title and video player remain visible while scrolling through long command lists
- Better use of screen space
- Easier access to playback controls and buttons
- More ergonomic for editing long projects

### Technical Details
- Used CSS flexbox for layout
- Left column: `flex: 0 0 auto` (fixed size)
- Right column: `flex: 1` (takes remaining space) with `overflow: auto`
- Replay container moved from body top to left column container
- Buttons changed from horizontal to vertical layout for better fit
