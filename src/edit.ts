import './style.css';
import { Project, ProjectCommand, FullScreenFilter, BorderFilter, TextDisplay, Overlay } from './project';
import { matchKey } from '../tsModules/key-match/key_match';
import { ReplayManager } from './replay';
import { getShortcutsModalHtml, setupShortcutsModal } from './shortcutsDoc';
import { getHashParams } from './urlUtil';
import { showBanner } from './bannerUtil';
import { UndoManager } from './undo';
import { showTextareaModal } from './modalUtil';

const columns = ['✅', 'Asset', 'Pos 0', 'Pos 1', 'Start', 'End', 'Vol', 'Speed', 'Text', 'Fill'];

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
  undoManager!: UndoManager;
  isModalOpen: boolean = false;

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
      case 0: // Checkbox (enabled/disabled)
        return cmd.disabled ? '☐' : '☑';
      case 1: // Asset
        return cmd.name ? cmd.name : cmd.asset;
      case 2: // Pos 0 (start position)
        return msToTimeString(cmd.positionMs);
      case 3: // Pos 1 (end position, calculated)
        return msToTimeString(computeCommandEndTimeMs(cmd));
      case 4: // Start
        return msToTimeString(cmd.startMs);
      case 5: // End
        return msToTimeString(cmd.endMs);
      case 6: // Volume
        return cmd.volume.toString();
      case 7: // Speed (display as percentage)
        return cmd.speed.toString();
      case 8: // Text
        return cmd.overlay?.textDisplay?.content || '';
      case 9: // Fill (canvas preview)
        return ''; // Canvas will be rendered separately
      default:
        return '';
    }
  }

  getCellContent(rowIdx: number, colIdx: number, cellValue: string): string {
    // Empty row at the end
    if (rowIdx >= this.project.commands.length) return cellValue;
    
    const cmd = this.project.commands[rowIdx];
    
    // For Pos 0 and Pos 1 columns, create clickable buttons
    if (colIdx === 2 || colIdx === 3) {
      const timeMs = colIdx === 2 ? cmd.positionMs : computeCommandEndTimeMs(cmd);
      const dimStyle = colIdx === 3 ? 'opacity: 0.5;' : '';
      return `<button class="time-seek-btn" data-time-ms="${timeMs}" style="padding: 4px 8px; cursor: pointer; ${dimStyle}">${cellValue}</button>`;
    }
    
    // For Start and End columns, create clickable links
    if (colIdx === 4 || colIdx === 5) {
      const timeMs = colIdx === 4 ? cmd.startMs : cmd.endMs;
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
    
    // For Fill column, create a canvas with overlay preview
    if (colIdx === 9) {
      const canvasId = `fill-canvas-${rowIdx}`;
      return `<canvas id="${canvasId}" width="47" height="27" style="border: 1px solid #ccc;"></canvas>`;
    }
    
    return cellValue;
  }

  getRowCount(): number {
    // Always show at least one empty row
    return Math.max(1, this.project.commands.length + 1);
  }

  drawFillCanvas(canvasId: string, overlay?: Overlay) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If no overlay, leave it blank
    if (!overlay) return;
    
    // Draw fullScreenFilter if present
    if (overlay.fullScreenFilter) {
      ctx.fillStyle = overlay.fullScreenFilter.fillStyle;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw borderFilter if present
    if (overlay.borderFilter) {
      const topHeight = (canvas.height * overlay.borderFilter.topMarginPct) / 100;
      const bottomHeight = (canvas.height * overlay.borderFilter.bottomMarginPct) / 100;
      
      ctx.fillStyle = overlay.borderFilter.fillStyle;
      ctx.fillRect(0, 0, canvas.width, topHeight);
      ctx.fillRect(0, canvas.height - bottomHeight, canvas.width, bottomHeight);
    }
    
    // Draw text if present
    if (overlay.textDisplay && overlay.textDisplay.content) {
      const fontSize = 2; // Scaled down from 36px
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = 'white';
      
      const textMetrics = ctx.measureText(overlay.textDisplay.content);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      const padding = 0.5;
      const margin = 0.5;
      
      // Calculate position based on alignment
      let x: number, y: number;
      
      switch (overlay.textDisplay.alignment) {
        case 'upper-left':
          x = margin;
          y = margin;
          ctx.textBaseline = 'top';
          break;
        case 'lower-left':
          x = margin;
          y = canvas.height - margin - textHeight - padding * 2;
          ctx.textBaseline = 'top';
          break;
        case 'upper-right':
          x = canvas.width - margin - textWidth - padding * 2;
          y = margin;
          ctx.textBaseline = 'top';
          break;
        case 'lower-right':
          x = canvas.width - margin - textWidth - padding * 2;
          y = canvas.height - margin - textHeight - padding * 2;
          ctx.textBaseline = 'top';
          break;
        case 'center':
          x = (canvas.width - textWidth - padding * 2) / 2;
          y = (canvas.height - textHeight - padding * 2) / 2;
          ctx.textBaseline = 'top';
          break;
        default:
          x = margin;
          y = margin;
          ctx.textBaseline = 'top';
      }
      
      // Draw black background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, y, textWidth + padding * 2, textHeight + padding * 2);
      
      // Draw text
      ctx.fillStyle = 'white';
      ctx.fillText(overlay.textDisplay.content, x + padding, y + padding);
    }
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
              ${columns.map((col, idx) => `<th style="${idx === 3 ? 'opacity: 0.5;' : ''}">${col}</th>`).join('')}
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
      });
    });

    // Add click event listeners to table cells for selection
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, rowIdx) => {
          const cells = row.querySelectorAll('td');
          cells.forEach((cell, colIdx) => {
            cell.addEventListener('click', () => {
              // Update selected cell
              this.selectedRow = rowIdx;
              this.selectedCol = colIdx;
              this.renderTable();
            });
            
            cell.addEventListener('dblclick', () => {
              // Update selected cell
              this.selectedRow = rowIdx;
              this.selectedCol = colIdx;
              // Trigger edit mode (same as pressing Enter)
              this.handleEnterKey();
              this.renderTable();
              this.maybeSave();
            });
          });
        });
      }
    }

    setupShortcutsModal();
    
    // Draw fill canvases for each row
    for (let rowIdx = 0; rowIdx < this.project.commands.length; rowIdx++) {
      const cmd = this.project.commands[rowIdx];
      const canvasId = `fill-canvas-${rowIdx}`;
      this.drawFillCanvas(canvasId, cmd.overlay);
    }
  }



  async handleKey(e: KeyboardEvent, isPresentMode: boolean = false) {
    // Don't handle keys if modal is open
    if (this.isModalOpen) {
      return;
    }
    
    // In present mode, only allow space and number keys
    if (isPresentMode) {
      if (matchKey(e, '0')) {
        this.replayManager.stopReplay();
        // Resume playing from the beginning
        this.replayManager.startReplay(0);
        e.preventDefault();
      } else if (matchKey(e, '1') || matchKey(e, '2') || matchKey(e, '3') || matchKey(e, '4') || 
                 matchKey(e, '5') || matchKey(e, '6') || matchKey(e, '7') || matchKey(e, '8') || matchKey(e, '9')) {
        const digit = parseInt(e.key);
        const totalDuration = this.replayManager.getTotalDuration();
        const targetTime = (digit / 10) * totalDuration;
        this.replayManager.stopReplay();
        this.replayManager.startReplay(targetTime);
        e.preventDefault();
      } else if (matchKey(e, 'space')) {
        if (this.replayManager.isPlaying) {
          this.replayManager.pauseReplay();
        } else {
          // Check if selected cell is on Pos 0 or Pos 1
          let resumeTime = this.replayManager.pausedAtMs;
          if (this.selectedRow < this.project.commands.length && (this.selectedCol === 1 || this.selectedCol === 2)) {
            const cmd = this.project.commands[this.selectedRow];
            if (this.selectedCol === 1) {
              // Pos 0 column - use positionMs
              resumeTime = cmd.positionMs;
            } else if (this.selectedCol === 2) {
              // Pos 1 column - use computed end time
              resumeTime = computeCommandEndTimeMs(cmd);
            }
          }
          this.replayManager.startReplay(resumeTime);
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
    } else if (matchKey(e, 'down')) {
      this.selectedRow = Math.min(rowCount - 1, this.selectedRow + 1);
    } else if (matchKey(e, 'left')) {
      this.selectedCol = Math.max(0, this.selectedCol - 1);
    } else if (matchKey(e, 'right')) {
      this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
    } else if (matchKey(e, 'tab')) {
      this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
    } else if (matchKey(e, 'shift+tab')) {
      this.selectedCol = Math.max(0, this.selectedCol - 1);
    } else if (matchKey(e, 'enter')) {
      this.handleEnterKey();
    } else if (matchKey(e, '0')) {
      this.replayManager.stopReplay();
      // Resume playing from the beginning
      this.replayManager.startReplay(0);
    } else if (matchKey(e, '1') || matchKey(e, '2') || matchKey(e, '3') || matchKey(e, '4') || 
               matchKey(e, '5') || matchKey(e, '6') || matchKey(e, '7') || matchKey(e, '8') || matchKey(e, '9')) {
      const digit = parseInt(e.key);
      const totalDuration = this.replayManager.getTotalDuration();
      const targetTime = (digit / 10) * totalDuration;
      this.replayManager.stopReplay();
      this.replayManager.startReplay(targetTime);
    } else if (matchKey(e, 'space') || matchKey(e, 'k')) {
      if (this.replayManager.isPlaying) {
        this.replayManager.pauseReplay();
      } else {
        // Check if selected cell is on Pos 0 or Pos 1
        let resumeTime = this.replayManager.pausedAtMs;
        if (this.selectedRow < this.project.commands.length && (this.selectedCol === 2 || this.selectedCol === 3)) {
          const cmd = this.project.commands[this.selectedRow];
          if (this.selectedCol === 2) {
            // Pos 0 column - use positionMs
            resumeTime = cmd.positionMs;
          } else if (this.selectedCol === 3) {
            // Pos 1 column - use computed end time
            resumeTime = computeCommandEndTimeMs(cmd);
          }
        }
        this.replayManager.startReplay(resumeTime);
      }
    } else if (matchKey(e, 'x')) {
      this.handleExportImport();
    } else if (matchKey(e, 'j')) {
      this.replayManager.rewind(3000);
    } else if (matchKey(e, 'l')) {
      this.replayManager.fastForward(3000);
    } else if (matchKey(e, 'f')) {
      this.cycleFullScreenFilter();
    } else if (matchKey(e, 'b')) {
      this.toggleBorderFilter();
    } else if (matchKey(e, 't')) {
      this.toggleTextAlignment();
    } else if (matchKey(e, 'a')) {
      this.tetherToPreviousRow();
    } else if (matchKey(e, 'alt+up')) {
      this.moveCommandUp();
    } else if (matchKey(e, 'alt+down')) {
      this.moveCommandDown();
    } else if (matchKey(e, 'alt+right')) {
      this.adjustTimeValue(500);
    } else if (matchKey(e, 'alt+left')) {
      this.adjustTimeValue(-500);
    } else if (matchKey(e, 'cmd+c')) {
      await this.copyCell();
    } else if (matchKey(e, 'cmd+v')) {
      await this.pasteCell();
    } else if (matchKey(e, 'cmd+z')) {
      const performed = this.handleUndo();
      forceSave = performed;
    } else if (matchKey(e, 'cmd+shift+z')) {
      const performed = this.handleRedo();
      forceSave = performed;
    } else if (matchKey(e, 'cmd+shift+s')) {
      this.cloneProject();
      return; // Don't render or save, we're navigating away
    } else if (matchKey(e, 'cmd+s')) {
      // Force save even if nothing changed
      forceSave = true;
    } else if (matchKey(e, 'cmd+shift+backspace')) {
      this.deleteProject();
      return; // Don't render or save, we're navigating away
    } else if (matchKey(e, 'cmd+backspace')) {
      this.removeAsset();
    } else if (matchKey(e, 'cmd+x')) {
      this.removeAsset();
    } else if (matchKey(e, 'backspace')) {
      this.removeAsset();
    } else if (matchKey(e, '[')) {
      this.adjustExtendAudioSec(-1);
    } else if (matchKey(e, ']')) {
      this.adjustExtendAudioSec(1);
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
      this.showFilterBanner('Fullscreen Filter: Red');
    } else if (overlay.fullScreenFilter.fillStyle === redFilter) {
      // Move to green
      overlay.fullScreenFilter = new FullScreenFilter(greenFilter);
      this.showFilterBanner('Fullscreen Filter: Green');
    } else {
      // Remove filter
      overlay.fullScreenFilter = undefined;
      this.showFilterBanner('Fullscreen Filter: OFF');
    }
  }

  toggleBorderFilter() {
    // Only toggle if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Cycle through percentage options, then remove
    const percentageOptions = [4, 7, 10, 13, 16, 19];
    const fillStyle = 'rgba(0, 0, 0, 0.95)';
    
    const overlay = ensureOverlay(cmd);
    
    if (!overlay.borderFilter) {
      // Start with first option
      overlay.borderFilter = new BorderFilter(percentageOptions[0], percentageOptions[0], fillStyle);
      this.showFilterBanner(`Border Filter: ${percentageOptions[0]}%`);
    } else {
      // Find current percentage and move to next
      const currentPct = overlay.borderFilter.topMarginPct;
      const currentIndex = percentageOptions.indexOf(currentPct);
      
      if (currentIndex === -1 || currentIndex === percentageOptions.length - 1) {
        // If not found or at last option, remove filter
        overlay.borderFilter = undefined;
        this.showFilterBanner('Border Filter: OFF');
      } else {
        // Move to next option
        const nextPct = percentageOptions[currentIndex + 1];
        overlay.borderFilter = new BorderFilter(nextPct, nextPct, fillStyle);
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
    
    const alignments: Array<'upper-left' | 'lower-left' | 'upper-right' | 'lower-right' | 'center'> = [
      'lower-left',
      'center',
      'lower-right',
      'upper-right',
      'upper-left',
    ];
    
    const currentAlignment = cmd.overlay.textDisplay.alignment;
    const currentIndex = alignments.indexOf(currentAlignment);
    const nextIndex = (currentIndex + 1) % alignments.length;
    const nextAlignment = alignments[nextIndex];
    
    cmd.overlay.textDisplay.alignment = nextAlignment;
    this.showFilterBanner(`Text Alignment: ${nextAlignment}`);
  }

  tetherToPreviousRow() {
    // Only tether if we have a valid command selected and it's not the first row
    if (this.selectedRow >= this.project.commands.length || this.selectedRow === 0) {
      showBanner('Cannot tether: No previous row', {
        id: 'tether-banner',
        position: 'bottom',
        color: 'red',
        duration: 1500
      });
      return;
    }
    
    const currentCmd = this.project.commands[this.selectedRow];
    const previousCmd = this.project.commands[this.selectedRow - 1];
    
    // Set current row's positionMs to previous row's end time
    const previousEndTime = computeCommandEndTimeMs(previousCmd);
    currentCmd.positionMs = previousEndTime;
    
    showBanner(`Position tethered to ${msToTimeString(previousEndTime)}`, {
      id: 'tether-banner',
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
    
    return new ProjectCommand(assetUrl, currentMs, startMs, endMs, 0, 100, name, undefined, undefined, 0);
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

  moveCommandUp() {
    // Only move if we have a valid command selected and it's not the first one
    if (this.selectedRow >= this.project.commands.length || this.selectedRow === 0) return;
    
    // Swap with the command above
    const temp = this.project.commands[this.selectedRow];
    this.project.commands[this.selectedRow] = this.project.commands[this.selectedRow - 1];
    this.project.commands[this.selectedRow - 1] = temp;
    
    // Move selection up
    this.selectedRow--;
  }

  moveCommandDown() {
    // Only move if we have a valid command selected and it's not the last one
    if (this.selectedRow >= this.project.commands.length - 1) return;
    
    // Swap with the command below
    const temp = this.project.commands[this.selectedRow];
    this.project.commands[this.selectedRow] = this.project.commands[this.selectedRow + 1];
    this.project.commands[this.selectedRow + 1] = temp;
    
    // Move selection down
    this.selectedRow++;
  }

  adjustTimeValue(deltaMs: number) {
    // Only adjust if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Check which column we're on and adjust accordingly
    if (this.selectedCol === 2) {
      // Pos 0 column
      cmd.positionMs = Math.max(0, cmd.positionMs + deltaMs);
      showBanner(`Position: ${msToTimeString(cmd.positionMs)}`, {
        id: 'adjust-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else if (this.selectedCol === 3) {
      // Pos 1 column - not editable, do nothing
      return;
    } else if (this.selectedCol === 4) {
      // Start column
      cmd.startMs = Math.max(0, cmd.startMs + deltaMs);
      showBanner(`Start: ${msToTimeString(cmd.startMs)}`, {
        id: 'adjust-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else if (this.selectedCol === 5) {
      // End column
      cmd.endMs = Math.max(0, cmd.endMs + deltaMs);
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

  adjustExtendAudioSec(deltaSec: number) {
    // Only adjust if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Adjust extendAudioSec, keeping it >= 0
    cmd.extendAudioSec = Math.max(0, cmd.extendAudioSec + deltaSec);
    
    showBanner(`Extend Audio: ${cmd.extendAudioSec}s`, {
      id: 'extend-audio-banner',
      position: 'bottom',
      color: 'blue',
      duration: 800
    });
  }

  async copyCell() {
    // Only copy if we have a valid command selected
    if (this.selectedRow >= this.project.commands.length) return;
    
    const cmd = this.project.commands[this.selectedRow];
    let textToCopy = '';
    
    // Store the value based on column type
    if (this.selectedCol === 0) {
      // Checkbox column - copy entire row/command as JSON
      textToCopy = JSON.stringify(cmd, null, 2);
    } else if (this.selectedCol === 1) {
      // Asset column - copy the underlying asset link
      textToCopy = cmd.asset;
    } else if (this.selectedCol === 2) {
      // Pos 0 column - store as ms integer string
      textToCopy = cmd.positionMs.toString();
    } else if (this.selectedCol === 3) {
      // Pos 1 column - store as ms integer string
      textToCopy = computeCommandEndTimeMs(cmd).toString();
    } else if (this.selectedCol === 4) {
      // Start column - store as ms integer string
      textToCopy = cmd.startMs.toString();
    } else if (this.selectedCol === 5) {
      // End column - store as ms integer string
      textToCopy = cmd.endMs.toString();
    } else if (this.selectedCol === 6) {
      // Volume column - store as string
      textToCopy = cmd.volume.toString();
    } else if (this.selectedCol === 7) {
      // Speed column - store as percentage string
      textToCopy = cmd.speed.toString();
    } else if (this.selectedCol === 8) {
      // Text column - store as string
      textToCopy = cmd.overlay?.textDisplay?.content || '';
    }
    
    // Copy to system clipboard
    try {
      await navigator.clipboard.writeText(textToCopy);
      showBanner('Copied!', {
        id: 'copy-banner',
        position: 'bottom',
        color: 'green',
        duration: 500
      });
    } catch (err) {
      showBanner('Failed to copy', {
        id: 'copy-banner',
        position: 'bottom',
        color: 'red',
        duration: 1000
      });
      console.error('Copy failed:', err);
    }
  }

  async pasteCell() {
    // Read from system clipboard
    let clipboardText = '';
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (err) {
      showBanner('Failed to read clipboard', {
        id: 'paste-banner',
        position: 'bottom',
        color: 'red',
        duration: 1000
      });
      console.error('Paste failed:', err);
      return;
    }
    
    if (!clipboardText) return;
    
    const isNewRow = this.selectedRow >= this.project.commands.length;
    
    // For new rows, only allow pasting in the asset column or checkbox column
    if (isNewRow) {
      if (this.selectedCol === 0) {
        // Try to parse as JSON command
        try {
          const parsedCmd = JSON.parse(clipboardText);
          const newCmd = new ProjectCommand(
            parsedCmd.asset,
            parsedCmd.positionMs,
            parsedCmd.startMs,
            parsedCmd.endMs,
            parsedCmd.volume,
            parsedCmd.speed,
            parsedCmd.name,
            parsedCmd.overlay,
            parsedCmd.disabled
          );
          this.project.commands.push(newCmd);
          showBanner('Pasted row!', {
            id: 'paste-banner',
            position: 'bottom',
            color: 'green',
            duration: 500
          });
          return;
        } catch (e) {
          showBanner('Failed: Invalid JSON', {
            id: 'paste-banner',
            position: 'bottom',
            color: 'red',
            duration: 1500
          });
          return;
        }
      } else if (this.selectedCol === 1) {
        // Create new command with asset URL from clipboard
        const assetUrl = clipboardText.trim();
        if (assetUrl !== '') {
          const newCmd = this.createCommandFromAssetUrl(assetUrl);
          this.project.commands.push(newCmd);
          showBanner('Pasted!', {
            id: 'paste-banner',
            position: 'bottom',
            color: 'green',
            duration: 500
          });
        }
      }
      return;
    }
    
    const cmd = this.project.commands[this.selectedRow];
    
    // Paste based on column type
    if (this.selectedCol === 0) {
      // Checkbox column - try to parse as JSON command and replace entire row
      try {
        const parsedCmd = JSON.parse(clipboardText);
        cmd.asset = parsedCmd.asset;
        cmd.positionMs = parsedCmd.positionMs;
        cmd.startMs = parsedCmd.startMs;
        cmd.endMs = parsedCmd.endMs;
        cmd.volume = parsedCmd.volume;
        cmd.speed = parsedCmd.speed;
        cmd.name = parsedCmd.name;
        cmd.overlay = parsedCmd.overlay;
        cmd.disabled = parsedCmd.disabled;
        showBanner('Pasted row!', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'green',
          duration: 500
        });
        return;
      } catch (e) {
        showBanner('Failed: Invalid JSON', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
      }
    } else if (this.selectedCol === 1) {
      // Asset column - paste the asset link
      cmd.asset = clipboardText;
    } else if (this.selectedCol === 2) {
      // Pos 0 column - parse as number
      const value = Number(clipboardText);
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
    } else if (this.selectedCol === 3) {
      // Pos 1 column - not editable, disallow paste
      showBanner('Cannot paste: Pos 1 is not editable', {
        id: 'paste-banner',
        position: 'bottom',
        color: 'red',
        duration: 1500
      });
      return;
    } else if (this.selectedCol === 4) {
      // Start column - parse as number
      const value = Number(clipboardText);
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
    } else if (this.selectedCol === 5) {
      // End column - parse as number
      const value = Number(clipboardText);
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
    } else if (this.selectedCol === 6) {
      // Volume column - parse as number
      const value = Number(clipboardText);
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
    } else if (this.selectedCol === 7) {
      // Speed column - parse as number
      const value = Number(clipboardText);
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
    } else if (this.selectedCol === 8) {
      // Text column - paste as string
      if (clipboardText.trim() !== '') {
        const overlay = ensureOverlay(cmd);
        overlay.textDisplay = new TextDisplay(clipboardText);
      } else if (cmd.overlay) {
        cmd.overlay.textDisplay = undefined;
      }
    }
    
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
      // Checkbox column - toggle disabled state
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        cmd.disabled = cmd.disabled ? undefined : true;
        showBanner(cmd.disabled ? 'Command disabled' : 'Command enabled', {
          id: 'toggle-banner',
          position: 'bottom',
          color: cmd.disabled ? 'red' : 'green',
          duration: 800
        });
      }
    } else if (this.selectedCol === 1) {
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
            const newCmd = new ProjectCommand('', currentMs, 0, 4000, 0, 100, 'Black', undefined, undefined, 0);
            this.project.commands.push(newCmd);
          } else {
            const newCmd = this.createCommandFromAssetUrl(assetUrl.trim());
            this.project.commands.push(newCmd);
          }
        }
      }
    } else if (this.selectedCol === 2) {
      // Pos 0 column - edit position start time
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.positionMs);
        const newValue = prompt('Edit Position:', currentValue);
        if (newValue !== null) {
          cmd.positionMs = this.timeStringToMs(newValue);
        }
      }
    } else if (this.selectedCol === 3) {
      // Pos 1 column - not editable, do nothing
      return;
    } else if (this.selectedCol === 4) {
      // Start column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.startMs);
        const newValue = prompt('Edit Start:', currentValue);
        if (newValue !== null) {
          cmd.startMs = this.timeStringToMs(newValue);
        }
      }
    } else if (this.selectedCol === 5) {
      // End column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.endMs);
        const newValue = prompt('Edit End:', currentValue);
        if (newValue !== null) {
          cmd.endMs = this.timeStringToMs(newValue);
        }
      }
    } else if (this.selectedCol === 6) {
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
    } else if (this.selectedCol === 7) {
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
    } else if (this.selectedCol === 8) {
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
    } else if (this.selectedCol === 9) {
      // Fill column - edit overlay JSON
      if (isExistingCommand) {
        this.showOverlayModal();
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
    
    // Pretty-print the JSON with 2-space indentation
    let prettyJson = serializedData;
    try {
      const parsed = JSON.parse(serializedData);
      prettyJson = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep original if parsing fails
    }
    
    showTextareaModal({
      title: 'Export/Import Project Data',
      initialValue: prettyJson,
      saveButtonLabel: 'Import',
      maxWidth: '800px',
      minHeight: '400px',
      fontSize: '12px',
      onModalStateChange: (isOpen) => {
        this.isModalOpen = isOpen;
      },
      onSave: (value) => {
        try {
          const importedProject = Project.fromJSON(value);
          localStorage.setItem('project-' + this.projectId, importedProject.serialize());
          this.loadEditor(importedProject);
          
          showBanner('Project imported!', {
            id: 'import-banner',
            position: 'bottom',
            color: 'green',
            duration: 1500
          });
        } catch (error) {
          showBanner('Failed to import: Invalid JSON format', {
            id: 'import-error-banner',
            position: 'bottom',
            color: 'red',
            duration: 2000
          });
          console.error('Import error:', error);
        }
      }
    });
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
      
      // Check if any asset, startMs, endMs, or extendAudioSec changed
      for (let i = 0; i < newProject.commands.length; i++) {
        const oldCmd = oldProject.commands[i];
        const newCmd = newProject.commands[i];
        
        if (oldCmd.asset !== newCmd.asset ||
            oldCmd.startMs !== newCmd.startMs ||
            oldCmd.endMs !== newCmd.endMs ||
            oldCmd.extendAudioSec !== newCmd.extendAudioSec) {
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

  cloneProject() {
    // Save current project first
    this.saveProject();
    
    // Generate new ID using timestamp
    const newId = Date.now().toString();
    
    // Clone the project with new ID and suffixed name
    const clonedProject = new Project(
      this.project.title + '*',
      newId,
      // Deep clone commands
      this.project.commands.map(cmd => new ProjectCommand(
        cmd.asset,
        cmd.positionMs,
        cmd.startMs,
        cmd.endMs,
        cmd.volume,
        cmd.speed,
        cmd.name,
        cmd.overlay ? this.cloneOverlay(cmd.overlay) : undefined,
        cmd.disabled,
        cmd.extendAudioSec
      ))
    );
    
    // Save the cloned project
    localStorage.setItem('project-' + newId, clonedProject.serialize());
    
    // Navigate to the new project
    window.location.hash = `id=${newId}`;
  }

  cloneOverlay(overlay: Overlay): Overlay {
    let fullScreenFilter: FullScreenFilter | undefined = undefined;
    if (overlay.fullScreenFilter) {
      fullScreenFilter = new FullScreenFilter(overlay.fullScreenFilter.fillStyle);
    }
    
    let borderFilter: BorderFilter | undefined = undefined;
    if (overlay.borderFilter) {
      borderFilter = new BorderFilter(
        overlay.borderFilter.topMarginPct,
        overlay.borderFilter.bottomMarginPct,
        overlay.borderFilter.fillStyle
      );
    }
    
    let textDisplay: TextDisplay | undefined = undefined;
    if (overlay.textDisplay) {
      textDisplay = new TextDisplay(
        overlay.textDisplay.content,
        overlay.textDisplay.alignment
      );
    }
    
    return new Overlay(fullScreenFilter, borderFilter, textDisplay);
  }

  deleteProject() {
    const confirmed = confirm(
      `Are you sure you want to delete project "${this.project.title}"? This cannot be undone.`
    );

    if (confirmed) {
      // Remove project from localStorage
      localStorage.removeItem('project-' + this.projectId);

      // Navigate to home page
      window.location.hash = '';
    }
  }

  showOverlayModal() {
    const cmd = this.project.commands[this.selectedRow];
    const overlayJson = cmd.overlay ? JSON.stringify(cmd.overlay, null, 2) : '{}';
    
    showTextareaModal({
      title: 'Edit Overlay JSON',
      initialValue: overlayJson,
      onModalStateChange: (isOpen) => {
        this.isModalOpen = isOpen;
      },
      onSave: (value) => {
        try {
          const newOverlayData = JSON.parse(value);
          
          // Reconstruct overlay from JSON
          let newOverlay: Overlay | undefined = undefined;
          
          if (Object.keys(newOverlayData).length > 0) {
            let fullScreenFilter: FullScreenFilter | undefined = undefined;
            if (newOverlayData.fullScreenFilter) {
              fullScreenFilter = new FullScreenFilter(newOverlayData.fullScreenFilter.fillStyle);
            }
            
            let borderFilter: BorderFilter | undefined = undefined;
            if (newOverlayData.borderFilter) {
              borderFilter = new BorderFilter(
                newOverlayData.borderFilter.topMarginPct,
                newOverlayData.borderFilter.bottomMarginPct,
                newOverlayData.borderFilter.fillStyle
              );
            }
            
            let textDisplay: TextDisplay | undefined = undefined;
            if (newOverlayData.textDisplay) {
              textDisplay = new TextDisplay(
                newOverlayData.textDisplay.content,
                newOverlayData.textDisplay.alignment
              );
            }
            
            if (fullScreenFilter || borderFilter || textDisplay) {
              newOverlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
            }
          }
          
          cmd.overlay = newOverlay;
          this.renderTable();
          this.maybeSave();
          
          showBanner('Overlay updated!', {
            id: 'overlay-banner',
            position: 'bottom',
            color: 'green',
            duration: 1500
          });
        } catch (error) {
          showBanner('Invalid JSON format', {
            id: 'overlay-error-banner',
            position: 'bottom',
            color: 'red',
            duration: 2000
          });
        }
      }
    });
  }
}

