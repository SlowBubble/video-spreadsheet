import './style.css';
import { Project } from './project';
import { matchKey } from '../tsModules/key-match/key_match';

const columns = ['Asset', 'Position', 'Start', 'End'];

// Inverse of the following:
// Translate a timeString that can look like 1:23 to 60 * 1 + 23
// Similarly 1:2:3 is 60*60*1+60*2+3
function msToTimeString(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

class Editor {
  projectId: string;
  project: Project;
  tableData: string[][];
  selectedRow: number = 0;
  selectedCol: number = 0;
  projectTitle: string;
  _replayIframes: HTMLIFrameElement[] = [];
  _replayCommands: any[] = [];

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
    this.project = this.loadProject(this.projectId);
    this.tableData = this.projectToTableData(this.project);
    this.projectTitle = this.project.title;
    this.renderTable();
    this.preloadReplayIframes();
    window.addEventListener('keydown', (e) => this.handleKey(e));
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  preloadReplayIframes() {
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) return;
    replayDiv.innerHTML = '';
    const proj = Project.deserializeFromSpreadsheet(
      this.projectId,
      this.projectTitle,
      this.tableData
    );
    if (!proj.commands.length) return;
    const commands = [...proj.commands].sort((a, b) => a.positionMs - b.positionMs);
    function getYouTubeId(url: string): string | null {
      const match = url.match(/(?:v=|youtu.be\/|embed\/)([\w-]{11})/);
      return match ? match[1] : null;
    }
    // Container for iframes
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '1280px';
    container.style.height = '720px';
    container.style.margin = '0 auto';
    replayDiv.appendChild(container);
    // Preload all iframes (hidden except first)
    this._replayIframes = commands.map((cmd, idx) => {
      const ytId = getYouTubeId(cmd.asset);
      const startSec = Math.floor(cmd.startMs / 1000);
      const endSec = Math.floor(cmd.endMs / 1000);
      const iframe = document.createElement('iframe');
      iframe.width = '1280';
      iframe.height = '720';
      iframe.style.border = 'none';
      iframe.style.display = idx === 0 ? 'block' : 'none';
      iframe.setAttribute('allow', 'autoplay; encrypted-media');
      iframe.setAttribute('allowfullscreen', '');
      if (ytId) {
        iframe.src = `https://www.youtube.com/embed/${ytId}?start=${startSec}&end=${endSec}&controls=0&modestbranding=1&rel=0`;
      } else {
        iframe.src = '';
      }
      container.appendChild(iframe);
      return iframe;
    });
    this._replayCommands = commands;
  }

  getProjectIdFromHash(): string | null {
    if (window.location.hash.startsWith('#id=')) {
      return window.location.hash.replace('#id=', '');
    }
    return null;
  }

  loadProject(id: string): Project {
    const json = localStorage.getItem('project-' + id);
    if (json) {
      return Project.fromJSON(json);
    }
    return new Project('Untitled Project', id, []);
  }

  projectToTableData(project: Project): string[][] {
    if (!project.commands.length) return [['', '', '', '']];
    return [
      ...project.commands.map(cmd => [
        cmd.asset,
        msToTimeString(cmd.positionMs),
        msToTimeString(cmd.startMs),
        msToTimeString(cmd.endMs),
      ]),
      ['', '', '', ''],
    ];
  }

  isRowEmpty(row: string[]) {
    return row.every(cell => cell.trim() === '');
  }

  renderTable() {
    const editIcon = `<span id="edit-title" style="cursor:pointer; margin-right:8px;" title="Edit title">✏️</span>`;
    const titleHtml = `<div style="display:flex; align-items:center; font-size:2em; font-weight:bold;">
      ${editIcon}<span>${this.projectTitle}</span>
    </div>`;

    const tableRows = this.tableData.map((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => {
        const isSelected = rowIndex === this.selectedRow && colIndex === this.selectedCol;
        return `<td style="border: 2px solid ${isSelected ? 'black' : '#ccc'}; padding: 4px;">
          ${cell || '&nbsp;'}
        </td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

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
            ${tableRows}
          </tbody>
        </table>
        <p style="color: #888;">Use arrow keys or Tab to move, Enter to edit. Cmd+S to save.</p>
      </div>
    `;

    const editBtn = document.getElementById('edit-title');
    if (editBtn) {
      editBtn.onclick = () => {
        const newTitle = prompt('Edit project title:', this.projectTitle);
        if (newTitle !== null) {
          this.projectTitle = newTitle.trim() || 'Untitled Project';
          this.renderTable();
        }
      };
    }
  }

  ensureEmptyRow() {
    if (!this.isRowEmpty(this.tableData[this.tableData.length - 1])) {
      this.tableData.push(['', '', '', '']);
    }
  }

  handleKey(e: KeyboardEvent) {
    if (matchKey(e, 'up')) {
      this.selectedRow = Math.max(0, this.selectedRow - 1);
    } else if (matchKey(e, 'down')) {
      this.selectedRow = Math.min(this.tableData.length - 1, this.selectedRow + 1);
    } else if (matchKey(e, 'left')) {
      this.selectedCol = Math.max(0, this.selectedCol - 1);
    } else if (matchKey(e, 'right')) {
      this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
    } else if (matchKey(e, 'tab')) {
      this.selectedCol = Math.min(columns.length - 1, this.selectedCol + 1);
    } else if (matchKey(e, 'shift+tab')) {
      this.selectedCol = Math.max(0, this.selectedCol - 1);
    } else if (matchKey(e, 'enter')) {
      const newValue = prompt(`Edit ${columns[this.selectedCol]}:`, this.tableData[this.selectedRow][this.selectedCol] || '');
      if (newValue !== null) {
        this.tableData[this.selectedRow][this.selectedCol] = newValue;
        this.ensureEmptyRow();
        this.saveProject();
      }
    } else if (matchKey(e, 'cmd+s')) {
      this.saveProject();
    } else if (matchKey(e, 'space')) {
      this.startReplay();
    } else {
      return;
    }
    e.preventDefault();
    this.renderTable();
  }

  startReplay() {
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) return;
    if (!this._replayIframes || !this._replayCommands) return;
    // Hide all iframes
    this._replayIframes.forEach(iframe => (iframe.style.display = 'none'));
    // Play sequence
    const commands = this._replayCommands;
    const iframes = this._replayIframes;
    function getYouTubeId(url: string): string | null {
      const match = url.match(/(?:v=|youtu.be\/|embed\/)([\w-]{11})/);
      return match ? match[1] : null;
    }
    function showIframe(idx: number) {
      iframes.forEach((iframe, i) => {
        iframe.style.display = i === idx ? 'block' : 'none';
        if (i === idx) {
          const cmd = commands[i];
          const ytId = getYouTubeId(cmd.asset);
          const startSec = Math.floor(cmd.startMs / 1000);
          const endSec = Math.floor(cmd.endMs / 1000);
          if (ytId) {
            iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&start=${startSec}&end=${endSec}&controls=0&modestbranding=1&rel=0`;
          } else {
            iframe.src = '';
          }
        }
      });
    }
    function playCommand(idx: number) {
      if (idx >= commands.length) return;
      showIframe(idx);
      const duration = commands[idx].endMs - commands[idx].startMs;
      setTimeout(() => {
        playCommand(idx + 1);
      }, Math.max(0, duration));
    }
    commands.forEach((cmd, idx) => {
      setTimeout(() => {
        playCommand(idx);
      }, Math.max(0, cmd.positionMs - commands[0].positionMs));
    });
  }

  saveProject() {
    const proj = Project.deserializeFromSpreadsheet(
      this.projectId,
      this.projectTitle,
      this.tableData
    );
    localStorage.setItem('project-' + this.projectId, proj.serialize());
  }

  handleHashChange() {
    const newId = this.getProjectIdFromHash();
    if (!newId) {
      window.location.reload(); // Go back to home
      return;
    }
    if (newId !== this.projectId) {
      this.projectId = newId;
      this.project = this.loadProject(this.projectId);
      this.tableData = this.projectToTableData(this.project);
      this.selectedRow = 0;
      this.selectedCol = 0;
      this.projectTitle = this.project.title;
      this.renderTable();
    }
  }
}

new Editor();
