import { getHashParams } from './urlUtil';
import { showBanner } from './bannerUtil';
import { Overlay } from './project';

// Convert speed percentage to playback rate
// Speed is stored as percentage (5-100), but YouTube API uses rate (0.05-1.0)
function speedToRate(speed: number): number {
  return speed / 100;
}

enum OpType {
  START_VIDEO = 'START_VIDEO',
  PAUSE_VIDEO = 'PAUSE_VIDEO',
  HIDE_VISUAL = 'HIDE_VISUAL',
  ADD_OVERLAY = 'ADD_OVERLAY',
  REMOVE_OVERLAY = 'REMOVE_OVERLAY'
}

class OpEvt {
  opType: OpType;
  timeMs: number;
  cmdIdx: number;
  subcommandIdx?: number;

  constructor(opType: OpType, timeMs: number, cmdIdx: number, subcommandIdx?: number) {
    this.opType = opType;
    this.timeMs = timeMs;
    this.cmdIdx = cmdIdx;
    if (subcommandIdx !== undefined) {
      this.subcommandIdx = subcommandIdx;
    }
  }
}

class OpEvtsGroup {
  opEvts: OpEvt[];
  ongoingCmdIndices: Set<number>;
  cmdIdxToOngoingSubcmdIndices: Map<number, Set<number>>; // ci2osi
  timeMs: number;

  constructor(timeMs: number, opEvts: OpEvt[]) {
    this.timeMs = timeMs;
    this.opEvts = opEvts;
    this.ongoingCmdIndices = new Set<number>();
    this.cmdIdxToOngoingSubcmdIndices = new Map<number, Set<number>>();
  }
}

// Abstract base class for all plan actions
abstract class PlanAction {
  replayPositionMs: number;
  cmdIdx: number; // Command index in original project commands array (-1 for black screen)
  debugAssetName: string; // For debugging purposes only
  actionType: string;

  constructor(replayPositionMs: number, cmdIdx: number, debugAssetName: string, actionType: string) {
    this.replayPositionMs = replayPositionMs;
    this.cmdIdx = cmdIdx;
    this.debugAssetName = debugAssetName;
    this.actionType = actionType;
  }
}

// Helper function to get action priority for sorting
function getActionPriority(action: PlanAction): number {
  const priorityMap: { [key: string]: number } = {
    'PlayVideoAction': 1,
    'OverlayAction': 2,
    'DisplayAction': 3,
    'PauseVideoAction': 4
  };
  return priorityMap[action.actionType] || 999;
}

class PlayVideoAction extends PlanAction {
  volume: number;
  playbackRate: number;

  constructor(replayPositionMs: number, cmdIdx: number, debugAssetName: string, volume: number, playbackRate: number) {
    super(replayPositionMs, cmdIdx, debugAssetName, 'PlayVideoAction');
    this.volume = volume;
    this.playbackRate = playbackRate;
  }
}

class OverlayAction extends PlanAction {
  overlays: Overlay[];

  constructor(replayPositionMs: number, cmdIdx: number, debugAssetName: string, overlays: Overlay[]) {
    super(replayPositionMs, cmdIdx, debugAssetName, 'OverlayAction');
    this.overlays = overlays;
  }
}

class DisplayAction extends PlanAction {
  // This action indicates which iframe should be displayed (all others hidden)
  constructor(replayPositionMs: number, cmdIdx: number, debugAssetName: string) {
    super(replayPositionMs, cmdIdx, debugAssetName, 'DisplayAction');
  }
}

class PauseVideoAction extends PlanAction {
  constructor(replayPositionMs: number, cmdIdx: number, debugAssetName: string) {
    super(replayPositionMs, cmdIdx, debugAssetName, 'PauseVideoAction');
  }
}

export class ReplayManager {
  players: any[] = [];
  blackDiv: HTMLDivElement | null = null;
  container: HTMLDivElement | null = null;
  overlayCanvas: HTMLCanvasElement | null = null;
  isPlaying: boolean = false;
  pausedAtMs: number = 0;
  replayStart: number = 0;
  replayOffset: number = 0;
  _intervalId: any = null;
  _stepTimeoutId: any = null;
  isInitialized: boolean = false;
  playersReadyCount: number = 0;
  totalPlayersExpected: number = 0;

  isDebugMode(): boolean {
    const params = getHashParams();
    return params.get('debug') === '1';
  }

  isPresentMode(): boolean {
    const params = getHashParams();
    return params.get('present') === '1';
  }

  showInitBanner() {
    // Don't show banner in present mode
    if (this.isPresentMode()) return;
    
    showBanner('Player loaded!', {
      id: 'init-banner',
      position: 'top',
      color: 'green',
      duration: 2000
    });
  }

