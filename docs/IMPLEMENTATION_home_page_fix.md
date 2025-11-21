# Home Page Layout Fix

## Problem
The edit page has a fixed replay container positioned at the top left, which was pushing content to the right. This styling was also affecting the home page, causing the centered content to be misaligned.

## Solution
Isolated the edit page and home page styling by using a body class to differentiate between the two modes.

## Changes Made

### 1. src/edit.ts
- Added `document.body.classList.add('edit-mode')` in the Editor constructor
- This marks the body element when in edit mode

### 2. src/main.ts
- Added `document.body.classList.remove('edit-mode')` in the `renderHome()` function
- Ensures the home page doesn't have the edit-mode class

### 3. src/style.css
- Split the `#app` styling into two rules:
  - `body:not(.edit-mode) #app`: Home page styling with centered content (max-width: 1200px, margin: 0 auto)
  - `body.edit-mode #app`: Edit page styling with left margin to accommodate replay container (margin-left: 870px)

## Result
- Home page content is now properly centered
- Edit page content is positioned to the right of the replay container
- Both pages maintain their intended layouts without interfering with each other
