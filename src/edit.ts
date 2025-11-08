import './style.css';
import { Project, ProjectCommand } from './project';
import { matchKey } from '../tsModules/key-match/key_match';
import { ReplayManager } from './replay';
import { getShortcutsModalHtml, setupShortcutsModal } from './shortcutsDoc';
import { getHashParams } from './urlUtil';

const columns = ['Asset', 'Position', 'Start', 'End', 'Volume', 'Speed'];

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

// Compute the absolute end time in ms for a command
// Takes into account playback speed: slower speed = longer duration
function computeCommandEndTimeMs(cmd: ProjectCommand): number {
  const videoDuration = cmd.endMs - cmd.startMs;
  const actualDuration = videoDuration / cmd.speed;
  return cmd.positionMs + actualDuration;
}

export class Editor {
  projectId: string;
  project!: Project;
  selectedRow: number = 0;
  selectedCol: number = 0;
  replayManager: ReplayManager | null = null;

  constructor() {
    // Create persistent replay container at the top of the body
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) {
      replayDiv = document.createElement('div');
      replayDiv.id = 'replay-container';
      replayDiv.style.marginBottom = '24px';
      document.body.insertBefore(replayDiv, document.body.firstChild);
    }
    this.projectId = this.getProjectIdFromHash()!;
    this.loadEditor(this.loadProject(this.projectId));
    window.addEventListener('keydown', (e) => this.handleKey(e));
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  private loadEditor(project: Project) {
    this.project = project;
    this.selectedRow = 0;
    this.selectedCol = 0;
    this.renderTable();
    this.initReplayManager();
  }

  initReplayManager() {
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) return;
    this.replayManager = new ReplayManager(
      replayDiv,
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
      case 1: // Position
        const startTime = msToTimeString(cmd.positionMs);
        const endTime = msToTimeString(computeCommandEndTimeMs(cmd));
        return `${startTime}-${endTime}`;
      case 2: // Start
        return msToTimeString(cmd.startMs);
      case 3: // End
        return msToTimeString(cmd.endMs);
      case 4: // Volume
        return cmd.volume.toString();
      case 5: // Speed
        return cmd.speed.toString();
      default:
        return '';
    }
  }

  getRowCount(): number {
    // Always show at least one empty row
    return Math.max(1, this.project.commands.length + 1);
  }

  renderTable() {
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
        cells.push(`<td style="border: 2px solid ${isSelected ? 'black' : '#ccc'}; padding: 4px;">
          ${cellValue || '&nbsp;'}
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
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>
        <button id="shortcuts-btn" style="margin-top: 12px; padding: 8px 16px; cursor: pointer;">Shortcuts</button>
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

    setupShortcutsModal();
  }



  handleKey(e: KeyboardEvent) {
    const rowCount = this.getRowCount();
    
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
    } else if (matchKey(e, 'cmd+s')) {
      this.saveProject();
    } else if (matchKey(e, '0')) {
      if (!this.replayManager) return;
      if (this.replayManager.replaying || this.replayManager.paused) {
        this.replayManager.stopReplay();
      }
    } else if (matchKey(e, 'space')) {
      if (!this.replayManager) return;
      if (this.replayManager.replaying) {
        this.replayManager.pauseReplay();
      } else if (this.replayManager.paused) {
        this.replayManager.startReplay(this.replayManager.pausedAtMs);
      } else {
        this.replayManager.startReplay();
      }
    } else if (matchKey(e, 'x')) {
      this.handleExportImport();
    } else {
      return;
    }
    e.preventDefault();
    this.renderTable();
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
          this.saveProject();
        }
      } else {
        // Create new command with asset URL
        const assetUrl = prompt('Edit Asset URL:', '');
        if (assetUrl !== null && assetUrl.trim() !== '') {
          const newCmd = new ProjectCommand(assetUrl.trim(), 0, 0, 0, 100, 1, '');
          this.project.commands.push(newCmd);
          this.saveProject();
          this.initReplayManager();
        }
      }
    } else if (this.selectedCol === 1) {
      // Position column - edit position start time
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.positionMs);
        const newValue = prompt('Edit Position:', currentValue);
        if (newValue !== null) {
          cmd.positionMs = this.timeStringToMs(newValue);
          this.saveProject();
        }
      }
    } else if (this.selectedCol === 2) {
      // Start column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.startMs);
        const newValue = prompt('Edit Start:', currentValue);
        if (newValue !== null) {
          cmd.startMs = this.timeStringToMs(newValue);
          this.saveProject();
        }
      }
    } else if (this.selectedCol === 3) {
      // End column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const currentValue = msToTimeString(cmd.endMs);
        const newValue = prompt('Edit End:', currentValue);
        if (newValue !== null) {
          cmd.endMs = this.timeStringToMs(newValue);
          this.saveProject();
        }
      }
    } else if (this.selectedCol === 4) {
      // Volume column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const newValue = prompt('Edit Volume:', cmd.volume.toString());
        if (newValue !== null) {
          const volume = Number(newValue);
          if (!isNaN(volume)) {
            cmd.volume = volume;
            this.saveProject();
          }
        }
      }
    } else if (this.selectedCol === 5) {
      // Speed column
      if (isExistingCommand) {
        const cmd = this.project.commands[this.selectedRow];
        const newValue = prompt('Edit Speed:', cmd.speed.toString());
        if (newValue !== null) {
          const speed = Number(newValue);
          if (!isNaN(speed) && speed > 0) {
            cmd.speed = speed;
            this.saveProject();
          }
        }
      }
    }
  }

  saveProject() {
    localStorage.setItem('project-' + this.projectId, this.project.serialize());
    this.showSaveBanner();
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

  showSaveBanner() {
    // Remove existing banner if any
    const existingBanner = document.getElementById('save-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    // Create banner
    const banner = document.createElement('div');
    banner.id = 'save-banner';
    banner.textContent = 'Saved!';
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      z-index: 2000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(banner);

    // Remove after 2 seconds
    setTimeout(() => {
      banner.remove();
    }, 700);
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

