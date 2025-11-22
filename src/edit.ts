import './style.css';
import { Project, ProjectCommand, FullScreenFilter, BorderFilter, TextDisplay, Overlay, TopLevelProject, Metadata, Subcommand, ShortConfig } from './project';
import { matchKey } from '../tsModules/key-match/key_match';
import { ReplayManager } from './replay';
import { getShortcutsModalHtml, setupShortcutsModal } from './shortcutsDoc';
import { getHashParams } from './urlUtil';
import { showBanner } from './bannerUtil';
import { UndoManager } from './undo';
import { showTextareaModal } from './modalUtil';
import type { IDao } from './dao';
import { FirestoreDao } from './firestoreDao';
import { getCurrentUser } from './auth';

// Move to the left slightly when resuming a replay.
const offsetMs = 1000;

export function getDao(): IDao {
  // return new LocalStorageDao();
  return new FirestoreDao();
}

const columns = ['[hName]', 'Asset', 'Pos 0', 'Pos 1', 'Start', 'Dur', 'Vol', 'Speed', 'Text', 'Fill'];

// Inverse of the following:
// Translate a timeString that can look like 1:23 to 60 * 1 + 23
// Similarly 1:2:3 is 60*60*1+60*2+3
function msToTimeString(ms: number, decimalPlaces: number = 1): string {
  const totalSeconds = ms / 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  // Format seconds with specified decimal places
  const sFormatted = s.toFixed(decimalPlaces);
  const padding = decimalPlaces > 0 ? 4 : 2;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sFormatted.padStart(padding, '0')}`;
  } else if (m > 0) {
    return `${m}:${sFormatted.padStart(padding, '0')}`;
  } else {
    return sFormatted;
  }
}

// Convert ms to time string for editing (shows actual precision without rounding)
function msToEditString(ms: number): string {
  const totalSeconds = ms / 1000;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  // Remove trailing zeros and decimal point if not needed
  const sFormatted = s.toString().replace(/\.?0+$/, '');
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sFormatted.padStart(2, '0')}`;
  } else if (m > 0) {
    return `${m}:${sFormatted.padStart(2, '0')}`;
  } else {
    return sFormatted;
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

// Row type to distinguish between commands and subcommands
type RowType = 
  | { type: 'command'; cmdIdx: number }
  | { type: 'subcommand'; cmdIdx: number; subIdx: number }
  | { type: 'empty' };

export class Editor {
  projectId: string;
  topLevelProject!: TopLevelProject;
  selectedRow: number = 0;
  selectedCol: number = 0;
  replayManager!: ReplayManager;
  replayDiv: HTMLDivElement;
  undoManager!: UndoManager;
  isModalOpen: boolean = false;
  dao: IDao;
  numDecimalPlacesForTimeDisplay: number = 0;
  rowTypes: RowType[] = []; // Maps visual row index to command/subcommand
  autoTether: boolean = true;
  idToPos0: Map<number, number> = new Map(); // Maps id to Pos 0 (positionMs)
  idToPos1: Map<number, number> = new Map(); // Maps id to Pos 1 (end position)
  idToHName: Map<number, string> = new Map(); // Maps id to hierarchical name

  get project(): Project {
    return this.topLevelProject.project;
  }

  constructor() {
    this.dao = getDao();
    
    // Add edit-mode class to body
    document.body.classList.add('edit-mode');
    
    // Create persistent replay container at the top left of the viewport
    let replayDiv = document.getElementById('replay-container') as HTMLDivElement;
    if (!replayDiv) {
      replayDiv = document.createElement('div');
      replayDiv.id = 'replay-container';
      // Style for fixed top left
      replayDiv.style.position = 'fixed';
      replayDiv.style.top = '0';
      replayDiv.style.left = '0';
      replayDiv.style.zIndex = '100';
      replayDiv.style.background = 'inherit';
      replayDiv.style.margin = '0';
      replayDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      replayDiv.style.width = '854px';
      replayDiv.style.height = '480px';
      document.body.appendChild(replayDiv);
    }
    this.replayDiv = replayDiv;
    
    this.projectId = this.getProjectIdFromHash()!;
    this.loadProject(this.projectId).then(() => this.loadEditor());
    
    window.addEventListener('keydown', (e) => {
      const params = getHashParams();
      const isPresentMode = params.get('present') === '1';
      this.handleKey(e, isPresentMode);
    });
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  private loadEditor() {
    // project is already set via topLevelProject in loadProject
    this.selectedRow = 0;
    this.selectedCol = 0;
    this.computeTetherMaps();
    this.computeHNames();
    this.renderTable();
    this.initReplayManager();
    this.undoManager = new UndoManager(this.project.serialize());
  }

  computeTetherMaps(): void {
    this.idToPos0.clear();
    this.idToPos1.clear();
    
    this.project.commands.forEach(cmd => {
      this.idToPos0.set(cmd.id, cmd.positionMs);
      this.idToPos1.set(cmd.id, computeCommandEndTimeMs(cmd));
      
      cmd.subcommands.forEach(subCmd => {
        const rate = speedToRate(cmd.speed);
        const subStartOffset = subCmd.startMs - cmd.startMs;
        const subEndOffset = subCmd.endMs - cmd.startMs;
        const subAbsoluteStart = cmd.positionMs + (subStartOffset / rate);
        const subAbsoluteEnd = cmd.positionMs + (subEndOffset / rate);
        
        this.idToPos0.set(subCmd.id, subAbsoluteStart);
        this.idToPos1.set(subCmd.id, subAbsoluteEnd);
      });
    });
  }

  computeHNames(): void {
    this.idToHName.clear();
    
    // Collect all rows (commands and subcommands) with their positions
    interface RowInfo {
      id: number;
      positionMs: number;
      durationMs: number;
      isCommand: boolean;
    }
    
    const rows: RowInfo[] = [];
    
    this.project.commands.forEach(cmd => {
      const cmdStart = cmd.positionMs;
      const cmdEnd = computeCommandEndTimeMs(cmd);
      rows.push({
        id: cmd.id,
        positionMs: cmdStart,
        durationMs: cmdEnd - cmdStart,
        isCommand: true
      });
      
      cmd.subcommands.forEach(subCmd => {
        const rate = speedToRate(cmd.speed);
        const subStartOffset = subCmd.startMs - cmd.startMs;
        const subEndOffset = subCmd.endMs - cmd.startMs;
        const subAbsoluteStart = cmd.positionMs + (subStartOffset / rate);
        const subAbsoluteEnd = cmd.positionMs + (subEndOffset / rate);
        
        rows.push({
          id: subCmd.id,
          positionMs: subAbsoluteStart,
          durationMs: subAbsoluteEnd - subAbsoluteStart,
          isCommand: false
        });
      });
    });
    
    // Compute containment relationships
    const CONTAINMENT_PCT = 75;
    
    // For each pair of rows, check containment
    const containedIn = new Map<number, Set<number>>(); // Maps id to set of ids it's contained in
    const contains = new Map<number, Set<number>>(); // Maps id to set of ids it contains
    
    rows.forEach(rowA => {
      containedIn.set(rowA.id, new Set());
      contains.set(rowA.id, new Set());
    });
    
    rows.forEach(rowA => {
      rows.forEach(rowB => {
        if (rowA.id === rowB.id) return;
        
        // Check if rowA overlaps with rowB for > 75% of rowA's duration
        const overlapStart = Math.max(rowA.positionMs, rowB.positionMs);
        const overlapEnd = Math.min(
          rowA.positionMs + rowA.durationMs,
          rowB.positionMs + rowB.durationMs
        );
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        const overlapPct = (overlapDuration / rowA.durationMs) * 100;
        
        if (overlapPct > CONTAINMENT_PCT) {
          containedIn.get(rowA.id)!.add(rowB.id);
          contains.get(rowB.id)!.add(rowA.id);
        }
      });
    });
    
    // Determine parent-child relationships
    const parents = new Map<number, number>(); // Maps child id to parent id
    const children = new Map<number, Set<number>>(); // Maps parent id to set of child ids
    
    rows.forEach(row => {
      children.set(row.id, new Set());
    });
    
    rows.forEach(rowA => {
      const containedInSet = containedIn.get(rowA.id)!;
      
      // Find the parent: the row that contains rowA but is not contained by rowA
      for (const rowBId of containedInSet) {
        const rowBContainedIn = containedIn.get(rowBId)!;
        
        // If rowA is contained in rowB but rowB is not contained in rowA, rowB is parent
        if (!rowBContainedIn.has(rowA.id)) {
          parents.set(rowA.id, rowBId);
          children.get(rowBId)!.add(rowA.id);
          break; // Only one parent
        }
      }
    });
    
    // Identify roots (rows without parents)
    const roots = rows.filter(row => !parents.has(row.id));
    
    // Group roots by siblings (mutually contained)
    const rootGroups: number[][] = [];
    const processed = new Set<number>();
    
    roots.forEach(root => {
      if (processed.has(root.id)) return;
      
      const siblingGroup = [root.id];
      processed.add(root.id);
      
      // Find all siblings of this root
      const rootContainedIn = containedIn.get(root.id)!;
      rootContainedIn.forEach(otherId => {
        if (!parents.has(otherId) && !processed.has(otherId)) {
          // Check if they're mutual siblings
          const otherContainedIn = containedIn.get(otherId)!;
          if (otherContainedIn.has(root.id)) {
            siblingGroup.push(otherId);
            processed.add(otherId);
          }
        }
      });
      
      rootGroups.push(siblingGroup);
    });
    
    // Sort root groups by minimum positionMs
    rootGroups.sort((a, b) => {
      const minPosA = Math.min(...a.map(id => rows.find(r => r.id === id)!.positionMs));
      const minPosB = Math.min(...b.map(id => rows.find(r => r.id === id)!.positionMs));
      return minPosA - minPosB;
    });
    
    // Sort siblings within each group by positionMs
    rootGroups.forEach(group => {
      group.sort((a, b) => {
        const posA = rows.find(r => r.id === a)!.positionMs;
        const posB = rows.find(r => r.id === b)!.positionMs;
        return posA - posB;
      });
    });
    
    // Assign hNames to roots
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    rootGroups.forEach((group, groupIdx) => {
      const baseNumber = (groupIdx + 1).toString();
      
      group.forEach((id, siblingIdx) => {
        if (siblingIdx === 0) {
          this.idToHName.set(id, baseNumber);
        } else {
          const letter = letters[siblingIdx - 1] || `z${siblingIdx - 1}`;
          this.idToHName.set(id, baseNumber + letter);
        }
      });
    });
    
    // Process children recursively in order
    const processChildren = (parentId: number, parentHName: string) => {
      const childIds = Array.from(children.get(parentId) || []);
      
      // Sort children by positionMs
      childIds.sort((a, b) => {
        const posA = rows.find(r => r.id === a)!.positionMs;
        const posB = rows.find(r => r.id === b)!.positionMs;
        return posA - posB;
      });
      
      // Assign hNames to children
      childIds.forEach((childId, idx) => {
        if (this.idToHName.has(childId)) return; // Already named
        
        const childHName = `${parentHName}-${idx + 1}`;
        this.idToHName.set(childId, childHName);
        
        // Recursively process this child's children
        processChildren(childId, childHName);
      });
    };
    
    // Process all roots and their descendants
    rootGroups.forEach(group => {
      group.forEach(rootId => {
        const rootHName = this.idToHName.get(rootId)!;
        processChildren(rootId, rootHName);
      });
    });
  }

  applyAutoTether(): number {
    if (!this.autoTether) return 0;
    
    const oldIdToPos0 = new Map(this.idToPos0);
    const oldIdToPos1 = new Map(this.idToPos1);
    
    // Compute new maps
    this.computeTetherMaps();
    
    let updatedCount = 0;
    
    // Check for changes in Pos 0
    for (const [id, newPos0] of this.idToPos0.entries()) {
      const oldPos0 = oldIdToPos0.get(id);
      if (oldPos0 !== undefined && oldPos0 !== newPos0) {
        // This id's Pos 0 changed from oldPos0 to newPos0
        // Find other ids that had the same oldPos0 and update them
        for (const [otherId, otherOldPos0] of oldIdToPos0.entries()) {
          if (otherId !== id && otherOldPos0 === oldPos0) {
            // Update this other id's positionMs to match newPos0
            this.updatePositionMsForId(otherId, newPos0);
            updatedCount++;
          }
        }
        
        // Also check in oldIdToPos1
        for (const [otherId, otherOldPos1] of oldIdToPos1.entries()) {
          if (otherId !== id && otherOldPos1 === oldPos0) {
            // Update this other id's positionMs to match newPos0
            this.updatePositionMsForId(otherId, newPos0);
            updatedCount++;
          }
        }
      }
    }
    
    // Check for changes in Pos 1
    for (const [id, newPos1] of this.idToPos1.entries()) {
      const oldPos1 = oldIdToPos1.get(id);
      if (oldPos1 !== undefined && oldPos1 !== newPos1) {
        // This id's Pos 1 changed from oldPos1 to newPos1
        // Find other ids that had the same oldPos1 and update them
        for (const [otherId, otherOldPos0] of oldIdToPos0.entries()) {
          if (otherId !== id && otherOldPos0 === oldPos1) {
            // Update this other id's positionMs to match newPos1
            this.updatePositionMsForId(otherId, newPos1);
            updatedCount++;
          }
        }
        
        // Also check in oldIdToPos1
        for (const [otherId, otherOldPos1] of oldIdToPos1.entries()) {
          if (otherId !== id && otherOldPos1 === oldPos1) {
            // Update this other id's positionMs to match newPos1
            this.updatePositionMsForId(otherId, newPos1);
            updatedCount++;
          }
        }
      }
    }
    
    // Recompute maps after adjustments
    if (updatedCount > 0) {
      this.computeTetherMaps();
    }
    
    return updatedCount;
  }

  applyAutoTetherAndNotify(): void {
    const tetherUpdates = this.applyAutoTether();
    if (tetherUpdates > 0) {
      showBanner(`Auto-tether updated ${tetherUpdates} position${tetherUpdates > 1 ? 's' : ''}`, {
        id: 'tether-update-banner',
        position: 'bottom',
        color: 'blue',
        duration: 2000
      });
    }
  }

  updatePositionMsForId(id: number, newPositionMs: number): void {
    // Find the command or subcommand with this id and update its positionMs
    for (const cmd of this.project.commands) {
      if (cmd.id === id) {
        cmd.positionMs = newPositionMs;
        return;
      }
      
      for (const subCmd of cmd.subcommands) {
        if (subCmd.id === id) {
          // For subcommands, we need to adjust startMs to achieve the desired absolute position
          const rate = speedToRate(cmd.speed);
          const desiredOffset = (newPositionMs - cmd.positionMs) * rate;
          const currentDuration = subCmd.endMs - subCmd.startMs;
          subCmd.startMs = cmd.startMs + desiredOffset;
          subCmd.endMs = subCmd.startMs + currentDuration;
          return;
        }
      }
    }
  }

  getTetheredIds(targetPos: number): Set<number> {
    const tethered = new Set<number>();
    
    // Check which ids have this position in Pos 0 or Pos 1
    for (const [id, pos0] of this.idToPos0.entries()) {
      if (pos0 === targetPos) {
        tethered.add(id);
      }
    }
    
    for (const [id, pos1] of this.idToPos1.entries()) {
      if (pos1 === targetPos) {
        tethered.add(id);
      }
    }
    
    return tethered;
  }

  isPositionTethered(id: number, isPos0: boolean): boolean {
    const targetPos = isPos0 ? this.idToPos0.get(id) : this.idToPos1.get(id);
    if (targetPos === undefined) return false;
    
    const tethered = this.getTetheredIds(targetPos);
    // It's tethered if more than one id shares this position
    return tethered.size > 1;
  }

  getTetherGroups(): Map<number, number> {
    // Returns a map from position value to color index
    const positionCounts = new Map<number, number>();
    
    // Count how many ids share each position
    for (const pos0 of this.idToPos0.values()) {
      positionCounts.set(pos0, (positionCounts.get(pos0) || 0) + 1);
    }
    
    for (const pos1 of this.idToPos1.values()) {
      positionCounts.set(pos1, (positionCounts.get(pos1) || 0) + 1);
    }
    
    // Filter to only tethered positions (count > 1)
    const tetheredPositions: number[] = [];
    for (const [pos, count] of positionCounts.entries()) {
      if (count > 1) {
        tetheredPositions.push(pos);
      }
    }
    
    // Sort positions in ascending order
    tetheredPositions.sort((a, b) => a - b);
    
    // Assign color indices
    const positionToColorIndex = new Map<number, number>();
    tetheredPositions.forEach((pos, idx) => {
      positionToColorIndex.set(pos, idx);
    });
    
    return positionToColorIndex;
  }

  getTetherColor(id: number, isPos0: boolean): string | null {
    // Don't show tether colors when auto-tether is disabled
    if (!this.autoTether) return null;
    
    const targetPos = isPos0 ? this.idToPos0.get(id) : this.idToPos1.get(id);
    if (targetPos === undefined) return null;
    
    if (!this.isPositionTethered(id, isPos0)) return null;
    
    const positionToColorIndex = this.getTetherGroups();
    const colorIndex = positionToColorIndex.get(targetPos);
    if (colorIndex === undefined) return null;
    
    const totalGroups = positionToColorIndex.size;
    
    // Generate a grayish hue color
    // Use hue range from 30 (yellowish) to 210 (blueish) for variety
    // Keep saturation low for grayish appearance
    const hue = 30 + (colorIndex / Math.max(1, totalGroups - 1)) * 180;
    const saturation = 25; // Low saturation for grayish
    const lightness = 80; // Light for background
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  getEnabledCommands(): ProjectCommand[] {
    return this.project.getEnabledCommands();
  }

  initReplayManager() {
    this.replayManager = new ReplayManager(
      this.replayDiv,
      this.getEnabledCommands(),
      getYouTubeId
    );
  }

  getProjectIdFromHash(): string | null {
    const params = getHashParams();
    return params.get('id');
  }

  async loadProject(id: string): Promise<Project> {
    const data = await this.dao.get(id);
    if (data) {
      this.topLevelProject = TopLevelProject.fromJSON(data);
      // Regenerate all IDs on load to ensure uniqueness and clean state
      this.topLevelProject.project.regenerateAllIds();
      return this.topLevelProject.project;
    }
    
    // Create new project with metadata
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.uid || '';
    const project = new Project('Untitled Project', []);
    const metadata = new Metadata(id, currentUserId);
    this.topLevelProject = new TopLevelProject(project, metadata);
    return project;
  }

  getDisplayValue(rowIdx: number, colIdx: number): string {
    const rowType = this.rowTypes[rowIdx];
    if (!rowType || rowType.type === 'empty') return '';
    
    const precision = this.numDecimalPlacesForTimeDisplay;
    
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      
      switch (colIdx) {
        case 0: // Checkbox (enabled/disabled) with hName
          const hName = this.idToHName.get(cmd.id);
          const checkbox = cmd.disabled ? '☐' : '☑';
          return hName && !cmd.disabled ? hName : checkbox;
        case 1: // Asset
          return cmd.name ? cmd.name : cmd.asset;
        case 2: // Pos 0 (start position)
          return msToTimeString(cmd.positionMs, precision);
        case 3: // Pos 1 (end position, calculated)
          return msToTimeString(computeCommandEndTimeMs(cmd), precision);
        case 4: // Start
          return msToTimeString(cmd.startMs, precision);
        case 5: // Dur (duration accounting for speed)
          const videoDuration = cmd.endMs - cmd.startMs;
          const actualDuration = videoDuration / (cmd.speed / 100);
          return msToTimeString(actualDuration, precision);
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
    } else {
      // Subcommand row
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      switch (colIdx) {
        case 0: // Checkbox (enabled/disabled) with hName
          const hName = this.idToHName.get(subCmd.id);
          const checkbox = subCmd.disabled ? '☐' : '☑';
          return hName && !subCmd.disabled ? hName : checkbox;
        case 1: // Show subcommand name with indent
          return `  ↳ ${subCmd.name}`;
        case 2: // Pos 0 (absolute start position in timeline)
          // Calculate absolute position: parent's positionMs + offset adjusted for parent's speed
          const rate = speedToRate(cmd.speed);
          const subStartOffset = subCmd.startMs - cmd.startMs;
          const subAbsoluteStart = cmd.positionMs + (subStartOffset / rate);
          return msToTimeString(subAbsoluteStart, precision);
        case 3: // Pos 1 (absolute end position in timeline)
          // Calculate absolute end position
          const rateEnd = speedToRate(cmd.speed);
          const subEndOffset = subCmd.endMs - cmd.startMs;
          const subAbsoluteEnd = cmd.positionMs + (subEndOffset / rateEnd);
          return msToTimeString(subAbsoluteEnd, precision);
        case 4: // Start (relative to command)
          return msToTimeString(subCmd.startMs, precision);
        case 5: // Dur (duration of subcommand)
          const duration = subCmd.endMs - subCmd.startMs;
          return msToTimeString(duration, precision);
        case 6: // Empty
          return '';
        case 7: // Empty
          return '';
        case 8: // Text
          return subCmd.overlay?.textDisplay?.content || '';
        case 9: // Fill (canvas preview)
          return ''; // Canvas will be rendered separately
        default:
          return '';
      }
    }
  }

  getCellContent(rowIdx: number, colIdx: number, cellValue: string): string {
    const rowType = this.rowTypes[rowIdx];
    if (!rowType || rowType.type === 'empty') return cellValue;
    
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      
      // For Pos 0 and Pos 1 columns, create clickable buttons
      if (colIdx === 2 || colIdx === 3) {
        const timeMs = colIdx === 2 ? cmd.positionMs : computeCommandEndTimeMs(cmd);
        const tetherColor = this.getTetherColor(cmd.id, colIdx === 2);
        const tetherStyle = tetherColor ? `background-color: ${tetherColor};` : '';
        return `<button class="time-seek-btn" data-time-ms="${timeMs}" style="padding: 4px 8px; cursor: pointer; ${tetherStyle}">${cellValue}</button>`;
      }
      
      // For Start column, create clickable link
      if (colIdx === 4) {
        const timeMs = cmd.startMs;
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
          return `<a href="${linkUrl}" target="_blank" style="color: black; text-decoration: underline;">${cellValue}</a>`;
        } catch (e) {
          // If URL parsing fails, just return the cell value
          return cellValue;
        }
      }
      
      // For Dur column, create clickable link using endMs
      if (colIdx === 5) {
        const timeMs = cmd.endMs;
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
          return `<a href="${linkUrl}" target="_blank" style="color: black; text-decoration: underline;">${cellValue}</a>`;
        } catch (e) {
          // If URL parsing fails, just return the cell value
          return cellValue;
        }
      }
      
      // For Fill column, create a canvas with overlay preview
      if (colIdx === 9) {
        const canvasId = `fill-canvas-cmd-${rowType.cmdIdx}`;
        return `<canvas id="${canvasId}" width="47" height="27" style="border: 1px solid #ccc;"></canvas>`;
      }
      
      return cellValue;
    } else {
      // Subcommand row
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      // For Pos 0 and Pos 1 columns, create clickable buttons
      if (colIdx === 2 || colIdx === 3) {
        const rate = speedToRate(cmd.speed);
        const startOffset = subCmd.startMs - cmd.startMs;
        const endOffset = subCmd.endMs - cmd.startMs;
        const timeMs = colIdx === 2 
          ? cmd.positionMs + (startOffset / rate)
          : cmd.positionMs + (endOffset / rate);
        const tetherColor = this.getTetherColor(subCmd.id, colIdx === 2);
        const tetherStyle = tetherColor ? `background-color: ${tetherColor};` : '';
        return `<button class="time-seek-btn" data-time-ms="${timeMs}" style="padding: 4px 8px; cursor: pointer; ${tetherStyle}">${cellValue}</button>`;
      }
      
      // For Start column, create clickable link using parent command's asset
      if (colIdx === 4) {
        const timeMs = subCmd.startMs;
        const timeInSeconds = Math.floor(timeMs / 1000);
        
        // Get the parent command's asset URL
        const assetUrl = cmd.asset;
        if (!assetUrl) return cellValue;
        
        try {
          const url = new URL(assetUrl);
          // Remove existing 't' parameter
          url.searchParams.delete('t');
          // Add new 't' parameter with the time value
          url.searchParams.set('t', `${timeInSeconds}s`);
          
          const linkUrl = url.toString();
          return `<a href="${linkUrl}" target="_blank" style="color: black; text-decoration: underline;">${cellValue}</a>`;
        } catch (e) {
          // If URL parsing fails, just return the cell value
          return cellValue;
        }
      }
      
      // For Dur column, create clickable link using endMs
      if (colIdx === 5) {
        const timeMs = subCmd.endMs;
        const timeInSeconds = Math.floor(timeMs / 1000);
        
        // Get the parent command's asset URL
        const assetUrl = cmd.asset;
        if (!assetUrl) return cellValue;
        
        try {
          const url = new URL(assetUrl);
          // Remove existing 't' parameter
          url.searchParams.delete('t');
          // Add new 't' parameter with the time value
          url.searchParams.set('t', `${timeInSeconds}s`);
          
          const linkUrl = url.toString();
          return `<a href="${linkUrl}" target="_blank" style="color: black; text-decoration: underline;">${cellValue}</a>`;
        } catch (e) {
          // If URL parsing fails, just return the cell value
          return cellValue;
        }
      }
      
      // For Fill column, create a canvas with overlay preview
      if (colIdx === 9) {
        const canvasId = `fill-canvas-sub-${rowType.cmdIdx}-${rowType.subIdx}`;
        return `<canvas id="${canvasId}" width="47" height="27" style="border: 1px solid #ccc;"></canvas>`;
      }
      
      return cellValue;
    }
  }

  buildRowTypes(): RowType[] {
    const rowTypes: RowType[] = [];
    
    this.project.commands.forEach((cmd, cmdIdx) => {
      // Add command row
      rowTypes.push({ type: 'command', cmdIdx });
      
      // Add subcommand rows
      cmd.subcommands.forEach((_, subIdx) => {
        rowTypes.push({ type: 'subcommand', cmdIdx, subIdx });
      });
    });
    
    // Add empty row at the end
    rowTypes.push({ type: 'empty' });
    
    return rowTypes;
  }

  getRowCount(): number {
    // Count commands + subcommands + 1 empty row
    let count = 0;
    this.project.commands.forEach(cmd => {
      count += 1 + cmd.subcommands.length;
    });
    return Math.max(1, count + 1);
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
      const leftWidth = (canvas.width * overlay.borderFilter.leftMarginPct) / 100;
      const rightWidth = (canvas.width * overlay.borderFilter.rightMarginPct) / 100;
      
      ctx.fillStyle = overlay.borderFilter.fillStyle;
      // Draw top and bottom borders
      ctx.fillRect(0, 0, canvas.width, topHeight);
      ctx.fillRect(0, canvas.height - bottomHeight, canvas.width, bottomHeight);
      // Draw left and right borders
      ctx.fillRect(0, 0, leftWidth, canvas.height);
      ctx.fillRect(canvas.width - rightWidth, 0, rightWidth, canvas.height);
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
        case 'lower-center':
          x = (canvas.width - textWidth - padding * 2) / 2;
          y = canvas.height - margin - textHeight - padding * 2;
          ctx.textBaseline = 'top';
          break;
        case 'upper-center':
          x = (canvas.width - textWidth - padding * 2) / 2;
          y = margin;
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
      document.body.classList.add('present-mode');
      return;
    }
    
    // Remove present-mode class if not in present mode
    document.body.classList.remove('present-mode');
    
    const editIcon = `<span id="edit-title" style="cursor:pointer; margin-right:8px;" title="Edit title">✏️</span>`;
    const titleHtml = `<div style="display:flex; align-items:center; font-size:2em; font-weight:bold;">
      ${editIcon}<span>${this.project.title}</span>
    </div>`;

    // Build row types mapping
    this.rowTypes = this.buildRowTypes();
    const rowCount = this.rowTypes.length;
    const tableRows: string[] = [];
    
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowType = this.rowTypes[rowIdx];
      const isSubcommand = rowType && rowType.type === 'subcommand';
      const cells: string[] = [];
      
      // Check if this row should have bold styling (hName without dash)
      let shouldBeBold = false;
      if (rowType && rowType.type !== 'empty') {
        const id = rowType.type === 'command' 
          ? this.project.commands[rowType.cmdIdx].id
          : this.project.commands[rowType.cmdIdx].subcommands[rowType.subIdx].id;
        const hName = this.idToHName.get(id);
        shouldBeBold = hName !== undefined && !hName.includes('-');
      }
      
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const isSelected = rowIdx === this.selectedRow && colIdx === this.selectedCol;
        const cellValue = this.getDisplayValue(rowIdx, colIdx);
        const cellContent = this.getCellContent(rowIdx, colIdx, cellValue);
        
        // Add background colors for Asset and Vol columns based on volume
        let bgColor = 'transparent';
        if (rowType && rowType.type === 'command' && colIdx === 6) {
          const cmd = this.project.commands[rowType.cmdIdx];
          if (cmd.volume === 100) {
            bgColor = '#eeeecc';
          } else if (cmd.volume > 0 && cmd.volume < 100) {
            bgColor = '#ffffdd';
          }
        }
        
        // Light gray background for subcommand rows
        if (isSubcommand) {
          bgColor = '#f5f5f5';
        }
        
        // Right-align time, volume, and speed columns (Pos 0, Pos 1, Start, Dur, Vol, Speed)
        const textAlign = (colIdx >= 2 && colIdx <= 7) ? 'text-align: right;' : '';
        
        // Bold font for first two columns if hName has no dash
        const fontWeight = (shouldBeBold && colIdx <= 1) ? 'font-weight: bold;' : '';
        
        cells.push(`<td style="border: 2px solid ${isSelected ? 'black' : '#ccc'}; padding: 4px; background-color: ${bgColor}; ${textAlign} ${fontWeight}">
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
              ${columns.map((col) => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>
        <div style="margin-top: 12px;">
          <button id="shortcuts-btn" style="padding: 8px 16px; cursor: pointer; margin-right: 8px;">Shortcuts</button>
          <button id="present-btn" style="padding: 8px 16px; cursor: pointer; margin-right: 8px;">Present</button>
          <button id="short-btn" style="padding: 8px 16px; cursor: pointer; margin-right: 8px;">Short</button>
          <button id="edit-short-btn" style="padding: 8px 16px; cursor: pointer; margin-right: 8px;">Edit Short</button>
          <button id="home-btn" style="padding: 8px 16px; cursor: pointer;">Home</button>
        </div>
      </div>
      ${getShortcutsModalHtml()}
    `;

    const editBtn = document.getElementById('edit-title');
    if (editBtn) {
      editBtn.onclick = () => {
        const newTitle = prompt('Edit project title:', this.project.title);
        if (newTitle !== null) {
          this.topLevelProject.project.title = newTitle.trim() || 'Untitled Project';
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
        window.open(newHash, '_blank', 'width=854,height=530');
      };
    }

    const editShortBtn = document.getElementById('edit-short-btn');
    if (editShortBtn) {
      editShortBtn.onclick = () => {
        this.showEditShortConfigModal();
      };
    }

    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
      homeBtn.onclick = () => {
        window.location.hash = '';
        window.location.reload();
      };
    }

    const shortBtn = document.getElementById('short-btn');
    if (shortBtn) {
      shortBtn.onclick = () => {
        const defaultWidth = 854;
        const defaultHeight = 1520;
        
        // Use pctOfFullWidth from shortConfig if available, otherwise default to 60
        const percent = this.project.shortConfig?.pctOfFullWidth || 60;
        
        const width = Math.round(defaultWidth * (percent / 100));
        const height = Math.round(defaultHeight * (percent / 100));
        
        const currentHash = window.location.hash;
        const newHash = `${currentHash}&present=1&short=1`;
        window.open(newHash, '_blank', `width=${width},height=${height}`);
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
        this.replayManager.startReplay(Math.max(timeMs - offsetMs, 0), this.getEnabledCommands());
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
              
              // Apply auto-tether before rendering
              this.applyAutoTetherAndNotify();
              
              this.renderTable();
              this.maybeSave();
            });
          });
        });
      }
    }

    setupShortcutsModal();
    
    // Draw fill canvases for each row
    this.rowTypes.forEach((rowType) => {
      if (rowType.type === 'command') {
        const cmd = this.project.commands[rowType.cmdIdx];
        const canvasId = `fill-canvas-cmd-${rowType.cmdIdx}`;
        this.drawFillCanvas(canvasId, cmd.overlay);
      } else if (rowType.type === 'subcommand') {
        const cmd = this.project.commands[rowType.cmdIdx];
        const subCmd = cmd.subcommands[rowType.subIdx];
        const canvasId = `fill-canvas-sub-${rowType.cmdIdx}-${rowType.subIdx}`;
        this.drawFillCanvas(canvasId, subCmd.overlay);
      }
    });
  }



  async handleKey(e: KeyboardEvent, isPresentMode: boolean = false) {
    // Don't handle keys if modal is open
    if (this.isModalOpen) {
      return;
    }
    
    // In present mode, only allow space and number keys
    if (isPresentMode) {
      // Check if short mode is enabled via URL param
      const params = getHashParams();
      const isShortMode = params.get('short') === '1';
      
      if (matchKey(e, '0')) {
        this.replayManager.stopReplay();
        // In short mode, start from shortStartMs; otherwise from beginning
        let startTime = 0;
        if (isShortMode && this.project.shortConfig) {
          startTime = this.project.shortConfig.shortStartMs;
        }
        this.replayManager.startReplay(startTime, this.getEnabledCommands());
        e.preventDefault();
      } else if (matchKey(e, '1') || matchKey(e, '2') || matchKey(e, '3') || matchKey(e, '4') || 
                 matchKey(e, '5') || matchKey(e, '6') || matchKey(e, '7') || matchKey(e, '8') || matchKey(e, '9')) {
        const digit = parseInt(e.key);
        const enabledCommands = this.getEnabledCommands();
        
        let startTime = 0;
        let duration = this.replayManager.getTotalDuration(enabledCommands);
        
        // In short mode, use short range instead of full duration
        if (isShortMode && this.project.shortConfig) {
          startTime = this.project.shortConfig.shortStartMs;
          duration = this.project.shortConfig.shortEndMs - this.project.shortConfig.shortStartMs;
        }
        
        const targetTime = startTime + (digit / 10) * duration;
        this.replayManager.stopReplay();
        this.replayManager.startReplay(targetTime, enabledCommands);
        e.preventDefault();
      } else if (matchKey(e, 'space')) {
        if (this.replayManager.isPlaying) {
          this.replayManager.pauseReplay();
        } else {
          let resumeTime = this.replayManager.pausedAtMs;
          let endTime: number | undefined = undefined;
          
          // Only use shortConfig if short=1 in URL params
          if (isShortMode && this.project.shortConfig) {
            // Play from shortStartMs to shortEndMs
            resumeTime = this.project.shortConfig.shortStartMs;
            endTime = this.project.shortConfig.shortEndMs;
          }
          
          this.replayManager.startReplay(resumeTime, this.getEnabledCommands(), endTime);
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
    } else if (matchKey(e, 'cmd+enter')) {
      this.handleCmdEnterKey();
    } else if (matchKey(e, 'enter')) {
      this.handleEnterKey();
    } else if (matchKey(e, '0')) {
      this.replayManager.stopReplay();
      // Resume playing from the beginning
      this.replayManager.startReplay(0, this.getEnabledCommands());
    } else if (matchKey(e, '1') || matchKey(e, '2') || matchKey(e, '3') || matchKey(e, '4') || 
               matchKey(e, '5') || matchKey(e, '6') || matchKey(e, '7') || matchKey(e, '8') || matchKey(e, '9')) {
      const digit = parseInt(e.key);
      const enabledCommands = this.getEnabledCommands();
      const totalDuration = this.replayManager.getTotalDuration(enabledCommands);
      const targetTime = (digit / 10) * totalDuration;
      this.replayManager.stopReplay();
      this.replayManager.startReplay(targetTime, enabledCommands);
    } else if (matchKey(e, 'space') || matchKey(e, 'k')) {
      if (this.replayManager.isPlaying) {
        this.replayManager.pauseReplay();
      } else {
        // Check if selected cell is on Pos 0 or Pos 1
        let resumeTime = this.replayManager.pausedAtMs;
        const rowType = this.rowTypes[this.selectedRow];
        
        if (rowType && rowType.type === 'command' && (this.selectedCol === 2 || this.selectedCol === 3)) {
          const cmd = this.project.commands[rowType.cmdIdx];
          if (this.selectedCol === 2) {
            // Pos 0 column - use positionMs
            resumeTime = cmd.positionMs - offsetMs;
            resumeTime = Math.max(resumeTime, 0);
            // move away from the special columns (Pos 0 or Pos 1)
            this.selectedCol -= 1;
          } else if (this.selectedCol === 3) {
            // Pos 1 column - use computed end time
            resumeTime = computeCommandEndTimeMs(cmd) - offsetMs;
            resumeTime = Math.max(resumeTime, 0);
            // move away from the special columns (Pos 0 or Pos 1)
            this.selectedCol += 1;
          }
        } else if (rowType && rowType.type === 'subcommand' && (this.selectedCol === 2 || this.selectedCol === 3)) {
          const cmd = this.project.commands[rowType.cmdIdx];
          const subCmd = cmd.subcommands[rowType.subIdx];
          const rate = speedToRate(cmd.speed);
          
          if (this.selectedCol === 2) {
            // Pos 0 column - use subcommand absolute start position
            const startOffset = subCmd.startMs - cmd.startMs;
            resumeTime = cmd.positionMs + (startOffset / rate) - offsetMs;
            resumeTime = Math.max(resumeTime, 0);
            // move away from the special columns (Pos 0 or Pos 1)
            this.selectedCol -= 1;
          } else if (this.selectedCol === 3) {
            // Pos 1 column - use subcommand absolute end position
            const endOffset = subCmd.endMs - cmd.startMs;
            resumeTime = cmd.positionMs + (endOffset / rate) - offsetMs;
            resumeTime = Math.max(resumeTime, 0);
            // move away from the special columns (Pos 0 or Pos 1)
            this.selectedCol += 1;
          }
        }
        this.replayManager.startReplay(resumeTime, this.getEnabledCommands());
      }
    } else if (matchKey(e, 'x')) {
      this.handleExportImport();
    } else if (matchKey(e, 'j')) {
      this.replayManager.rewind(3000, this.getEnabledCommands());
    } else if (matchKey(e, 'l')) {
      this.replayManager.fastForward(3000, this.getEnabledCommands());
    } else if (matchKey(e, 'f')) {
      this.cycleFullScreenFilter();
    } else if (matchKey(e, 'b')) {
      this.toggleBorderFilter();
    } else if (matchKey(e, 'v')) {
      this.toggleLeftRightBorderFilter();
    } else if (matchKey(e, 'a')) {
      this.toggleTextAlignment();
    } else if (matchKey(e, 't')) {
      this.tetherToPreviousRow();
    } else if (matchKey(e, 'p')) {
      this.toggleTimePrecision();
    } else if (matchKey(e, 'alt+up')) {
      this.moveCommandUp();
    } else if (matchKey(e, 'alt+down')) {
      this.moveCommandDown();
    } else if (matchKey(e, 'alt+right')) {
      if (this.selectedCol === 6 || this.selectedCol === 7) {
        this.cycleColumnValue(1);
      } else {
        this.adjustTimeValue(500);
      }
    } else if (matchKey(e, 'alt+left')) {
      if (this.selectedCol === 6 || this.selectedCol === 7) {
        this.cycleColumnValue(-1);
      } else {
        this.adjustTimeValue(-500);
      }
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
    } else if (matchKey(e, 'shift+t')) {
      this.autoTether = !this.autoTether;
      
      // Recompute tether maps when re-enabling to capture current positions
      if (this.autoTether) {
        this.computeTetherMaps();
      }
      
      showBanner(`Auto-tether ${this.autoTether ? 'enabled' : 'disabled'}`, {
        id: 'tether-banner',
        position: 'bottom',
        color: this.autoTether ? 'green' : 'blue',
        duration: 1500
      });
      this.renderTable();
      return;
    } else if (matchKey(e, 'cmd+s')) {
      // Force save even if nothing changed
      forceSave = true;
    } else if (matchKey(e, 'cmd+backspace')) {
      this.deleteProject();
      return; // Don't render or save, we're navigating away
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
    
    // Apply auto-tether before rendering
    this.applyAutoTetherAndNotify();
    
    this.renderTable();
    this.maybeSave(forceSave);
  }

  cycleFullScreenFilter() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    // Cycle through: red -> green -> off
    const redFilter = 'rgba(255, 0, 0, 0.15)';
    const greenFilter = 'rgba(0, 100, 100, 0.15)';
    
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      const overlay = ensureOverlay(cmd);
      
      if (!overlay.fullScreenFilter) {
        overlay.fullScreenFilter = new FullScreenFilter(redFilter);
        this.showFilterBanner('Fullscreen Filter: Red');
      } else if (overlay.fullScreenFilter.fillStyle === redFilter) {
        overlay.fullScreenFilter = new FullScreenFilter(greenFilter);
        this.showFilterBanner('Fullscreen Filter: Green');
      } else {
        overlay.fullScreenFilter = undefined;
        this.showFilterBanner('Fullscreen Filter: OFF');
      }
    } else if (rowType.type === 'subcommand') {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      if (!subCmd.overlay) {
        subCmd.overlay = new Overlay();
      }
      const overlay = subCmd.overlay;
      
      if (!overlay.fullScreenFilter) {
        overlay.fullScreenFilter = new FullScreenFilter(redFilter);
        this.showFilterBanner('Subcommand Filter: Red');
      } else if (overlay.fullScreenFilter.fillStyle === redFilter) {
        overlay.fullScreenFilter = new FullScreenFilter(greenFilter);
        this.showFilterBanner('Subcommand Filter: Green');
      } else {
        overlay.fullScreenFilter = undefined;
        this.showFilterBanner('Subcommand Filter: OFF');
      }
    }
  }

  toggleBorderFilter() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    // Cycle through percentage options, then remove
    const percentageOptions = [4, 7, 10, 13, 16, 19];
    const fillStyle = 'rgba(0, 0, 0, 1)';
    
    let overlay: Overlay;
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      overlay = ensureOverlay(cmd);
    } else {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      if (!subCmd.overlay) {
        subCmd.overlay = new Overlay();
      }
      overlay = subCmd.overlay;
    }
    
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

  toggleLeftRightBorderFilter() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    // Cycle through percentage options, then remove
    const percentageOptions = [4, 8];
    const fillStyle = 'rgba(0, 0, 0, 0.5)';
    
    let overlay: Overlay;
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      overlay = ensureOverlay(cmd);
    } else {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      if (!subCmd.overlay) {
        subCmd.overlay = new Overlay();
      }
      overlay = subCmd.overlay;
    }
    
    if (!overlay.borderFilter) {
      // Start with first option - create border filter with left/right margins
      overlay.borderFilter = new BorderFilter(0, 0, fillStyle, percentageOptions[0], percentageOptions[0]);
      this.showFilterBanner(`Left/Right Border Filter: ${percentageOptions[0]}%`);
    } else if (overlay.borderFilter.leftMarginPct === 0 && overlay.borderFilter.rightMarginPct === 0) {
      // No left/right borders yet, add them
      overlay.borderFilter.leftMarginPct = percentageOptions[0];
      overlay.borderFilter.rightMarginPct = percentageOptions[0];
      this.showFilterBanner(`Left/Right Border Filter: ${percentageOptions[0]}%`);
    } else {
      // Find current percentage and move to next
      const currentPct = overlay.borderFilter.leftMarginPct;
      const currentIndex = percentageOptions.indexOf(currentPct);
      
      if (currentIndex === -1 || currentIndex === percentageOptions.length - 1) {
        // If not found or at last option, remove left/right filter
        overlay.borderFilter.leftMarginPct = 0;
        overlay.borderFilter.rightMarginPct = 0;
        // If no top/bottom borders either, remove the entire filter
        if (overlay.borderFilter.topMarginPct === 0 && overlay.borderFilter.bottomMarginPct === 0) {
          overlay.borderFilter = undefined;
        }
        this.showFilterBanner('Left/Right Border Filter: OFF');
      } else {
        // Move to next option
        const nextPct = percentageOptions[currentIndex + 1];
        overlay.borderFilter.leftMarginPct = nextPct;
        overlay.borderFilter.rightMarginPct = nextPct;
        this.showFilterBanner(`Left/Right Border Filter: ${nextPct}%`);
      }
    }
  }

  toggleTextAlignment() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    let overlay: Overlay | undefined;
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      overlay = cmd.overlay;
    } else {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      overlay = subCmd.overlay;
    }
    
    // Only toggle if there is text
    if (!overlay?.textDisplay || !overlay.textDisplay.content) {
      return;
    }
    
    const alignments: Array<'upper-left' | 'lower-left' | 'upper-right' | 'lower-right' | 'center' | 'lower-center' | 'upper-center'> = [
      'lower-left',
      'lower-center',
      'lower-right',
      'center',
      'upper-right',
      'upper-center',
      'upper-left',
    ];
    
    const currentAlignment = overlay.textDisplay.alignment;
    const currentIndex = alignments.indexOf(currentAlignment);
    const nextIndex = (currentIndex + 1) % alignments.length;
    const nextAlignment = alignments[nextIndex];
    
    overlay.textDisplay.alignment = nextAlignment;
    this.showFilterBanner(`Text Alignment: ${nextAlignment}`);
  }

  tetherToPreviousRow() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type !== 'command' || rowType.cmdIdx === 0) {
      showBanner('Cannot tether: No previous command', {
        id: 'tether-banner',
        position: 'bottom',
        color: 'red',
        duration: 1500
      });
      return;
    }
    
    const currentCmd = this.project.commands[rowType.cmdIdx];
    const previousCmd = this.project.commands[rowType.cmdIdx - 1];
    
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

  toggleTimePrecision() {
    this.numDecimalPlacesForTimeDisplay = this.numDecimalPlacesForTimeDisplay === 0 ? 1 : 0;
    showBanner(`Time precision: ${this.numDecimalPlacesForTimeDisplay} decimal place${this.numDecimalPlacesForTimeDisplay === 1 ? '' : 's'}`, {
      id: 'precision-banner',
      position: 'bottom',
      color: 'blue',
      duration: 1000
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
    
    return new ProjectCommand(assetUrl, currentMs, startMs, endMs, 0, 100, name, undefined, undefined, 0, [], 0);
  }

  removeAsset() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    if (rowType.type === 'command') {
      // Remove the command
      this.project.commands.splice(rowType.cmdIdx, 1);
      
      // Adjust selected row if needed
      if (this.selectedRow > 0) {
        this.selectedRow--;
      }
      
      showBanner('Command removed', {
        id: 'remove-banner',
        position: 'bottom',
        color: 'blue',
        duration: 1000
      });

    } else if (rowType.type === 'subcommand') {
      const cmd = this.project.commands[rowType.cmdIdx];
      cmd.subcommands.splice(rowType.subIdx, 1);
      
      // Adjust selected row if needed
      if (this.selectedRow > 0) {
        this.selectedRow--;
      }
      
      showBanner('Subcommand removed', {
        id: 'remove-banner',
        position: 'bottom',
        color: 'blue',
        duration: 1000
      });
    }
  }

  moveCommandUp() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    if (rowType.type === 'command') {
      // Can't move first command up
      if (rowType.cmdIdx === 0) return;
      
      // Swap with the command above
      const temp = this.project.commands[rowType.cmdIdx];
      this.project.commands[rowType.cmdIdx] = this.project.commands[rowType.cmdIdx - 1];
      this.project.commands[rowType.cmdIdx - 1] = temp;
      
      // Move selection up (accounting for subcommands of the command above)
      const prevCmd = this.project.commands[rowType.cmdIdx];
      this.selectedRow -= (1 + prevCmd.subcommands.length);
    } else if (rowType.type === 'subcommand') {
      // Move subcommand within its parent command
      const cmd = this.project.commands[rowType.cmdIdx];
      
      // Can't move first subcommand up
      if (rowType.subIdx === 0) return;
      
      // Swap with the subcommand above
      const temp = cmd.subcommands[rowType.subIdx];
      cmd.subcommands[rowType.subIdx] = cmd.subcommands[rowType.subIdx - 1];
      cmd.subcommands[rowType.subIdx - 1] = temp;
      
      // Move selection up by one row
      this.selectedRow -= 1;
    }
  }

  moveCommandDown() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    if (rowType.type === 'command') {
      // Can't move last command down
      if (rowType.cmdIdx >= this.project.commands.length - 1) return;
      
      // Get the command below (before swap) to account for its subcommands
      const cmdBelow = this.project.commands[rowType.cmdIdx + 1];
      
      // Swap with the command below
      const temp = this.project.commands[rowType.cmdIdx];
      this.project.commands[rowType.cmdIdx] = cmdBelow;
      this.project.commands[rowType.cmdIdx + 1] = temp;
      
      // Move selection down (accounting for subcommands of the command that was below)
      this.selectedRow += (1 + cmdBelow.subcommands.length);
    } else if (rowType.type === 'subcommand') {
      // Move subcommand within its parent command
      const cmd = this.project.commands[rowType.cmdIdx];
      
      // Can't move last subcommand down
      if (rowType.subIdx >= cmd.subcommands.length - 1) return;
      
      // Swap with the subcommand below
      const temp = cmd.subcommands[rowType.subIdx];
      cmd.subcommands[rowType.subIdx] = cmd.subcommands[rowType.subIdx + 1];
      cmd.subcommands[rowType.subIdx + 1] = temp;
      
      // Move selection down by one row
      this.selectedRow += 1;
    }
  }

  adjustTimeValue(deltaMs: number) {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      
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
        // Pos 1 column - adjust end position (modifies endMs)
        const currentEndTime = computeCommandEndTimeMs(cmd);
        const newEndTime = Math.max(cmd.positionMs, currentEndTime + deltaMs);
        
        // Calculate what endMs should be to achieve this end position
        // newEndTime = cmd.positionMs + (cmd.endMs - cmd.startMs) / rate
        // (newEndTime - cmd.positionMs) * rate = cmd.endMs - cmd.startMs
        // cmd.endMs = cmd.startMs + (newEndTime - cmd.positionMs) * rate
        const rate = speedToRate(cmd.speed);
        const newEndMs = cmd.startMs + (newEndTime - cmd.positionMs) * rate;
        cmd.endMs = Math.max(cmd.startMs, newEndMs);
        
        showBanner(`End Position: ${msToTimeString(newEndTime)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
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
        // Dur column (displays duration but adjusts endMs)
        cmd.endMs = Math.max(0, cmd.endMs + deltaMs);
        showBanner(`End: ${msToTimeString(cmd.endMs)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
      }
    } else if (rowType.type === 'subcommand') {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      if (this.selectedCol === 2) {
        // Pos 0 column - adjust absolute position
        // Calculate current absolute position
        const rate = speedToRate(cmd.speed);
        const currentOffset = subCmd.startMs - cmd.startMs;
        const currentAbsoluteStart = cmd.positionMs + (currentOffset / rate);
        
        // Apply delta to absolute position
        const newAbsoluteStart = Math.max(0, currentAbsoluteStart + deltaMs);
        
        // Convert back to relative startMs
        const newStartMs = cmd.startMs + (newAbsoluteStart - cmd.positionMs) * rate;
        subCmd.startMs = Math.max(0, newStartMs);
        
        showBanner(`Subcommand Position: ${msToTimeString(newAbsoluteStart)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
      } else if (this.selectedCol === 3) {
        // Pos 1 column - adjust absolute end position (modifies subcommand endMs)
        // Calculate current absolute end position
        const rate = speedToRate(cmd.speed);
        const currentEndOffset = subCmd.endMs - cmd.startMs;
        const currentAbsoluteEnd = cmd.positionMs + (currentEndOffset / rate);
        
        // Apply delta to absolute position
        const newAbsoluteEnd = Math.max(cmd.positionMs, currentAbsoluteEnd + deltaMs);
        
        // Convert back to relative endMs
        const newEndMs = cmd.startMs + (newAbsoluteEnd - cmd.positionMs) * rate;
        subCmd.endMs = Math.max(subCmd.startMs, newEndMs);
        
        showBanner(`Subcommand End Position: ${msToTimeString(newAbsoluteEnd)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
      } else if (this.selectedCol === 4) {
        // Start column
        subCmd.startMs = Math.max(0, subCmd.startMs + deltaMs);
        showBanner(`Subcommand Start: ${msToTimeString(subCmd.startMs)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
      } else if (this.selectedCol === 5) {
        // Dur column (adjusts endMs)
        subCmd.endMs = Math.max(0, subCmd.endMs + deltaMs);
        showBanner(`Subcommand End: ${msToTimeString(subCmd.endMs)}`, {
          id: 'adjust-banner',
          position: 'bottom',
          color: 'blue',
          duration: 800
        });
      }
    }
  }

  cycleColumnValue(direction: number) {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type !== 'command') return;
    
    const cmd = this.project.commands[rowType.cmdIdx];
    
    if (this.selectedCol === 6) {
      // Volume column
      const volumeOptions = [0, 25, 50, 75, 100];
      const currentIndex = volumeOptions.indexOf(cmd.volume);
      let nextIndex: number;
      
      if (currentIndex === -1) {
        // Current value not in options, find closest
        nextIndex = direction > 0 ? 0 : volumeOptions.length - 1;
      } else {
        nextIndex = (currentIndex + direction + volumeOptions.length) % volumeOptions.length;
      }
      
      cmd.volume = volumeOptions[nextIndex];
      showBanner(`Volume: ${cmd.volume}`, {
        id: 'cycle-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    } else if (this.selectedCol === 7) {
      // Speed column
      const speedOptions = [25, 50, 75, 100];
      const currentIndex = speedOptions.indexOf(cmd.speed);
      let nextIndex: number;
      
      if (currentIndex === -1) {
        // Current value not in options, find closest
        nextIndex = direction > 0 ? 0 : speedOptions.length - 1;
      } else {
        nextIndex = (currentIndex + direction + speedOptions.length) % speedOptions.length;
      }
      
      cmd.speed = speedOptions[nextIndex];
      showBanner(`Speed: ${cmd.speed}%`, {
        id: 'cycle-banner',
        position: 'bottom',
        color: 'blue',
        duration: 800
      });
    }
  }

  adjustExtendAudioSec(deltaSec: number) {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type !== 'command') return;
    
    const cmd = this.project.commands[rowType.cmdIdx];
    
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
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    let textToCopy = '';
    
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      
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
        // Dur column (displays duration but copies endMs)
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
      } else if (this.selectedCol === 9) {
        // Fill column - copy overlay without TextDisplay
        if (cmd.overlay) {
          const overlayCopy = {
            fullScreenFilter: cmd.overlay.fullScreenFilter,
            borderFilter: cmd.overlay.borderFilter
          };
          textToCopy = JSON.stringify(overlayCopy, null, 2);
        } else {
          textToCopy = '';
        }
      }
    } else if (rowType.type === 'subcommand') {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      if (this.selectedCol === 0) {
        // Copy entire subcommand as JSON
        textToCopy = JSON.stringify(subCmd, null, 2);
      } else if (this.selectedCol === 1) {
        // Name
        textToCopy = subCmd.name;
      } else if (this.selectedCol === 4) {
        // Start
        textToCopy = subCmd.startMs.toString();
      } else if (this.selectedCol === 5) {
        // End
        textToCopy = subCmd.endMs.toString();
      } else if (this.selectedCol === 8) {
        // Text
        textToCopy = subCmd.overlay?.textDisplay?.content || '';
      } else if (this.selectedCol === 9) {
        // Fill column - copy overlay without TextDisplay
        if (subCmd.overlay) {
          const overlayCopy = {
            fullScreenFilter: subCmd.overlay.fullScreenFilter,
            borderFilter: subCmd.overlay.borderFilter
          };
          textToCopy = JSON.stringify(overlayCopy, null, 2);
        } else {
          textToCopy = '';
        }
      }
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
    
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType) return;
    
    const isNewRow = rowType.type === 'empty';
    
    // For new rows, only allow pasting in the asset column or checkbox column
    if (isNewRow) {
      if (this.selectedCol === 0) {
        // Try to parse as JSON command
        try {
          const parsedCmd = JSON.parse(clipboardText);
          const newCmd = ProjectCommand.fromJSON(parsedCmd);
          this.project.commands.push(newCmd);
          this.project.ensureCommandIds();
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
          this.project.ensureCommandIds();
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
    
    // Handle subcommand pasting (limited support)
    if (rowType.type === 'subcommand') {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      if (this.selectedCol === 9) {
        // Fill column - paste overlay (excluding TextDisplay)
        try {
          const parsedOverlay = JSON.parse(clipboardText);
          
          if (!subCmd.overlay) {
            subCmd.overlay = new Overlay();
          }
          const overlay = subCmd.overlay;
          
          // Preserve existing TextDisplay
          const existingTextDisplay = overlay.textDisplay;
          
          // Update filters from pasted data
          if (parsedOverlay.fullScreenFilter) {
            overlay.fullScreenFilter = new FullScreenFilter(parsedOverlay.fullScreenFilter.fillStyle);
          } else {
            overlay.fullScreenFilter = undefined;
          }
          
          if (parsedOverlay.borderFilter) {
            overlay.borderFilter = new BorderFilter(
              parsedOverlay.borderFilter.topMarginPct,
              parsedOverlay.borderFilter.bottomMarginPct,
              parsedOverlay.borderFilter.fillStyle,
              parsedOverlay.borderFilter.leftMarginPct || 0,
              parsedOverlay.borderFilter.rightMarginPct || 0
            );
          } else {
            overlay.borderFilter = undefined;
          }
          
          // Restore TextDisplay
          overlay.textDisplay = existingTextDisplay;
          
          showBanner('Pasted!', {
            id: 'paste-banner',
            position: 'bottom',
            color: 'green',
            duration: 500
          });
        } catch (e) {
          showBanner('Failed: Invalid overlay JSON', {
            id: 'paste-banner',
            position: 'bottom',
            color: 'red',
            duration: 1500
          });
        }
      } else {
        showBanner('Paste not supported for subcommands yet', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'yellow',
          duration: 1500
        });
      }
      return;
    }
    
    const cmd = this.project.commands[rowType.cmdIdx];
    
    // Paste based on column type
    if (this.selectedCol === 0) {
      // Checkbox column - try to parse as JSON command and insert below current row
      try {
        const parsedCmd = JSON.parse(clipboardText);
        const newCmd = ProjectCommand.fromJSON(parsedCmd);
        // Insert below the current command
        this.project.commands.splice(rowType.cmdIdx + 1, 0, newCmd);
        this.project.ensureCommandIds();
        
        // Move cursor to the newly pasted row (accounting for subcommands of current command)
        this.selectedRow += (1 + cmd.subcommands.length);
        
        showBanner('Pasted row below!', {
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
      // Pos 1 column - parse as number and modify endMs
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
      const newEndTime = Math.max(cmd.positionMs, value);
      // Calculate what endMs should be to achieve this end position
      const rate = speedToRate(cmd.speed);
      const newEndMs = cmd.startMs + (newEndTime - cmd.positionMs) * rate;
      cmd.endMs = Math.max(cmd.startMs, newEndMs);
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
      // Dur column (displays duration but pastes to endMs)
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
    } else if (this.selectedCol === 9) {
      // Fill column - paste overlay (excluding TextDisplay)
      try {
        const parsedOverlay = JSON.parse(clipboardText);
        const overlay = ensureOverlay(cmd);
        
        // Preserve existing TextDisplay
        const existingTextDisplay = overlay.textDisplay;
        
        // Update filters from pasted data
        if (parsedOverlay.fullScreenFilter) {
          overlay.fullScreenFilter = new FullScreenFilter(parsedOverlay.fullScreenFilter.fillStyle);
        } else {
          overlay.fullScreenFilter = undefined;
        }
        
        if (parsedOverlay.borderFilter) {
          overlay.borderFilter = new BorderFilter(
            parsedOverlay.borderFilter.topMarginPct,
            parsedOverlay.borderFilter.bottomMarginPct,
            parsedOverlay.borderFilter.fillStyle,
            parsedOverlay.borderFilter.leftMarginPct || 0,
            parsedOverlay.borderFilter.rightMarginPct || 0
          );
        } else {
          overlay.borderFilter = undefined;
        }
        
        // Restore TextDisplay
        overlay.textDisplay = existingTextDisplay;
      } catch (e) {
        showBanner('Failed: Invalid overlay JSON', {
          id: 'paste-banner',
          position: 'bottom',
          color: 'red',
          duration: 1500
        });
        return;
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
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType) return;
    
    const isCommand = rowType.type === 'command';
    const isSubcommand = rowType.type === 'subcommand';
    const isEmpty = rowType.type === 'empty';
    
    if (isCommand) {
      const cmd = this.project.commands[rowType.cmdIdx];
      
      if (this.selectedCol === 0) {
        // Checkbox column - toggle disabled state
        cmd.disabled = cmd.disabled ? undefined : true;
        showBanner(cmd.disabled ? 'Command disabled' : 'Command enabled', {
          id: 'toggle-banner',
          position: 'bottom',
          color: cmd.disabled ? 'red' : 'green',
          duration: 800
        });
      } else if (this.selectedCol === 1) {
        // Asset column - edit name
        const newName = prompt('Edit name:', cmd.name);
        if (newName !== null) {
          cmd.name = newName;
        }
      } else if (this.selectedCol === 2) {
        // Pos 0 column - edit position start time
        const currentValue = msToEditString(cmd.positionMs);
        const newValue = prompt('Edit Position:', currentValue);
        if (newValue !== null) {
          cmd.positionMs = this.timeStringToMs(newValue);
        }
      } else if (this.selectedCol === 3) {
        // Pos 1 column - edit end position (modifies endMs)
        const currentEndTime = computeCommandEndTimeMs(cmd);
        const currentValue = msToEditString(currentEndTime);
        const newValue = prompt('Edit End Position:', currentValue);
        if (newValue !== null) {
          const newEndTime = this.timeStringToMs(newValue);
          // Calculate what endMs should be to achieve this end position
          // newEndTime = cmd.positionMs + (cmd.endMs - cmd.startMs) / rate
          // newEndTime - cmd.positionMs = (cmd.endMs - cmd.startMs) / rate
          // (newEndTime - cmd.positionMs) * rate = cmd.endMs - cmd.startMs
          // cmd.endMs = cmd.startMs + (newEndTime - cmd.positionMs) * rate
          const rate = speedToRate(cmd.speed);
          const newEndMs = cmd.startMs + (newEndTime - cmd.positionMs) * rate;
          cmd.endMs = Math.max(cmd.startMs, newEndMs);
        }
      } else if (this.selectedCol === 4) {
        // Start column
        const currentValue = msToEditString(cmd.startMs);
        const newValue = prompt('Edit Start:', currentValue);
        if (newValue !== null) {
          cmd.startMs = this.timeStringToMs(newValue);
        }
      } else if (this.selectedCol === 5) {
        // Dur column (displays duration but edits endMs)
        const currentValue = msToEditString(cmd.endMs);
        const newValue = prompt('Edit End:', currentValue);
        if (newValue !== null) {
          cmd.endMs = this.timeStringToMs(newValue);
        }
      } else if (this.selectedCol === 6) {
        // Volume column
        const newValue = prompt('Edit Volume:', cmd.volume.toString());
        if (newValue !== null) {
          const volume = Number(newValue);
          if (!isNaN(volume)) {
            cmd.volume = volume;
          }
        }
      } else if (this.selectedCol === 7) {
        // Speed column (as percentage)
        const newValue = prompt('Edit Speed (%):', cmd.speed.toString());
        if (newValue !== null) {
          const speed = Number(newValue);
          if (!isNaN(speed) && speed > 0) {
            cmd.speed = speed;
          }
        }
      } else if (this.selectedCol === 8) {
        // Text column
        const currentText = cmd.overlay?.textDisplay?.content || '';
        const currentAlignment = cmd.overlay?.textDisplay?.alignment || 'lower-center';
        
        showTextareaModal({
          title: 'Edit Text',
          initialValue: currentText,
          maxWidth: '600px',
          minHeight: '200px',
          onModalStateChange: (isOpen) => {
            this.isModalOpen = isOpen;
          },
          onSave: (newValue) => {
            // Update overlay textDisplay, preserving alignment
            if (newValue.trim() !== '') {
              const overlay = ensureOverlay(cmd);
              overlay.textDisplay = new TextDisplay(newValue, currentAlignment);
            } else if (cmd.overlay) {
              cmd.overlay.textDisplay = undefined;
            }
            this.renderTable();
            this.maybeSave();
          }
        });
      } else if (this.selectedCol === 9) {
        // Fill column - edit overlay JSON
        this.showOverlayModal();
      }
    } else if (isSubcommand) {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      
      if (this.selectedCol === 0) {
        // Checkbox column - toggle disabled state
        subCmd.disabled = subCmd.disabled ? undefined : true;
        showBanner(subCmd.disabled ? 'Subcommand disabled' : 'Subcommand enabled', {
          id: 'toggle-banner',
          position: 'bottom',
          color: subCmd.disabled ? 'red' : 'green',
          duration: 800
        });
      } else if (this.selectedCol === 1) {
        // Edit subcommand name
        const newName = prompt('Edit subcommand name:', subCmd.name);
        if (newName !== null) {
          subCmd.name = newName;
        }
      } else if (this.selectedCol === 2) {
        // Pos 0 column - edit absolute start position
        // Calculate current absolute position
        const rate = speedToRate(cmd.speed);
        const currentOffset = subCmd.startMs - cmd.startMs;
        const currentAbsoluteStart = cmd.positionMs + (currentOffset / rate);
        
        const currentValue = msToEditString(currentAbsoluteStart);
        const newValue = prompt('Edit Subcommand Absolute Position:', currentValue);
        if (newValue !== null) {
          const newAbsoluteStart = this.timeStringToMs(newValue);
          // Convert absolute position back to relative startMs
          // newAbsoluteStart = cmd.positionMs + (newStartMs - cmd.startMs) / rate
          // newAbsoluteStart - cmd.positionMs = (newStartMs - cmd.startMs) / rate
          // (newAbsoluteStart - cmd.positionMs) * rate = newStartMs - cmd.startMs
          // newStartMs = cmd.startMs + (newAbsoluteStart - cmd.positionMs) * rate
          const newStartMs = cmd.startMs + (newAbsoluteStart - cmd.positionMs) * rate;
          subCmd.startMs = newStartMs;
        }
      } else if (this.selectedCol === 3) {
        // Pos 1 column - edit absolute end position (modifies subcommand endMs)
        // Calculate current absolute end position
        const rate = speedToRate(cmd.speed);
        const currentEndOffset = subCmd.endMs - cmd.startMs;
        const currentAbsoluteEnd = cmd.positionMs + (currentEndOffset / rate);
        
        const currentValue = msToEditString(currentAbsoluteEnd);
        const newValue = prompt('Edit Subcommand Absolute End Position:', currentValue);
        if (newValue !== null) {
          const newAbsoluteEnd = this.timeStringToMs(newValue);
          // Convert absolute position back to relative endMs
          // newAbsoluteEnd = cmd.positionMs + (newEndMs - cmd.startMs) / rate
          // (newAbsoluteEnd - cmd.positionMs) * rate = newEndMs - cmd.startMs
          // newEndMs = cmd.startMs + (newAbsoluteEnd - cmd.positionMs) * rate
          const newEndMs = cmd.startMs + (newAbsoluteEnd - cmd.positionMs) * rate;
          subCmd.endMs = Math.max(subCmd.startMs, newEndMs);
        }
      } else if (this.selectedCol === 4) {
        // Start column - edit subcommand start time
        const currentValue = msToEditString(subCmd.startMs);
        const newValue = prompt('Edit Subcommand Start:', currentValue);
        if (newValue !== null) {
          subCmd.startMs = this.timeStringToMs(newValue);
        }
      } else if (this.selectedCol === 5) {
        // Dur column - edit subcommand end time
        const currentValue = msToEditString(subCmd.endMs);
        const newValue = prompt('Edit Subcommand End:', currentValue);
        if (newValue !== null) {
          subCmd.endMs = this.timeStringToMs(newValue);
        }
      } else if (this.selectedCol === 8) {
        // Text column
        const currentText = subCmd.overlay?.textDisplay?.content || '';
        const currentAlignment = subCmd.overlay?.textDisplay?.alignment || 'lower-center';
        
        showTextareaModal({
          title: 'Edit Subcommand Text',
          initialValue: currentText,
          maxWidth: '600px',
          minHeight: '200px',
          onModalStateChange: (isOpen) => {
            this.isModalOpen = isOpen;
          },
          onSave: (newValue) => {
            // Update overlay textDisplay, preserving alignment
            if (newValue.trim() !== '') {
              if (!subCmd.overlay) {
                subCmd.overlay = new Overlay();
              }
              subCmd.overlay.textDisplay = new TextDisplay(newValue, currentAlignment);
            } else if (subCmd.overlay) {
              subCmd.overlay.textDisplay = undefined;
            }
            this.renderTable();
            this.maybeSave();
          }
        });
      } else if (this.selectedCol === 9) {
        // Fill column - edit subcommand overlay
        this.showOverlayModal();
      }
    } else if (isEmpty) {
      // Empty row - only allow creating new command in Asset column
      if (this.selectedCol === 1) {
        const assetUrl = prompt('Edit Asset URL:', '');
        if (assetUrl !== null) {
          if (assetUrl.trim() === '') {
            // Empty asset URL creates a black screen
            const currentMs = this.replayManager.getCurrentPosition() || 0;
            const newCmd = new ProjectCommand('', currentMs, 0, 4000, 0, 100, 'Black', undefined, undefined, 0, [], 0);
            this.project.commands.push(newCmd);
            this.project.ensureCommandIds();
          } else {
            const newCmd = this.createCommandFromAssetUrl(assetUrl.trim());
            this.project.commands.push(newCmd);
            this.project.ensureCommandIds();
          }
        }
      }
    }
  }

  handleCmdEnterKey() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type !== 'command') return;
    
    const cmd = this.project.commands[rowType.cmdIdx];
    
    // Create a new subcommand with the same time range as the command
    const newSubcommand = new Subcommand(cmd.startMs, cmd.endMs, '', undefined);
    cmd.subcommands.push(newSubcommand);
    
    showBanner(`Subcommand added (${cmd.subcommands.length} total)`, {
      id: 'subcommand-banner',
      position: 'bottom',
      color: 'green',
      duration: 1500
    });
  }

  async saveProject() {
    // Update lastEditedAt timestamp
    this.topLevelProject.metadata.lastEditedAt = Date.now();
    
    // Save the TopLevelProject
    const data = JSON.parse(this.topLevelProject.serialize());
    await this.dao.set(this.projectId, data);
  }

  timeStringToMs(str: string): number {
    if (!str) return 0;
    const parts = str.trim().split(/[: ]/);
    if (parts.length === 0) return 0;
    
    let total = 0;
    let multiplier = 1;
    
    // Process from right to left (seconds, minutes, hours)
    for (let i = parts.length - 1; i >= 0; i--) {
      const value = parseFloat(parts[i]);
      if (!isNaN(value)) {
        total += value * multiplier;
      }
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

  async handleExportImport() {
    // Save current state first
    await this.saveProject();
    
    // Export only the Project part (not metadata)
    const projectJson = this.project.serialize();
    const prettyJson = JSON.stringify(JSON.parse(projectJson), null, 2);
    
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
      onSave: async (value) => {
        try {
          // Import only the Project part
          const importedProject = Project.fromJSONString(value);
          
          // Update the current project but keep metadata
          this.topLevelProject.project = importedProject;
          
          // Save with updated lastEditedAt
          await this.saveProject();
          this.loadEditor();
          
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
    this.topLevelProject.project = Project.fromJSONString(stateJson);
    this.computeTetherMaps(); // Recompute after state change
    return true;
  }

  handleRedo() {
    if (!this.undoManager.canRedo()) return false;
    
    this.undoManager.redo();
    const stateJson = this.undoManager.getCurrentState();
    this.topLevelProject.project = Project.fromJSONString(stateJson);
    this.computeTetherMaps(); // Recompute after state change
    return true;
  }

  maybeSave(forceSave: boolean = false) {
    const currentJsonString = this.project.serialize();
    const hasChanged = this.undoManager.hasChanged(currentJsonString);
    if (hasChanged) {
      this.reloadPlayersIfNeeded();
      this.undoManager.updateIfChanged(currentJsonString);
    }
    if (hasChanged || forceSave) {
      this.saveProject();
      if (forceSave) {
        this.showSaveBanner();
      }
    }
  }

  reloadPlayersIfNeeded(): void {
    const enabledCommands = this.getEnabledCommands();
    
    // Check each enabled command to see if its player needs reloading
    for (const cmd of enabledCommands) {
      if (this.replayManager.needsPlayerReload(cmd)) {
        // Reload just this player
        this.replayManager.loadPlayer(cmd);
      }
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
      this.loadProject(this.projectId).then(() => this.loadEditor());
    }
  }

  async cloneProject() {
    // Save current project first
    await this.saveProject();
    
    // Generate new ID using timestamp
    const newId = Date.now().toString();
    
    // Serialize and deserialize to deep clone the entire project
    const serialized = this.topLevelProject.serialize();
    const cloned = TopLevelProject.fromJSON(JSON.parse(serialized));
    
    // Modify the specific fields for the clone
    cloned.project.title = this.project.title + '*';
    cloned.metadata.id = newId;
    const currentUser = getCurrentUser();
    cloned.metadata.owner = currentUser?.uid || '';
    cloned.metadata.createdAt = Date.now();
    cloned.metadata.lastEditedAt = Date.now();
    
    // Save the cloned project
    const data = JSON.parse(cloned.serialize());
    await this.dao.set(newId, data);
    
    // Navigate to the new project
    window.location.hash = `id=${newId}`;
  }

  async deleteProject() {
    const confirmed = confirm(
      `Are you sure you want to delete project "${this.project.title}"? This cannot be undone.`
    );

    if (confirmed) {
      // Remove project from DAO
      await this.dao.delete(this.projectId);

      // Navigate to home page and force reload
      window.location.hash = '';
      window.location.reload();
    }
  }

  showOverlayModal() {
    const rowType = this.rowTypes[this.selectedRow];
    if (!rowType || rowType.type === 'empty') return;
    
    let overlay: Overlay | undefined;
    if (rowType.type === 'command') {
      const cmd = this.project.commands[rowType.cmdIdx];
      overlay = cmd.overlay;
    } else {
      const cmd = this.project.commands[rowType.cmdIdx];
      const subCmd = cmd.subcommands[rowType.subIdx];
      overlay = subCmd.overlay;
    }
    
    const overlayJson = overlay ? JSON.stringify(overlay, null, 2) : '{}';
    
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
                newOverlayData.borderFilter.fillStyle,
                newOverlayData.borderFilter.leftMarginPct || 0,
                newOverlayData.borderFilter.rightMarginPct || 0
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
          
          // Save overlay to the correct location
          if (rowType.type === 'command') {
            const cmd = this.project.commands[rowType.cmdIdx];
            cmd.overlay = newOverlay;
          } else {
            const cmd = this.project.commands[rowType.cmdIdx];
            const subCmd = cmd.subcommands[rowType.subIdx];
            subCmd.overlay = newOverlay;
          }
          
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

  showEditShortConfigModal() {
    // Get current shortConfig or create default
    const currentConfig = this.project.shortConfig || new ShortConfig(0, 60000, 60);
    
    // Create user-friendly representation
    const userFriendlyConfig = {
      startTime: msToEditString(currentConfig.shortStartMs),
      stopTime: msToEditString(currentConfig.shortEndMs),
      pctOfFullWidth: currentConfig.pctOfFullWidth
    };
    
    const configJson = JSON.stringify(userFriendlyConfig, null, 2);
    
    showTextareaModal({
      title: 'Edit Short Config JSON',
      initialValue: configJson,
      maxWidth: '600px',
      minHeight: '200px',
      onModalStateChange: (isOpen) => {
        this.isModalOpen = isOpen;
      },
      onSave: (value) => {
        try {
          const newConfigData = JSON.parse(value);
          
          // Validate the data structure
          if (typeof newConfigData.startTime !== 'string' || 
              typeof newConfigData.stopTime !== 'string' || 
              typeof newConfigData.pctOfFullWidth !== 'number') {
            throw new Error('Invalid field types');
          }
          
          // Convert time strings to milliseconds
          const shortStartMs = this.timeStringToMs(newConfigData.startTime);
          const shortEndMs = this.timeStringToMs(newConfigData.stopTime);
          
          // Validate the values
          if (shortStartMs < 0 || 
              shortEndMs <= shortStartMs || 
              newConfigData.pctOfFullWidth <= 0) {
            throw new Error('Invalid field values');
          }
          
          // Create new ShortConfig with converted values
          const newConfig = new ShortConfig(
            shortStartMs,
            shortEndMs,
            newConfigData.pctOfFullWidth
          );
          
          // Update project
          this.project.shortConfig = newConfig;
          
          this.saveProject();
          
          showBanner('Short config updated!', {
            id: 'short-config-banner',
            position: 'bottom',
            color: 'green',
            duration: 1500
          });
        } catch (error) {
          showBanner('Invalid JSON format or values', {
            id: 'short-config-error-banner',
            position: 'bottom',
            color: 'red',
            duration: 2000
          });
        }
      }
    });
  }
}