  clearOverlay() {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  drawFullScreenFilter(fillStyle: string) {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    // Draw filter covering entire canvas
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  drawBorderFilter(topMarginPct: number, bottomMarginPct: number, fillStyle: string, leftMarginPct: number = 0, rightMarginPct: number = 0) {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    const canvasHeight = this.overlayCanvas.height;
    const canvasWidth = this.overlayCanvas.width;
    
    ctx.fillStyle = fillStyle;
    
    // Draw top rectangle
    const topHeight = (canvasHeight * topMarginPct) / 100;
    ctx.fillRect(0, 0, canvasWidth, topHeight);
    
    // Draw bottom rectangle
    const bottomHeight = (canvasHeight * bottomMarginPct) / 100;
    ctx.fillRect(0, canvasHeight - bottomHeight, canvasWidth, bottomHeight);
    
    // Draw left rectangle
    const leftWidth = (canvasWidth * leftMarginPct) / 100;
    ctx.fillRect(0, 0, leftWidth, canvasHeight);
    
    // Draw right rectangle
    const rightWidth = (canvasWidth * rightMarginPct) / 100;
    ctx.fillRect(canvasWidth - rightWidth, 0, rightWidth, canvasHeight);
  }

  drawText(content: string, alignment: string = 'upper-left') {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    // Set text properties
    const fontSize = 36;
    const lineHeight = fontSize * 1.2; // 20% spacing between lines
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = 'white';
    
    // Split content into lines
    const lines = content.split('\n');
    
    // Measure all lines to find the widest one
    let maxWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });
    
    const textWidth = maxWidth;
    const textHeight = lines.length * lineHeight;
    const padding = 10;
    const margin = 10;
    
    // Calculate position based on alignment
    let x: number, y: number;
    
    switch (alignment) {
      case 'upper-left':
        x = margin;
        y = margin;
        ctx.textBaseline = 'top';
        break;
      case 'lower-left':
        x = margin;
        y = this.overlayCanvas.height - margin - textHeight - padding * 2;
        ctx.textBaseline = 'top';
        break;
      case 'upper-right':
        x = this.overlayCanvas.width - margin - textWidth - padding * 2;
        y = margin;
        ctx.textBaseline = 'top';
        break;
      case 'lower-right':
        x = this.overlayCanvas.width - margin - textWidth - padding * 2;
        y = this.overlayCanvas.height - margin - textHeight - padding * 2;
        ctx.textBaseline = 'top';
        break;
      case 'center':
        x = (this.overlayCanvas.width - textWidth - padding * 2) / 2;
        y = (this.overlayCanvas.height - textHeight - padding * 2) / 2;
        ctx.textBaseline = 'top';
        break;
      case 'lower-center':
        x = (this.overlayCanvas.width - textWidth - padding * 2) / 2;
        y = this.overlayCanvas.height - margin - textHeight - padding * 2;
        ctx.textBaseline = 'top';
        break;
      case 'upper-center':
        x = (this.overlayCanvas.width - textWidth - padding * 2) / 2;
        y = margin;
        ctx.textBaseline = 'top';
        break;
      default:
        x = margin;
        y = margin;
        ctx.textBaseline = 'top';
    }
    
    // Draw black background with opacity
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, textWidth + padding * 2, textHeight + padding * 2);
    
