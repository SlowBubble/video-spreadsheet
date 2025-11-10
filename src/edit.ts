import './style.css';
import { Project, ProjectCommand, FullScreenFilter, BorderFilter, TextDisplay, Overlay } from './project';
import { matchKey } from '../tsModules/key-match/key_match';
import { ReplayManager } from './replay';
import { getShortcutsModalHtml, setupShortcutsModal } from './shortcutsDoc';
import { getHashParams } from './urlUtil';
import { showBanner } from './bannerUtil';
import { UndoManager } from './undo';

const columns = ['Asset', 'Pos 0', 'Pos 1', 'Start', 'End', 'Volume', 'Speed', 'Text'];

// Inverse of the following:
// Translate a timeString that can look like 1:23 to 60 * 1 + 23
// Similarly 1:2:3 is 60*60*1+60*2+3
function msToTimeString(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 4800);
  const m = Math.floor((seconds % 4800) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

// Helper to extract YouTube video ID from a URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu.be\/|embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

// Helper to extract the 't' parameter from a YouTube URL and convert to milliseconds
function extractTimeFromUrl(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const tParam = urlObj.searchParams.get('t');
    if (!tParam) return null;
    
    // Parse formats like "922s", "15m22s", "1h15m22s", or just "922"
    let totalSeconds = 0;
    
    // Try to match hours, minutes, seconds
    const hoursMatch = tParam.match(/(\d+)h/);
    const minutesMatch = tParam.match(/(\d+)m/);
    const secondsMatch = tParam.match(/(\d+)s/);
    
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
    if (secondsMatch) totalSeconds += parseInt(secondsMatch[1]);
    
    // If no time units found, assume it's just seconds
    if (!hoursMatch && !minutesMatch && !secondsMatch) {
      totalSeconds = parseInt(tParam);
    }
    
    return totalSeconds * 1000; // Convert to milliseconds
  } catch (e) {
    return null;
  }
}

// Convert speed percentage to playback rate
// Speed is stored as percentage (5-100), but YouTube API uses rate (0.05-1.0)
function speedToRate(speed: number): number {
  return speed / 100;
}

// Ensure command has an overlay object (create if undefined)
function ensureOverlay(cmd: ProjectCommand): Overlay {
  if (!cmd.overlay) {
    cmd.overlay = new Overlay();
  }
  return cmd.overlay;
}

// Compute the absolute end time in ms for a command
// Takes into account playback speed: slower speed = longer duration
function computeCommandEndTimeMs(cmd: ProjectCommand): number {
  const videoDuration = cmd.endMs - cmd.startMs;
  const rate = speedToRate(cmd.speed);
  const actualDuration = videoDuration / rate;
  return cmd.positionMs + actualDuration;
}

export class Editor {
  projectId: string;
  project!: Project;
  selectedRow: number = 0;
  selectedCol: number = 0;
  replayManager!: ReplayManager;
  replayDiv: HTMLDivElement;
  clipboard: string = '';
  undoManager!: UndoManager;

  constructor() {
    const params = getHashParams();
    const isPresentMode = params.get('present') === '1';
    
    // Create persistent replay container at the top of the body
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) {
      replayDiv = document.createElement('div');
      replayDiv.id = 'replay-container';
      if (!isPresentMode) {
        replayDiv.style.marginBottom = '24px';
      }
      document.body.insertBefore(replayDiv, document.body.firstChild);
    }
    this.replayDiv = replayDiv;
    
    this.projectId = this.getProjectIdFromHash()!;
    this.loadEditor(this.loadProject(this.projectId));
    
    window.addEventListener('keydown', (e) => {
      const params = getHashParams();
      const isPresentMode = params.get('present') === '1';
      this.handleKey(e, isPresentMode);
    });
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  private loadEditor(project: Project) {
    this.project = project;
    this.selectedRow = 0;
    this.selectedCol = 0;
    this.renderTable();
    this.initReplayManager();
    this.undoManager = new UndoManager(this.project.serialize());
  }

  initReplayManager() {
    this.replayManager = new ReplayManager(
      this.replayDiv,
      this.project.commands,
      getYouTubeId
    );
  }

  getProjectIdFromHash(): string | null {
    const params = getHashParams();
    return params.get('id');
  }

  loadProject(id: string): Project {
    const json = localStorage.getItem('project-' + id);
    if (json) {
      return Project.fromJSON(json);
    }
    return new Project('Untitled Project', id, []);
  }

  getDisplayValue(rowIdx: number, colIdx: number): string {
    // Empty row at the end
    if (rowIdx >= this.project.commands.length) return '';
    
    const cmd = this.project.commands[rowIdx];
    
    switch (colIdx) {
      case 0: // Asset
        return cmd.name ? cmd.name : cmd.asset;
      case 1: // Pos 0 (start position)
        return msToTimeString(cmd.positionMs);
      case 2: // Pos 1 (end position, calculated)
        return msToTimeString(computeCommandEndTimeMs(cmd));
      case 3: // Start
        return msToTimeString(cmd.startMs);
      case 4: // End
        return msToTimeString(cmd.endMs);
      case 5: // Volume
        return cmd.volume.toString();
      case 6: // Speed (display as percentage)
        return cmd.speed.toString();
      case 7: // Text
        return cmd.overlay?.textDisplay?.content || '';
      default:
        return '';
    }
  }

  getCellContent(rowIdx: number, colIdx: number, cellValue: string): string {
    // Empty row at the end
    if (rowIdx >= this.project.commands.length) return cellValue;
    
    const cmd = this.project.commands[rowIdx];
    
    // For Pos 0 and Pos 1 columns, create clickable buttons
    if (colIdx === 1 || colIdx === 2) {
      const timeMs = colIdx === 1 ? cmd.positionMs : computeCommandEndTimeMs(cmd);
      const dimStyle = colIdx === 2 ? 'opacity: 0.5;' : '';
      return `<button class="time-seek-btn" data-time-ms="${timeMs}" style="padding: 4px 8px; cursor: pointer; ${dimStyle}">${cellValue}</button>`;
    }
    
    // For Start and End columns, create clickable links
    if (colIdx === 3 || colIdx === 4) {
      const timeMs = colIdx === 3 ? cmd.startMs : cmd.endMs;
      const timeInSeconds = Math.floor(timeMs / 1000);
      
      // Get the asset URL and remove existing 't' parameter
      const assetUrl = cmd.asset;
      if (!assetUrl) return cellValue;
      
      try {
        const url = new URL(assetUrl);
        // Remove existing 't' parameter
        url.searchParams.delete('t');
        // Add new 't' parameter with the time value
        url.searchParams.set('t', `${timeInSeconds}s`);
        
        const linkUrl = url.toString();
        return `<a href="${linkUrl}" target="_blank" style="color: blue; text-decoration: underline;">${cellValue}</a>`;
      } catch (e) {
        // If URL parsing fails, just return the cell value
        return cellValue;
      }
    }
    
    return cellValue;
  }

  getRowCount(): number {
    // Always show at least one empty row
    return Math.max(1, this.project.commands.length + 1);
  }

  seekToSelectedRow() {
    // Only seek if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    const positionMs = cmd.positionMs;
    
    console.log(`[Editor] Seeking to row ${this.selectedRow} position: ${(positionMs / 1000).toFixed(1)}s`);
    this.replayManager.seekToTime(positionMs);
  }