    // Draw each line of text
    ctx.fillStyle = 'white';
    lines.forEach((line, index) => {
      ctx.fillText(line, x + padding, y + padding + (index * lineHeight));
    });
  }

  updateOverlay(overlays: Overlay[]) {
    // Clear canvas first
    this.clearOverlay();
    
    if (overlays.length === 0) return;
    
    // Draw all overlays in order
    overlays.forEach(overlay => {
      // Draw fullScreenFilter if present
      if (overlay.fullScreenFilter) {
        this.drawFullScreenFilter(overlay.fullScreenFilter.fillStyle);
      }
      
      // Draw borderFilter if present (on top of fullScreenFilter if both exist)
      if (overlay.borderFilter) {
        this.drawBorderFilter(
          overlay.borderFilter.topMarginPct,
          overlay.borderFilter.bottomMarginPct,
          overlay.borderFilter.fillStyle,
          overlay.borderFilter.leftMarginPct || 0,
          overlay.borderFilter.rightMarginPct || 0
        );
      }
      
      // Draw text if present (on top of filters)
      if (overlay.textDisplay && overlay.textDisplay.content) {
        this.drawText(overlay.textDisplay.content, overlay.textDisplay.alignment);
      }
    });
  }

  constructor(replayDiv: HTMLDivElement, commands: any[], getYouTubeId: (url: string) => string | null) {
    replayDiv.innerHTML = '';
    if (!commands.length) return;
    // Keep commands in original order - cmdIdx refers to position in this array
    commands = [...commands];
    
    const isPresentMode = this.isPresentMode();
    
    // Container for players and black screen
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '854px';
    // In debug mode, allow container to grow vertically for multiple players
    if (this.isDebugMode()) {
      container.style.minHeight = '480px';
    } else {
      container.style.height = '480px';
    }
    
    // In present mode, center the iframe based on window width
    if (isPresentMode) {
      replayDiv.style.margin = '0';
      replayDiv.style.padding = '0';
      
      // Center the iframe horizontally by offsetting it
      const defaultWidth = 854;
      const windowWidth = window.innerWidth;
      const offset = Math.round((defaultWidth - windowWidth) / 2);
      container.style.position = 'relative';
      container.style.left = `-${offset}px`;
      container.style.margin = '0';
    } else {
      container.style.margin = '0 auto';
    }
    
    replayDiv.appendChild(container);
    this.container = container;
    // Black screen div
    const blackDiv = document.createElement('div');
    blackDiv.style.position = 'absolute';
    blackDiv.style.top = '0';
    blackDiv.style.left = '0';
    blackDiv.style.width = '100%';
    blackDiv.style.height = '100%';
    blackDiv.style.background = 'black';
    blackDiv.style.display = 'block';
    container.appendChild(blackDiv);
    this.blackDiv = blackDiv;
    
    // Overlay canvas for filters, text, etc.
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = 854;
    overlayCanvas.height = 480;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.width = '854px';
    overlayCanvas.style.height = '480px';
    overlayCanvas.style.pointerEvents = 'none'; // Allow clicks to pass through
    overlayCanvas.style.zIndex = '10'; // Higher than iframes
    container.appendChild(overlayCanvas);
    this.overlayCanvas = overlayCanvas;
    
    // Wait for YT API
    const onYouTubeIframeAPIReady = () => {
      this.players = [];
      this.playersReadyCount = 0;
      this.totalPlayersExpected = commands.filter((cmd: any) => getYouTubeId(cmd.asset) !== null).length;
      
      commands.forEach((cmd: any, idx: number) => {
        const ytId = getYouTubeId(cmd.asset);
        const startSec = cmd.startMs / 1000;
        const endSec = cmd.endMs / 1000;
        const extendAudioSec = cmd.extendAudioSec || 0;
        const div = document.createElement('div');
        div.id = `yt-player-edit-${idx}`;
        // In debug mode, position players vertically; otherwise stack them
        if (this.isDebugMode()) {
          div.style.position = 'relative';
          div.style.marginBottom = '20px';
          div.style.display = 'block';
        } else {
          div.style.position = 'absolute';
          div.style.top = '0';
          div.style.left = '0';
          div.style.display = 'none';
        }
        container.appendChild(div);
        if (ytId) {
          const player = new (window as any).YT.Player(div.id, {
            width: '854',
            height: '480',
            videoId: ytId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              start: startSec,
              end: endSec + extendAudioSec,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: any) => {
                const rate = speedToRate(cmd.speed);
                event.target.seekTo(startSec);
                event.target.pauseVideo();
                event.target.setVolume(cmd.volume);
                event.target.setPlaybackRate(rate);
                
                // Track initialization progress
                this.playersReadyCount++;
                
                if (this.playersReadyCount === this.totalPlayersExpected) {
                  this.isInitialized = true;
                  this.showInitBanner();
                }
              }
            }
          });
          this.players.push(player);
        } else {
          this.players.push(null);
        }
      });
      // Show black screen initially
      blackDiv.style.display = 'block';
    };
    if ((window as any).YT && (window as any).YT.Player) {
      onYouTubeIframeAPIReady();
    } else {
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    }
    // Show black screen initially
    blackDiv.style.display = 'block';
  }

  getCommandName(idx: number, commands: any[]): string {
    if (idx < 0 || idx >= commands.length) return `[${idx}]`;
    const cmd = commands[idx];
    return cmd.name || `[${idx}]`;
  }



  private createOpEvts(enabledCommands: any[]): OpEvt[] {
    const opEvts: OpEvt[] = [];
    
    enabledCommands.forEach((cmd, idx) => {
      const startTime = cmd.positionMs;
      const videoDuration = cmd.endMs - cmd.startMs;
      const rate = speedToRate(cmd.speed);
      const actualDuration = videoDuration / rate;
      const endTime = startTime + actualDuration;
      const extendAudioSec = cmd.extendAudioSec || 0;
      
      if (extendAudioSec > 0) {
        // Three events: start video, hide visual, pause video
        opEvts.push(new OpEvt(OpType.START_VIDEO, startTime, idx));
        opEvts.push(new OpEvt(OpType.HIDE_VISUAL, endTime, idx));
        opEvts.push(new OpEvt(OpType.PAUSE_VIDEO, endTime + (extendAudioSec * 1000), idx));
      } else {
        // Two events: start video, pause video
        opEvts.push(new OpEvt(OpType.START_VIDEO, startTime, idx));
        opEvts.push(new OpEvt(OpType.PAUSE_VIDEO, endTime, idx));
      }
      
      // Add subcommand events
      if (cmd.subcommands && Array.isArray(cmd.subcommands)) {
        cmd.subcommands.forEach((subCmd: any, subIdx: number) => {
          // Calculate absolute time for subcommand based on command's position and speed
          const subStartOffset = subCmd.startMs - cmd.startMs;
          const subEndOffset = subCmd.endMs - cmd.startMs;
          const subStartTime = startTime + (subStartOffset / rate);
          const subEndTime = startTime + (subEndOffset / rate);
          
          console.log(`[createOpEvts] Subcommand ${subIdx}: startMs=${subCmd.startMs}, endMs=${subCmd.endMs}, subStartTime=${subStartTime}, subEndTime=${subEndTime}`);
          
          // Add ADD_OVERLAY event for subcommand start and REMOVE_OVERLAY for end
          opEvts.push(new OpEvt(OpType.ADD_OVERLAY, subStartTime, idx, subIdx));
          opEvts.push(new OpEvt(OpType.REMOVE_OVERLAY, subEndTime, idx, subIdx));
        });
      }
    });
    
    return opEvts;
  }

  private groupOpEvts(opEvts: OpEvt[]): OpEvtsGroup[] {
    // Group by timeMs
    const groupMap = new Map<number, OpEvt[]>();
    
    opEvts.forEach(evt => {
      if (!groupMap.has(evt.timeMs)) {
        groupMap.set(evt.timeMs, []);
      }
      groupMap.get(evt.timeMs)!.push(evt);
    });
    
    // Convert to OpEvtsGroup array and sort by timeMs
    const groups: OpEvtsGroup[] = [];
    groupMap.forEach((evts, timeMs) => {
      groups.push(new OpEvtsGroup(timeMs, evts));
    });
    
    groups.sort((a, b) => a.timeMs - b.timeMs);
    
    return groups;
  }

  private populateOngoingCmdIndices(groups: OpEvtsGroup[]): void {
    const oci = new Set<number>();
    const ci2osi = new Map<number, Set<number>>();
    
    groups.forEach(group => {
      // Process events in this group
      group.opEvts.forEach(evt => {
        if (evt.opType === OpType.START_VIDEO) {
          oci.add(evt.cmdIdx);
        } else if (evt.opType === OpType.HIDE_VISUAL || evt.opType === OpType.PAUSE_VIDEO) {
          // Remove from ongoing when visual is hidden or video is paused
          oci.delete(evt.cmdIdx);
          // Also clear subcommands for this command
          ci2osi.delete(evt.cmdIdx);
        } else if (evt.opType === OpType.ADD_OVERLAY && evt.subcommandIdx !== undefined) {
          // Add subcommand to ongoing set
          if (!ci2osi.has(evt.cmdIdx)) {
            ci2osi.set(evt.cmdIdx, new Set<number>());
          }
          const osi = ci2osi.get(evt.cmdIdx)!;
          osi.add(evt.subcommandIdx);
        } else if (evt.opType === OpType.REMOVE_OVERLAY && evt.subcommandIdx !== undefined) {
          // Remove subcommand from ongoing set
          const osi = ci2osi.get(evt.cmdIdx);
          if (osi) {
            osi.delete(evt.subcommandIdx);
          }
        }
      });
      
      // Copy current oci and ci2osi to this group
      group.ongoingCmdIndices = new Set(oci);
      group.cmdIdxToOngoingSubcmdIndices = new Map();
      ci2osi.forEach((osi, cmdIdx) => {
        group.cmdIdxToOngoingSubcmdIndices.set(cmdIdx, new Set(osi));
      });
    });
  }

  private generatePlayVideoActions(groups: OpEvtsGroup[], enabledCommands: any[]): PlayVideoAction[] {
    const actions: PlayVideoAction[] = [];
    
    groups.forEach(group => {
      group.opEvts.forEach(evt => {
        if (evt.opType === OpType.START_VIDEO) {
          const cmd = enabledCommands[evt.cmdIdx];
          const assetName = this.getCommandName(evt.cmdIdx, enabledCommands);
          const rate = speedToRate(cmd.speed);
          actions.push(new PlayVideoAction(group.timeMs, evt.cmdIdx, assetName, cmd.volume, rate));
        }
      });
    });
    
    return actions;
  }

  private generatePauseVideoActions(groups: OpEvtsGroup[], enabledCommands: any[]): PauseVideoAction[] {
    const actions: PauseVideoAction[] = [];
    
    groups.forEach(group => {
      group.opEvts.forEach(evt => {
        if (evt.opType === OpType.PAUSE_VIDEO) {
          const assetName = this.getCommandName(evt.cmdIdx, enabledCommands);
          actions.push(new PauseVideoAction(group.timeMs, evt.cmdIdx, assetName));
        }
      });
    });
    
    return actions;
  }

  private generateDisplayActions(groups: OpEvtsGroup[], enabledCommands: any[]): DisplayAction[] {
    const actions: DisplayAction[] = [];
    
    groups.forEach(group => {
      const visibleCmdIdx = group.ongoingCmdIndices.size > 0 
        ? Math.max(...Array.from(group.ongoingCmdIndices))
        : -1;
      
      const assetName = visibleCmdIdx >= 0 ? this.getCommandName(visibleCmdIdx, enabledCommands) : '[Black Screen]';
      actions.push(new DisplayAction(group.timeMs, visibleCmdIdx, assetName));
    });
    
    return actions;
  }



  private generateOverlayActions(groups: OpEvtsGroup[], enabledCommands: any[]): OverlayAction[] {
    const actions: OverlayAction[] = [];
    
    groups.forEach(group => {
      const visibleCmdIdx = group.ongoingCmdIndices.size > 0 
        ? Math.max(...Array.from(group.ongoingCmdIndices))
        : -1;
      
      // Collect overlays from the visible command and its ongoing subcommands
      const overlays: Overlay[] = [];
      if (visibleCmdIdx >= 0) {
        const cmd = enabledCommands[visibleCmdIdx];
        
        // Add command overlay if present
        if (cmd.overlay) {
          overlays.push(cmd.overlay);
        }
        
        // Add subcommand overlays if present
        const osi = group.cmdIdxToOngoingSubcmdIndices.get(visibleCmdIdx);
        if (osi && osi.size > 0 && cmd.subcommands) {
          osi.forEach(subIdx => {
            const subCmd = cmd.subcommands[subIdx];
            if (subCmd && subCmd.overlay) {
              overlays.push(subCmd.overlay);
            }
          });
        }
      }
      
      const assetName = visibleCmdIdx >= 0 ? this.getCommandName(visibleCmdIdx, enabledCommands) : '[Black Screen]';
      actions.push(new OverlayAction(group.timeMs, visibleCmdIdx, assetName, overlays));
    });
    
    return actions;
  }

  private deduplicateDisplayActions(actions: DisplayAction[]): DisplayAction[] {
    if (actions.length === 0) return actions;
    
    const deduplicated: DisplayAction[] = [actions[0]];
    
    for (let i = 1; i < actions.length; i++) {
      const prev = deduplicated[deduplicated.length - 1];
      const current = actions[i];
      
      // Only add if cmdIdx is different from previous
      if (current.cmdIdx !== prev.cmdIdx) {
        deduplicated.push(current);
      }
    }
    
    return deduplicated;
  }

  generateReplayPlan2(enabledCommands: any[]): PlanAction[] {
    if (!enabledCommands || enabledCommands.length === 0) return [];

    // Create operation events
    const opEvts = this.createOpEvts(enabledCommands);
    
    // Group by timeMs and sort
    const groups = this.groupOpEvts(opEvts);
    
    // Populate ongoing command indices
    this.populateOngoingCmdIndices(groups);
    
    // Generate actions
    const playActions = this.generatePlayVideoActions(groups, enabledCommands);
    const pauseActions = this.generatePauseVideoActions(groups, enabledCommands);
    let displayActions = this.generateDisplayActions(groups, enabledCommands);
    let overlayActions = this.generateOverlayActions(groups, enabledCommands);
    
    // Clean up
    displayActions = this.deduplicateDisplayActions(displayActions);
    // Note: We don't deduplicate overlay actions because we need empty overlays to clear them
    
    // Merge all actions
    const actions: PlanAction[] = [
      ...playActions,
      ...pauseActions,
      ...displayActions,
      ...overlayActions
    ];
    
    // Sort actions: ascending by replayPositionMs, then by type priority
    actions.sort((a, b) => {
      if (a.replayPositionMs !== b.replayPositionMs) {
        return a.replayPositionMs - b.replayPositionMs;
      }
      return getActionPriority(a) - getActionPriority(b);
    });

    // console.log('[Plan Generated] Replay plan:', JSON.stringify(actions, null, 2));
    
    return actions;
  }

  stopReplay() {
    this.isPlaying = false;
    this.pausedAtMs = 0;
    this._stepTimeoutId && clearTimeout(this._stepTimeoutId);
    this._intervalId && clearInterval(this._intervalId);
    this._stepTimeoutId = null;
    this._intervalId = null;
    this.hideAllPlayers();
    this.clearOverlay();
    if (this.blackDiv) this.blackDiv.style.display = 'block';
    const posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
    if (posDiv) posDiv.style.display = 'none';
  }

  pauseReplay() {
    if (!this.isPlaying) return;
    
    // Calculate current position
    this.pausedAtMs = this.replayOffset + (Date.now() - this.replayStart);
    
    // Update state and clear timers
    this.isPlaying = false;
    this._stepTimeoutId && clearTimeout(this._stepTimeoutId);
    this._intervalId && clearInterval(this._intervalId);
    this._stepTimeoutId = null;
    this._intervalId = null;
    
    // Pause all YouTube players without hiding them
    this.players.forEach((player) => {
      if (player) {
        player.pauseVideo();
      }
    });
    // Keep position display visible showing the paused time
    const posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
    if (posDiv) {
      posDiv.textContent = `Position: ${(this.pausedAtMs / 1000).toFixed(1)}s (Paused)`;
      posDiv.style.display = 'block';
    }
  }

  getCurrentPosition(): number | null {
    if (this.isPlaying) {
      return this.replayOffset + (Date.now() - this.replayStart);
    } else {
      return this.pausedAtMs;
    }
  }

  getTotalDuration(enabledCommands: any[]): number {
    // Calculate the total duration by finding the maximum end time of all enabled commands
    if (enabledCommands.length === 0) return 0;
    
    let maxEndTime = 0;
    enabledCommands.forEach((cmd) => {
      const videoDuration = cmd.endMs - cmd.startMs;
      const rate = speedToRate(cmd.speed);
      const actualDuration = videoDuration / rate;
      const endTime = cmd.positionMs + actualDuration;
      maxEndTime = Math.max(maxEndTime, endTime);
    });
    
    return maxEndTime;
  }

  seekToTime(newMs: number, enabledCommands: any[], endMs?: number) {
    // If currently playing, pause first
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pauseReplay();
    }
    
    // Update paused position (don't go below 0)
    this.pausedAtMs = Math.max(0, newMs);
    
    // Update position display
    if (this.isPresentMode()) {
      const posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
      if (posDiv) {
        posDiv.textContent = `Position: ${(this.pausedAtMs / 1000).toFixed(1)}s (Paused)`;
        posDiv.style.display = 'block';
      }
    }
    
    // If was playing, resume from new position
    if (wasPlaying) {
      this.startReplay(this.pausedAtMs, enabledCommands, endMs);
    }
  }

  rewind(rewindMs: number, enabledCommands: any[], endMs?: number) {
    const currentMs = this.getCurrentPosition();
    if (currentMs === null) return;
    
    const newMs = currentMs - rewindMs;
    this.seekToTime(newMs, enabledCommands, endMs);
  }

  fastForward(forwardMs: number, enabledCommands: any[], endMs?: number) {
    const currentMs = this.getCurrentPosition();
    if (currentMs === null) return;
    
    const newMs = currentMs + forwardMs;
    this.seekToTime(newMs, enabledCommands, endMs);
  }

  hideAllPlayers() {
    const debugMode = this.isDebugMode();
    this.players.forEach((player, idx) => {
      const div = document.getElementById(`yt-player-edit-${idx}`);
      // In debug mode, keep players visible; otherwise hide them
      if (div && !debugMode) div.style.display = 'none';
      if (player) {
        player.pauseVideo();
      }
    });
  }

  executeActions(actions: PlanAction[], enabledCommands: any[]) {
    const debugMode = this.isDebugMode();
    
    // Group actions by type for easier processing
    const playActions = actions.filter(a => a instanceof PlayVideoAction) as PlayVideoAction[];
    const displayActions = actions.filter(a => a instanceof DisplayAction) as DisplayAction[];
    const pauseActions = actions.filter(a => a instanceof PauseVideoAction) as PauseVideoAction[];
    const overlayActions = actions.filter(a => a instanceof OverlayAction) as OverlayAction[];
    
    // Determine which iframe should be displayed (only if there's a DisplayAction)
    const displayAction = displayActions[0]; // Should only be one DisplayAction per time point
    
    // Only update display if there's a DisplayAction
    if (displayAction) {
      const visibleCmdIdx = displayAction.cmdIdx;
      
      // Show/hide black screen
      if (this.blackDiv) {
        if (debugMode) {
          this.blackDiv.style.display = 'none';
        } else {
          const isBlackScreen = visibleCmdIdx === -1 || 
            (visibleCmdIdx >= 0 && enabledCommands[visibleCmdIdx].asset === '');
          this.blackDiv.style.display = isBlackScreen ? 'block' : 'none';
        }
      }
      
      // Show/hide iframes based on DisplayAction
      this.players.forEach((_player, i) => {
        const div = document.getElementById(`yt-player-edit-${i}`);
        if (div) {
          if (debugMode) {
            div.style.display = 'block';
          } else {
            div.style.display = (i === visibleCmdIdx) ? 'block' : 'none';
          }
        }
      });
    }
    
    // Process play and pause actions
    this.players.forEach((player, i) => {
      // Check if this player should play from start
      const playAction = playActions.find(a => a.cmdIdx === i);
      if (playAction && player) {
        const cmd = enabledCommands[i];
        const startSec = cmd.startMs / 1000;
        player.seekTo(startSec);
        player.setVolume(playAction.volume);
        player.setPlaybackRate(playAction.playbackRate);
        player.playVideo();
      }
      
      // Check if this player should be paused
      const pauseAction = pauseActions.find(a => a.cmdIdx === i);
      if (pauseAction && player) {
        player.pauseVideo();
      }
    });
    
    // Update overlay based on OverlayAction
    const overlayAction = overlayActions[0]; // Should only be one OverlayAction per time point
    this.updateOverlay(overlayAction?.overlays || []);
  }

  seekAndPlayAllActiveVideos(resumeFromMs: number, visibleIdx: number, enabledCommands: any[]) {
    // Find all enabled commands that should be playing at resumeFromMs
    const activeCommands: number[] = [];
    enabledCommands.forEach((cmd, idx) => {
      const cmdStart = cmd.positionMs;
      const videoDuration = cmd.endMs - cmd.startMs;
      const rate = speedToRate(cmd.speed);
      const actualDuration = videoDuration / rate;
      const cmdEnd = cmd.positionMs + actualDuration;
      
      // Check if this command overlaps with resumeFromMs
      if (resumeFromMs >= cmdStart && resumeFromMs < cmdEnd) {
        activeCommands.push(idx);
      }
    });
    
    // Seek and play all active commands
    this.players.forEach((player, i) => {
      const div = document.getElementById(`yt-player-edit-${i}`);
      
      if (activeCommands.includes(i) && player) {
        const cmd = enabledCommands[i];
        const cmdStart = cmd.positionMs;
        const elapsedInCmd = resumeFromMs - cmdStart;
        const rate = speedToRate(cmd.speed);
        // Account for playback speed: if playing at 0.8x speed, video progresses slower
        const videoElapsed = elapsedInCmd * rate;
        const seekToMs = cmd.startMs + videoElapsed;
        const seekToSec = seekToMs / 1000;
        
        // In debug mode, show all players; otherwise show only the visible one
        if (div) {
          if (this.isDebugMode()) {
            div.style.display = 'block';
          } else {
            div.style.display = i === visibleIdx ? 'block' : 'none';
          }
        }
        
        // But seek and play all active players
        player.seekTo(seekToSec);
        player.setVolume(cmd.volume);
        player.setPlaybackRate(rate);
        player.playVideo();
      } else {
        // In debug mode, keep inactive players visible; otherwise hide them
        if (div) {
          if (this.isDebugMode()) {
            div.style.display = 'block';
          } else {
            div.style.display = 'none';
          }
        }
        if (player) {
          player.pauseVideo();
        }
      }
    });
  }

  startReplay(resumeFromMs: number | undefined, enabledCommands: any[], endMs?: number) {
    if (this.isPlaying) return;
    
    // Check if players are initialized
    if (!this.isInitialized) {
      showBanner('Loading is not finished.', {
        id: 'loading-banner',
        position: 'top',
        color: 'yellow',
        duration: 2000
      });
      return;
    }
    
    const players = this.players;
    const blackDiv = this.blackDiv;
    if (!players || !blackDiv || !enabledCommands || enabledCommands.length === 0) return;
    
    // Subtask 3.2: Generate the full replay plan and detect resume-from-end
    let plan = this.generateReplayPlan2(enabledCommands);
    if (plan.length === 0) return;
    
    // If endMs is specified, filter actions that occur at or after endMs
    if (endMs !== undefined) {
      plan = plan.filter(action => action.replayPositionMs < endMs);
      
      // Add a black screen action at endMs if plan is not empty
      if (plan.length > 0) {
        plan.push(new DisplayAction(endMs, -1, '[Black Screen]'));
      }
    }
    
    if (plan.length === 0) return;
    
    // Find the last time point in the plan
    const endTime = Math.max(...plan.map(a => a.replayPositionMs));
    
    // If resuming from or past the end, restart from beginning
    if (resumeFromMs !== undefined && resumeFromMs >= endTime) {
      resumeFromMs = 0;
    }
    
    // Subtask 3.3: Find the starting step for resume
    // Get unique time points in the plan
    const timePoints = Array.from(new Set(plan.map(a => a.replayPositionMs))).sort((a, b) => a - b);
    
    let startTimeIdx = 0;
    let initialDelay = timePoints.length > 0 ? timePoints[0] : 0;
    
    if (resumeFromMs !== undefined && resumeFromMs > 0) {
      // Find the time point where resumeFromMs falls or the closest one before it
      for (let i = timePoints.length - 1; i >= 0; i--) {
        if (timePoints[i] <= resumeFromMs) {
          startTimeIdx = i;
          initialDelay = 0; // Start immediately when resuming
          break;
        }
      }
    }
    
    // Update state to playing
    this.isPlaying = true;
    
    // Create or get position display div (fixed at top right of browser)
    const hideTime = this.isPresentMode();
    let posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
    if (!posDiv && !hideTime) {
      posDiv = document.createElement('div');
      posDiv.id = 'replay-pos-div';
      posDiv.style.position = 'fixed';
      posDiv.style.top = '12px';
      posDiv.style.right = '24px';
      posDiv.style.background = 'rgba(0,0,0,0.7)';
      posDiv.style.color = 'white';
      posDiv.style.fontSize = '2em';
      posDiv.style.padding = '8px 16px';
      posDiv.style.borderRadius = '8px';
      posDiv.style.zIndex = '9999';
      document.body.appendChild(posDiv);
    }
    
    // Update replayStart and replayOffset for position tracking
    this.replayStart = Date.now();
    this.replayOffset = resumeFromMs !== undefined ? resumeFromMs : (timePoints.length > 0 ? timePoints[0] : 0);
    
    const updatePositionDisplay = () => {
      if (hideTime) return;
      const elapsed = Date.now() - this.replayStart;
      const posMs = this.replayOffset + elapsed;
      posDiv.textContent = `Position: ${(posMs / 1000).toFixed(1)}s`;
      posDiv.style.display = 'block';
    };
    
    let timeIdx = startTimeIdx;
    
    const nextStep = () => {
      if (!this.isPlaying) return;
      if (timeIdx >= timePoints.length) {
        this.hideAllPlayers();
        this.clearOverlay();
        if (blackDiv) blackDiv.style.display = 'block';
        if (!hideTime && posDiv) posDiv.style.display = 'none';
        this._intervalId && clearInterval(this._intervalId);
        this._intervalId = null;
        this.isPlaying = false;
        this.pausedAtMs = 0;
        return;
      }
      
      // Check if this is the starting step BEFORE we increment
      const isStartingStep = (timeIdx === startTimeIdx);
      
      // Get current time point and all actions at this time
      const currentTime = timePoints[timeIdx];
      const actions = plan.filter(a => a.replayPositionMs === currentTime);
      
      // Log actions being executed
      console.log(`[nextStep] timeMs=${currentTime}, actions:`, JSON.stringify(actions, null, 2));
      
      // Move to next time point
      timeIdx++;
      
      // Handle automatic pause at playback end
      // When reaching the final time point with a black screen DisplayAction, pause
      if (timeIdx >= timePoints.length) {
        const displayAction = actions.find(a => a instanceof DisplayAction) as DisplayAction | undefined;
        if (displayAction && displayAction.cmdIdx === -1) {
          this.pausedAtMs = currentTime;
          this.isPlaying = false;
          this._stepTimeoutId && clearTimeout(this._stepTimeoutId);
          this._intervalId && clearInterval(this._intervalId);
          this._stepTimeoutId = null;
          this._intervalId = null;
          this.clearOverlay();
          
          // Hide all players and show black screen
          this.hideAllPlayers();
          if (blackDiv) blackDiv.style.display = 'block';
          
          // Update position display to show paused at end
          if (!hideTime && posDiv) {
            posDiv.textContent = `Position: ${(this.pausedAtMs / 1000).toFixed(1)}s (Paused at end)`;
            posDiv.style.display = 'block';
          }
          return;
        }
      }
      
      // Calculate step duration (time until next time point)
      const nextTime = timeIdx < timePoints.length ? timePoints[timeIdx] : currentTime + 1000;
      const isResumingMidStep = isStartingStep && resumeFromMs !== undefined && resumeFromMs > currentTime;
      let stepDuration = nextTime - currentTime;
      if (isResumingMidStep && resumeFromMs !== undefined) {
        stepDuration = nextTime - resumeFromMs;
      }
      
      this.replayStart = Date.now();
      this.replayOffset = (isResumingMidStep && resumeFromMs !== undefined) ? resumeFromMs : currentTime;
      
      // Execute all plan actions for this time point
      const isResuming = isStartingStep && resumeFromMs !== undefined && resumeFromMs > 0;
      if (isResuming && resumeFromMs !== undefined) {
        // When resuming mid-playback, we need to:
        // 1. Find and execute the most recent DisplayAction and OverlayAction to set up the visual state
        // 2. Use special video seeking logic for active videos
        
        // Find the most recent DisplayAction at or before resumeFromMs
        const allDisplayActions = plan.filter(a => a instanceof DisplayAction && a.replayPositionMs <= resumeFromMs);
        const mostRecentDisplayAction = allDisplayActions.length > 0 
          ? allDisplayActions[allDisplayActions.length - 1] as DisplayAction
          : null;
        
        // Find the most recent OverlayAction at or before resumeFromMs
        const allOverlayActions = plan.filter(a => a instanceof OverlayAction && a.replayPositionMs <= resumeFromMs);
        const mostRecentOverlayAction = allOverlayActions.length > 0
          ? allOverlayActions[allOverlayActions.length - 1] as OverlayAction
          : null;
        
        // Execute the most recent DisplayAction and OverlayAction to establish current state
        const initialStateActions: PlanAction[] = [];
        if (mostRecentDisplayAction) initialStateActions.push(mostRecentDisplayAction);
        if (mostRecentOverlayAction) initialStateActions.push(mostRecentOverlayAction);
        
        if (initialStateActions.length > 0) {
          this.executeActions(initialStateActions, enabledCommands);
        }
        
        // Seek and play all active videos
        const visibleIdx = mostRecentDisplayAction ? mostRecentDisplayAction.cmdIdx : -1;
        this.seekAndPlayAllActiveVideos(resumeFromMs, visibleIdx, enabledCommands);
      } else {
        // Normal playback: execute all actions
        this.executeActions(actions, enabledCommands);
      }
      
      this._intervalId && clearInterval(this._intervalId);
      this._intervalId = setInterval(updatePositionDisplay, 500);
      updatePositionDisplay();
      
      this._stepTimeoutId = setTimeout(() => {
        nextStep();
      }, Math.max(0, stepDuration));
    };
    
    this.hideAllPlayers();
    if (blackDiv) blackDiv.style.display = 'block';
    
    // Update replayStart and replayOffset for initial position tracking
    this.replayStart = Date.now();
    this.replayOffset = resumeFromMs !== undefined ? resumeFromMs : (timePoints.length > 0 ? timePoints[0] : 0);
    
    if (initialDelay > 0) {
      this._stepTimeoutId = setTimeout(() => {
        nextStep();
      }, Math.max(0, initialDelay));
    } else {
      nextStep();
    }
  }
}