  renderTable() {
    const params = getHashParams();
    const isPresentMode = params.get('present') === '1';
    
    // In present mode, hide everything except the replay container
    if (isPresentMode) {
      document.querySelector<HTMLDivElement>('#app')!.innerHTML = '';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      return;
    }
    
    const editIcon = `<span id="edit-title" style="cursor:pointer; margin-right:8px;" title="Edit title">✏️</span>`;
    const titleHtml = `<div style="display:flex; align-items:center; font-size:2em; font-weight:bold;">
      ${editIcon}<span>${this.project.title}</span>
    </div>`;

    const rowCount = this.getRowCount();
    const tableRows: string[] = [];
    
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const cells: string[] = [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const isSelected = rowIdx === this.selectedRow && colIdx === this.selectedCol;
        const cellValue = this.getDisplayValue(rowIdx, colIdx);
        const cellContent = this.getCellContent(rowIdx, colIdx, cellValue);
        cells.push(`<td style="border: 2px solid ${isSelected ? 'black' : '#ccc'}; padding: 4px;">
          ${cellContent || '&nbsp;'}
        </td>`);
      }
      tableRows.push(`<tr>${cells.join('')}</tr>`);
    }

    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
      <div>
        ${titleHtml}
        <table border="1" style="width:100%; text-align:left; border-collapse: collapse;">
          <thead>
            <tr>
              ${columns.map((col, idx) => `<th style="${idx === 2 ? 'opacity: 0.5;' : ''}">${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>
        <div style="margin-top: 12px;">
          <button id="shortcuts-btn" style="padding: 8px 16px; cursor: pointer; margin-right: 8px;">Shortcuts</button>
          <button id="present-btn" style="padding: 8px 16px; cursor: pointer;">Present</button>
        </div>
      </div>
      ${getShortcutsModalHtml()}
    `;

    const editBtn = document.getElementById('edit-title');
    if (editBtn) {
      editBtn.onclick = () => {
        const newTitle = prompt('Edit project title:', this.project.title);
        if (newTitle !== null) {
          this.project.title = newTitle.trim() || 'Untitled Project';
          this.saveProject();
          this.renderTable();
        }
      };
    }

    const presentBtn = document.getElementById('present-btn');
    if (presentBtn) {
      presentBtn.onclick = () => {
        const currentHash = window.location.hash;
        const newHash = `${currentHash}&present=1`;
        window.open(newHash, '_blank', 'width=854,height=480');
      };
    }

    // Add event listeners for time seek buttons
    const timeSeekButtons = document.querySelectorAll('.time-seek-btn');
    timeSeekButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const timeMs = parseInt((btn as HTMLElement).getAttribute('data-time-ms') || '0');
        
        // Stop current replay if playing
        if (this.replayManager.isPlaying) {
          this.replayManager.stopReplay();
        }
        
        // Start replaying from the specified time
        this.replayManager.startReplay(timeMs);
        console.log(`[Editor] Started replay from ${(timeMs / 1000).toFixed(1)}s via button click`);
      });
    });

    setupShortcutsModal();
  }



  handleKey(e: KeyboardEvent, isPresentMode: boolean = false) {
    // In present mode, only allow space and 0 keys
    if (isPresentMode) {
      if (matchKey(e, '0')) {
        this.replayManager.stopReplay();
        e.preventDefault();
      } else if (matchKey(e, 'space')) {
        if (this.replayManager.isPlaying) {
          this.replayManager.pauseReplay();
        } else {
          this.replayManager.startReplay(this.replayManager.pausedAtMs);
        }
        e.preventDefault();
      }
      return;
    }
    
    // Normal editor mode - all keys work
    const rowCount = this.getRowCount();
    let forceSave = false;
    
    if (matchKey(e, 'up')) {
      this.selectedRow = Math.max(0, this.selectedRow - 1);
      // Only seek if replayer is not playing
      if (!this.replayManager.isPlaying) {
        this.seekToSelectedRow();
      }
    } else if (matchKey(e, 'down')) {
      this.selectedRow = Math.min(rowCount - 1, this.selectedRow + 1);
      // Only seek if replayer is not playing
      if (!this.replayManager.isPlaying) {
        this.seekToSelectedRow();
      }
    } else if (matchKey(e, 'left')) {
      // If replayer is playing, rewind instead of changing column
      if (this.replayManager.isPlaying) {
        this.replayManager.rewind(3000);
      } else {
        this.selectedCol = Math.max(0, this.selectedCol - 1);
      }
    } else if (matchKey(e, 'right')) {
      // If replayer is playing, fast-forward instead of changing column
      if (this.replayManager.isPlaying) {
        this.replayManager.fastForward(2000);
      } else {
        this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
      }
    } else if (matchKey(e, 'tab')) {
      this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
    } else if (matchKey(e, 'shift+tab')) {
      this.selectedCol = Math.max(0, this.selectedCol - 1);
    } else if (matchKey(e, 'enter')) {
      this.handleEnterKey();
    } else if (matchKey(e, '0')) {
      this.replayManager.stopReplay();
    } else if (matchKey(e, 'space') || matchKey(e, 'k')) {
      if (this.replayManager.isPlaying) {
        this.replayManager.pauseReplay();
      } else {
        this.replayManager.startReplay(this.replayManager.pausedAtMs);
      }
    } else if (matchKey(e, 'x')) {
      this.handleExportImport();
    } else if (matchKey(e, 'j')) {
      this.replayManager.rewind(6000);
    } else if (matchKey(e, 'l')) {
      this.replayManager.fastForward(4000);
    } else if (matchKey(e, 'f')) {
      this.cycleFullScreenFilter();
    } else if (matchKey(e, 'b')) {
      this.toggleBorderFilter();
    } else if (matchKey(e, 't')) {
      this.toggleTextAlignment();
    } else if (matchKey(e, 'a')) {
      this.autofillPosition();
    } else if (matchKey(e, 'alt+right')) {
      this.adjustTimeValue(500);
    } else if (matchKey(e, 'alt+left')) {
      this.adjustTimeValue(-500);
    } else if (matchKey(e, 'cmd+c')) {
      this.copyCell();
    } else if (matchKey(e, 'cmd+v')) {
      this.pasteCell();
    } else if (matchKey(e, 'cmd+z')) {
      const performed = this.handleUndo();
      forceSave = performed;
    } else if (matchKey(e, 'cmd+shift+z')) {
      const performed = this.handleRedo();
      forceSave = performed;
    } else if (matchKey(e, 'cmd+s')) {
      // Force save even if nothing changed
      forceSave = true;
    } else if (matchKey(e, 'cmd+x')) {
      this.removeAsset();
    } else if (matchKey(e, 'backspace')) {
      this.removeAsset();
    } else {
      return;
    }
    e.preventDefault();
    this.renderTable();
    this.maybeSave(forceSave);
  }

  cycleFullScreenFilter() {
    // Only toggle if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Cycle through: red -> green -> off
    const redFilter = 'rgba(255, 0, 0, 0.15)';
    const greenFilter = 'rgba(0, 100, 100, 0.15)';
    
    const overlay = ensureOverlay(cmd);
    
    if (!overlay.fullScreenFilter) {
      // Start with red
      overlay.fullScreenFilter = new FullScreenFilter(redFilter);
      console.log(`[Editor] Set fullscreen filter to red on row ${this.selectedRow}`);
      this.showFilterBanner('Fullscreen Filter: Red');
    } else if (overlay.fullScreenFilter.fillStyle === redFilter) {
      // Move to green
      overlay.fullScreenFilter = new FullScreenFilter(greenFilter);
      console.log(`[Editor] Set fullscreen filter to green on row ${this.selectedRow}`);
      this.showFilterBanner('Fullscreen Filter: Green');
    } else {
      // Remove filter
      overlay.fullScreenFilter = undefined;
      console.log(`[Editor] Removed fullscreen filter from row ${this.selectedRow}`);
      this.showFilterBanner('Fullscreen Filter: OFF');
    }
  }

  toggleBorderFilter() {
    // Only toggle if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Cycle through percentage options, then remove
    const percentageOptions = [7, 10, 13, 16, 19];
    const fillStyle = 'rgba(0, 0, 0, 0.85)';
    
    const overlay = ensureOverlay(cmd);
    
    if (!overlay.borderFilter) {
      // Start with first option
      overlay.borderFilter = new BorderFilter(percentageOptions[0], percentageOptions[0], fillStyle);
      console.log(`[Editor] Added border filter ${percentageOptions[0]}% to row ${this.selectedRow}`);
      this.showFilterBanner(`Border Filter: ${percentageOptions[0]}%`);
    } else {
      // Find current percentage and move to next
      const currentPct = overlay.borderFilter.topMarginPct;
      const currentIndex = percentageOptions.indexOf(currentPct);
      
      if (currentIndex === -1 || currentIndex === percentageOptions.length - 1) {
        // If not found or at last option, remove filter
        overlay.borderFilter = undefined;
        console.log(`[Editor] Removed border filter from row ${this.selectedRow}`);
        this.showFilterBanner('Border Filter: OFF');
      } else {
        // Move to next option
        const nextPct = percentageOptions[currentIndex + 1];
        overlay.borderFilter = new BorderFilter(nextPct, nextPct, fillStyle);
        console.log(`[Editor] Updated border filter to ${nextPct}% on row ${this.selectedRow}`);
        this.showFilterBanner(`Border Filter: ${nextPct}%`);
      }
    }
  }

  toggleTextAlignment() {
    // Only toggle if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Only toggle if there is text
    if (!cmd.overlay?.textDisplay || !cmd.overlay.textDisplay.content) {
      return;
    }
    
    // Cycle through alignments: upper-left -> lower-left -> upper-right -> lower-right -> upper-left
    const alignments: Array<'upper-left' | 'lower-left' | 'upper-right' | 'lower-right'> = [
      'upper-left',
      'lower-left',
      'upper-right',
      'lower-right'
    ];
    
    const currentAlignment = cmd.overlay.textDisplay.alignment;
    const currentIndex = alignments.indexOf(currentAlignment);
    const nextIndex = (currentIndex + 1) % alignments.length;
    const nextAlignment = alignments[nextIndex];
    
    cmd.overlay.textDisplay.alignment = nextAlignment;
    
    console.log(`[Editor] Changed text alignment to ${nextAlignment} on row ${this.selectedRow}`);
    this.showFilterBanner(`Text Alignment: ${nextAlignment}`);
  }

  autofillPosition() {
    // Only autofill if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    // Get current position from replay manager
    const currentMs = this.replayManager.getCurrentPosition();
    if (currentMs === null) {
      console.log('[Editor] Cannot autofill - no current position');
      return;
    }
    
    const cmd = this.project.commands[this.selectedRow];
    cmd.positionMs = currentMs;
    
    console.log(`[Editor] Autofilled position to ${(currentMs / 1000).toFixed(1)}s on row ${this.selectedRow}`);
    showBanner(`Position set to ${msToTimeString(currentMs)}`, {
      id: 'autofill-banner',
      position: 'bottom',
      color: 'blue',
      duration: 1500
    });
  }

  createCommandFromAssetUrl(assetUrl: string): ProjectCommand {
    // Extract time from URL if present
    const startMs = extractTimeFromUrl(assetUrl) || 0;
    const endMs = startMs + 4000; // Add 4 seconds
    
    // Autofill position using current time
    const currentMs = this.replayManager.getCurrentPosition() || 0;
    
    // Look up name from existing command with the same asset link
    let name = '';
    const existingCmd = this.project.commands.find(cmd => cmd.asset === assetUrl);
    if (existingCmd && existingCmd.name) {
      name = existingCmd.name + '*';
    }
    
    return new ProjectCommand(assetUrl, currentMs, startMs, endMs, 0, 100, name);
  }

  removeAsset() {
    // Only remove if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    // Remove the command
    this.project.commands.splice(this.selectedRow, 1);
    
    // Adjust selected row if needed
    if (this.selectedRow >= this.project.commands.length && this.selectedRow > 0) {
      this.selectedRow--;
    }
  }

  adjustTimeValue(deltaMs: number) {
    // Only adjust if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Check which column we're on and adjust accordingly
    if (this.selectedCol === 1) {
      // Pos 0 column
      cmd.positionMs = Math.max(0, cmd.positionMs + deltaMs);
      console.log(`[Editor] Adjusted position to ${(cmd.positionMs / 1000).toFixed(1)}s`);
      showBanner(`Position: ${msToTimeString(cmd.positionMs)}`, {
        id: 'adjust-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else if (this.selectedCol === 2) {
      // Pos 1 column - not editable, do nothing
      return;
    } else if (this.selectedCol === 3) {
      // Start column
      cmd.startMs = Math.max(0, cmd.startMs + deltaMs);
      console.log(`[Editor] Adjusted start to ${(cmd.startMs / 1000).toFixed(1)}s`);
      showBanner(`Start: ${msToTimeString(cmd.startMs)}`, {
        id: 'adjust-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else if (this.selectedCol === 4) {
      // End column
      cmd.endMs = Math.max(0, cmd.endMs + deltaMs);
      console.log(`[Editor] Adjusted end to ${(cmd.endMs / 1000).toFixed(1)}s`);
      showBanner(`End: ${msToTimeString(cmd.endMs)}`, {
        id: 'adjust-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else {
      // Not on a time column, do nothing
      return;
    }
  }

  copyCell() {
    // Only copy if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Store the value based on column type
    if (this.selectedCol === 0) {
      // Asset column - copy the underlying asset link
      this.clipboard = cmd.asset;
    } else if (this.selectedCol === 1) {
      // Pos 0 column - store as ms integer string
      this.clipboard = cmd.positionMs.toString();
    } else if (this.selectedCol === 2) {
      // Pos 1 column - store as ms integer string
      this.clipboard = computeCommandEndTimeMs(cmd).toString();
    } else if (this.selectedCol === 3) {
      // Start column - store as ms integer string
      this.clipboard = cmd.startMs.toString();
    } else if (this.selectedCol === 4) {
      // End column - store as ms integer string
      this.clipboard = cmd.endMs.toString();
    } else if (this.selectedCol === 5) {
      // Volume column - store as string
      this.clipboard = cmd.volume.toString();
    } else if (this.selectedCol === 6) {
      // Speed column - store as percentage string
      this.clipboard = cmd.speed.toString();
    } else if (this.selectedCol === 7) {
      // Text column - store as string
      this.clipboard = cmd.overlay?.textDisplay?.content || '';
    }
    
    console.log(`[Editor] Copied: ${this.clipboard}`);
    showBanner('Copied!', {
      id: 'copy-banner',
      position: 'bottom',
      color: 'green',
      duration: 500
    });
  }

  pasteCell() {
    // Don't paste if clipboard is empty
    if (!this.clipboard) return;
    
    const isNewRow = this.selectedRow >= this.project.commands.length;
    
    // For new rows, only allow pasting in the asset column
    if (isNewRow) {
      if (this.selectedCol === 0) {
        // Create new command with asset URL from clipboard
        const assetUrl = this.clipboard.trim();
        if (assetUrl !== '') {
          const newCmd = this.createCommandFromAssetUrl(assetUrl);
          this.project.commands.push(newCmd);
        }
      }
      return;
    }
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Paste based on column type
    if (this.selectedCol === 0) {
      // Asset column - paste the asset link
      cmd.asset = this.clipboard;
    } else if (this.selectedCol === 1) {
      // Pos 0 column - parse as number
      const value = Number(this.clipboard);
      if (isNaN(value)) {
        showBanner('Failed: Invalid number', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
      cmd.positionMs = Math.max(0, value);
      this.seekToSelectedRow();
    } else if (this.selectedCol === 2) {
      // Pos 1 column - not editable, disallow paste
      showBanner('Cannot paste: Pos 1 is not editable', {
        id: 'paste-banner',
        position: 'bottom',
        color: 'red',
        duration: 1500
      });
      return;
    } else if (this.selectedCol === 3) {
      // Start column - parse as number
      const value = Number(this.clipboard);
      if (isNaN(value)) {
        showBanner('Failed: Invalid number', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
      cmd.startMs = Math.max(0, value);
    } else if (this.selectedCol === 4) {
      // End column - parse as number
      const value = Number(this.clipboard);
      if (isNaN(value)) {
        showBanner('Failed: Invalid number', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
      cmd.endMs = Math.max(0, value);
    } else if (this.selectedCol === 5) {
      // Volume column - parse as number
      const value = Number(this.clipboard);
      if (isNaN(value)) {
        showBanner('Failed: Invalid number', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
      cmd.volume = value;
    } else if (this.selectedCol === 6) {
      // Speed column - parse as number
      const value = Number(this.clipboard);
      if (isNaN(value) || value <= 0) {
        showBanner('Failed: Invalid number', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
      cmd.speed = value;
    } else if (this.selectedCol === 7) {
      // Text column - paste as string
      if (this.clipboard.trim() !== '') {
        const overlay = ensureOverlay(cmd);
        overlay.textDisplay = new TextDisplay(this.clipboard);
      } else if (cmd.overlay) {
        cmd.overlay.textDisplay = undefined;
      }
    }
    
    console.log(`[Editor] Pasted: ${this.clipboard}`);
    showBanner('Pasted!', {
      id: 'paste-banner',
      position: 'bottom',
      color: 'green',
      duration: 500
    });
  }

  handleEnterKey() {
    const isExistingCommand = this.selectedRow < this.project.commands.length;
    
    if (this.selectedCol === 0) {
      // Asset column
      if (isExistingCommand) {
        // Edit name
        const cmd = this.project.commands[this.selectedRow];
        const newName = prompt('Edit name:', cmd.name);
        if (newName !== null) {
          cmd.name = newName;
        }
      } else {
        // Create new command with asset URL
        const assetUrl = prompt('Edit Asset URL:', '');
        if (assetUrl !== null) {
          if (assetUrl.trim() === '') {
            // Empty asset URL creates a black screen
            const currentMs = this.replayManager.getCurrentPosition() || 0;
            const newCmd = new ProjectCommand('', currentMs, 0, 4000, 0, 100, 'Black');
            this.project.commands.push(newCmd);
          } else {
            const newCmd = this.createCommandFromAssetUrl(assetUrl.trim());
            this.project.commands.push(newCmd);
          }
        }
      }
    } else if (this.selectedCol === 1) {
      // Pos 0 column - edit position start time
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.positionMs);
        const newValue = prompt('Edit Position:', currentValue);
        if (newValue !== null) {
          cmd.positionMs = this.timeStringToMs(newValue);
          this.seekToSelectedRow();
        }
      }
    } else if (this.selectedCol === 2) {
      // Pos 1 column - not editable, do nothing
      return;
    } else if (this.selectedCol === 3) {
      // Start column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.startMs);
        const newValue = prompt('Edit Start:', currentValue);
        if (newValue !== null) {
          cmd.startMs = this.timeStringToMs(newValue);
        }
      }
    } else if (this.selectedCol === 4) {
      // End column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.endMs);
        const newValue = prompt('Edit End:', currentValue);
        if (newValue !== null) {
          cmd.endMs = this.timeStringToMs(newValue);
        }
      }
    } else if (this.selectedCol === 5) {
      // Volume column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const newValue = prompt('Edit Volume:', cmd.volume.toString());
        if (newValue !== null) {
          const volume = Number(newValue);
          if (!isNaN(volume)) {
            cmd.volume = volume;
          }
        }
      }
    } else if (this.selectedCol === 6) {
      // Speed column (as percentage)
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const newValue = prompt('Edit Speed (%):', cmd.speed.toString());
        if (newValue !== null) {
          const speed = Number(newValue);
          if (!isNaN(speed) && speed > 0) {
            cmd.speed = speed;
          }
        }
      }
    } else if (this.selectedCol === 7) {
      // Text column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentText = cmd.overlay?.textDisplay?.content || '';
        const newValue = prompt('Edit Text:', currentText);
        if (newValue !== null) {
          // Update overlay textDisplay
          if (newValue.trim() !== '') {
            const overlay = ensureOverlay(cmd);
            overlay.textDisplay = new TextDisplay(newValue);
          } else if (cmd.overlay) {
            cmd.overlay.textDisplay = undefined;
          }
        }
      }
    }
  }

  saveProject() {
    localStorage.setItem('project-' + this.projectId, this.project.serialize());
  }

  timeStringToMs(str: string): number {
    if (!str) return 0;
    const parts = str.trim().split(/[: ]/).map(Number).filter(n => !isNaN(n));
    if (parts.length === 0) return 0;
    let total = 0;
    let multiplier = 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      total += parts[i] * multiplier;
      multiplier *= 60;
    }
    return total * 1000;
  }

  showFilterBanner(message: string) {
    showBanner(message, {
      id: 'filter-banner',
      position: 'bottom',
      color: 'blue',
      duration: 1500
    });
  }

  showSaveBanner() {
    showBanner('Saved!', {
      id: 'save-banner',
      position: 'top',
      color: 'green',
      duration: 700
    });
  }

  handleExportImport() {
    // Save current state first
    this.saveProject();
    
    // Get serialized project data
    const serializedData = localStorage.getItem('project-' + this.projectId);
    if (!serializedData) return;
    
    // Open prompt with serialized data selected
    const userInput = prompt('Export/Import project data:', serializedData);
    
    // If cancelled, do nothing
    if (userInput === null) return;
    
    // If confirmed, deserialize and load the data
    try {
      const importedProject = Project.fromJSON(userInput);
      // Save the imported project
      localStorage.setItem('project-' + this.projectId, importedProject.serialize());
      this.loadEditor(importedProject);
    } catch (error) {
      alert('Failed to import project data. Please check the format.');
      console.error('Import error:', error);
    }
  }

  handleUndo() {
    if (!this.undoManager.canUndo()) return false;
    
    this.undoManager.undo();
    const stateJson = this.undoManager.getCurrentState();
    this.project = Project.fromJSON(stateJson);
    return true;
  }

  handleRedo() {
    if (!this.undoManager.canRedo()) return false;
    
    this.undoManager.redo();
    const stateJson = this.undoManager.getCurrentState();
    this.project = Project.fromJSON(stateJson);
    return true;
  }

  maybeSave(forceSave: boolean = false) {
    const currentJsonString = this.project.serialize();
    const hasChanged = this.undoManager.hasChanged(currentJsonString);
    if (hasChanged) {
      // TODO: consider whether we should just force caller to specify this for simplicity.
      // Fine-grain check: only reinit replay manager if assets, startMs, or endMs changed
      const needsReplayReinit = this.needsReplayManagerReinit(currentJsonString);
      
      this.undoManager.updateIfChanged(currentJsonString);
      
      if (needsReplayReinit) {
        this.initReplayManager();
      }
    }
    if (hasChanged || forceSave) {
      this.saveProject();
      // if (!forceSave) {
      //   this.showSaveBanner();
      // }
    }
  }

  needsReplayManagerReinit(newJsonString: string): boolean {
    const oldJsonString = this.undoManager.getCurrentState();
    
    try {
      const oldProject = Project.fromJSON(oldJsonString);
      const newProject = Project.fromJSON(newJsonString);
      
      // Check if number of commands changed (new asset added or removed)
      if (oldProject.commands.length < newProject.commands.length) {
        return true;
      }
      
      // Check if any asset, startMs, or endMs changed
      for (let i = 0; i < newProject.commands.length; i++) {
        const oldCmd = oldProject.commands[i];
        const newCmd = newProject.commands[i];
        
        if (oldCmd.asset !== newCmd.asset ||
            oldCmd.startMs !== newCmd.startMs ||
            oldCmd.endMs !== newCmd.endMs) {
          return true;
        }
      }
      
      return false;
    } catch (e) {
      // If parsing fails, reinit to be safe
      return true;
    }
  }

  handleHashChange() {
    const newId = this.getProjectIdFromHash();
    if (!newId) {
      window.location.reload(); // Go back to home
      return;
    }
    if (newId !== this.projectId) {
      this.projectId = newId;
      this.loadEditor(this.loadProject(this.projectId));
    }
  }
}

