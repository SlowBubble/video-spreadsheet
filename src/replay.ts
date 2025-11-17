import { getHashParams } from './urlUtil';
import { showBanner } from './bannerUtil';
import { Overlay } from './project';

// Convert speed percentage to playback rate
// Speed is stored as percentage (5-100), but YouTube API uses rate (0.05-1.0)
function speedToRate(speed: number): number {
  return speed / 100;
}

export class Surrounding {
  starting: number[];
  ongoing: number[];
  ending: number[];
  timeMs: number;

  constructor(timeMs: number, starting: number[] = [], ongoing: number[] = [], ending: number[] = []) {
    this.timeMs = timeMs;
    this.starting = starting;
    this.ongoing = ongoing;
    this.ending = ending;
  }
}

export class PlanAction {
  start: number;
  end: number;
  cmdIdx: number; // Command index in original project commands array (-1 for black screen)
  playFromStart: boolean; // Start this video from beginning
  showVideo: boolean; // Show this video's iframe
  assetName: string;
  overlay?: Overlay;
  pauseVideo: boolean; // Whether to pause this video when it's not in the active list

  constructor(
    start: number,
    end: number,
    cmdIdx: number,
    playFromStart: boolean,
    showVideo: boolean,
    assetName: string,
    overlay?: Overlay,
    pauseVideo: boolean = true
  ) {
    this.start = start;
    this.end = end;
    this.cmdIdx = cmdIdx;
    this.playFromStart = playFromStart;
    this.showVideo = showVideo;
    this.assetName = assetName;
    this.pauseVideo = pauseVideo;
    if (overlay) {
      this.overlay = overlay;
    }
  }
}

export class ReplayManager {
  players: any[] = [];
  commands: any[] = [];
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

  drawBorderFilter(topMarginPct: number, bottomMarginPct: number, fillStyle: string) {
    if (!this.overlayCanvas) return;
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    const canvasHeight = this.overlayCanvas.height;
    const canvasWidth = this.overlayCanvas.width;
    
    // Draw top rectangle
    const topHeight = (canvasHeight * topMarginPct) / 100;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, canvasWidth, topHeight);
    
    // Draw bottom rectangle
    const bottomHeight = (canvasHeight * bottomMarginPct) / 100;
    ctx.fillRect(0, canvasHeight - bottomHeight, canvasWidth, bottomHeight);
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

  updateOverlay(overlay?: Overlay) {
    // Clear canvas first
    this.clearOverlay();
    
    if (!overlay) return;
    
    // Draw fullScreenFilter if present
    if (overlay.fullScreenFilter) {
      this.drawFullScreenFilter(overlay.fullScreenFilter.fillStyle);
    }
    
    // Draw borderFilter if present (on top of fullScreenFilter if both exist)
    if (overlay.borderFilter) {
      this.drawBorderFilter(
        overlay.borderFilter.topMarginPct,
        overlay.borderFilter.bottomMarginPct,
        overlay.borderFilter.fillStyle
      );
    }
    
    // Draw text if present (on top of filters)
    if (overlay.textDisplay && overlay.textDisplay.content) {
      this.drawText(overlay.textDisplay.content, overlay.textDisplay.alignment);
    }
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
        const startSec = Math.floor(cmd.startMs / 1000);
        const endSec = Math.floor(cmd.endMs / 1000);
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
    this.commands = commands;
    // Show black screen initially
    blackDiv.style.display = 'block';
  }

  getCommandName(idx: number): string {
    if (idx < 0 || idx >= this.commands.length) return `[${idx}]`;
    const cmd = this.commands[idx];
    return cmd.name || `[${idx}]`;
  }

  getVisibleCommand(timeMs: number, surroundings: Surrounding[]): number {
    // Find the surrounding for this timeMs
    const surrounding = surroundings.find(s => s.timeMs === timeMs);
    if (!surrounding) return -1;

    // Get all active commands (starting + ongoing)
    const activeCommands = [...surrounding.starting, ...surrounding.ongoing];
    
    // Return the max commandIdx (highest precedence)
    if (activeCommands.length === 0) return -1;
    return Math.max(...activeCommands);
  }

  generateReplayPlan2(enabledCommands: any[]): PlanAction[] {
    if (!enabledCommands || enabledCommands.length === 0) return [];

    // Step 1: Find all important points (start and end of each command)
    // Also add audio-end points for commands with extendAudioSec > 0
    const points = new Set<number>();
    enabledCommands.forEach((cmd) => {
      const startTime = cmd.positionMs;
      const videoDuration = cmd.endMs - cmd.startMs;
      const rate = speedToRate(cmd.speed);
      const actualDuration = videoDuration / rate;
      const endTime = cmd.positionMs + actualDuration;
      const extendAudioSec = cmd.extendAudioSec || 0;
      const audioEndTime = endTime + (extendAudioSec * 1000);
      
      points.add(startTime);
      points.add(endTime);
      if (extendAudioSec > 0) {
        points.add(audioEndTime);
      }
    });

    // Convert to sorted array
    const sortedPoints = Array.from(points).sort((a, b) => a - b);

    // Step 2: Create Surrounding objects for each time point
    const surroundings: Surrounding[] = [];
    
    sortedPoints.forEach((timeMs) => {
      const starting: number[] = [];
      const ongoing: number[] = [];
      const ending: number[] = [];

      enabledCommands.forEach((cmd, idx) => {
        const startTime = cmd.positionMs;
        const videoDuration = cmd.endMs - cmd.startMs;
        const rate = speedToRate(cmd.speed);
        const actualDuration = videoDuration / rate;
        const endTime = cmd.positionMs + actualDuration;

        if (timeMs === startTime) {
          starting.push(idx);
        } else if (timeMs === endTime) {
          ending.push(idx);
        } else if (timeMs > startTime && timeMs < endTime) {
          ongoing.push(idx);
        }
      });

      surroundings.push(new Surrounding(timeMs, starting, ongoing, ending));
    });

    // Step 3: Generate Plan Actions based on surroundings
    const plan: PlanAction[] = [];

    for (let i = 0; i < surroundings.length - 1; i++) {
      const current = surroundings[i];
      const next = surroundings[i + 1];
      
      const visibleCmdIdx = this.getVisibleCommand(current.timeMs, surroundings);
      
      // Get all active commands (starting + ongoing)
      const activeCommands = [...current.starting, ...current.ongoing];

      // Check for commands that are ending but have extended audio
      const endingWithAudio: number[] = [];
      const audioEnding: number[] = [];
      
      current.ending.forEach((cmdIdx) => {
        const cmd = enabledCommands[cmdIdx];
        const extendAudioSec = cmd.extendAudioSec || 0;
        const videoDuration = cmd.endMs - cmd.startMs;
        const rate = speedToRate(cmd.speed);
        const actualDuration = videoDuration / rate;
        const endTime = cmd.positionMs + actualDuration;
        const audioEndTime = endTime + (extendAudioSec * 1000);
        
        if (extendAudioSec > 0) {
          // If we're at the visual end but before audio end, keep it in the list
          if (current.timeMs === endTime && current.timeMs < audioEndTime) {
            endingWithAudio.push(cmdIdx);
          }
          // If we're at the audio end, mark it for pausing
          else if (current.timeMs === audioEndTime) {
            audioEnding.push(cmdIdx);
          }
        }
      });

      if (activeCommands.length === 0 && endingWithAudio.length === 0) {
        // No active commands, show black screen
        plan.push(new PlanAction(
          current.timeMs,
          next.timeMs,
          -1,
          false,
          true,
          '[Black Screen]'
        ));
      } else {
        // Create actions for each active command
        activeCommands.forEach((cmdIdx) => {
          const playFromStart = current.starting.includes(cmdIdx);
          const showVideo = (cmdIdx === visibleCmdIdx);
          const overlay = showVideo ? enabledCommands[cmdIdx].overlay : undefined;
          const assetName = this.getCommandName(cmdIdx);

          plan.push(new PlanAction(
            current.timeMs,
            next.timeMs,
            cmdIdx,
            playFromStart,
            showVideo,
            assetName,
            overlay,
            false // pauseVideo = false (keep playing)
          ));
        });
        
        // Create actions for commands with extended audio (don't pause yet)
        endingWithAudio.forEach((cmdIdx) => {
          const assetName = this.getCommandName(cmdIdx);
          
          plan.push(new PlanAction(
            current.timeMs,
            next.timeMs,
            cmdIdx,
            false, // playFromStart = false (already playing)
            false, // showVideo = false (visual has ended)
            assetName,
            undefined, // no overlay
            false // pauseVideo = false (keep audio playing)
          ));
        });
      }
      
      // Create pause actions for commands whose audio is ending
      audioEnding.forEach((cmdIdx) => {
        const assetName = this.getCommandName(cmdIdx);
        
        plan.push(new PlanAction(
          current.timeMs,
          next.timeMs,
          cmdIdx,
          false, // playFromStart = false
          false, // showVideo = false
          assetName,
          undefined, // no overlay
          true // pauseVideo = true (now pause it)
        ));
      });
    }

    // Handle the last point - show black screen
    const lastSurrounding = surroundings[surroundings.length - 1];
    plan.push(new PlanAction(
      lastSurrounding.timeMs,
      lastSurrounding.timeMs + 1000,
      -1,
      false,
      true,
      '[Black Screen]'
    ));

    console.log('[Plan Generated] Replay plan:', JSON.stringify(plan, null, 2));
    
    return plan;
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
    
    // Process each player
    this.players.forEach((player, i) => {
      const div = document.getElementById(`yt-player-edit-${i}`);
      const action = actions.find(a => a.cmdIdx === i);
      
      if (action) {
        // This video has an action
        
        // Check if we should pause it (for audio-ending actions)
        if (action.pauseVideo && player) {
          player.pauseVideo();
        } else {
          // Normal playback
          if (action.playFromStart && player) {
            // Start this video from the beginning
            const cmd = enabledCommands[i];
            const startSec = Math.floor(cmd.startMs / 1000);
            const rate = speedToRate(cmd.speed);
            player.seekTo(startSec);
            player.setVolume(cmd.volume);
            player.setPlaybackRate(rate);
            player.playVideo();
          } else if (player) {
            // Continue playing (already started)
            player.playVideo();
          }
        }
        
        // Show iframe only if this is the visible video
        if (div) {
          if (debugMode) {
            div.style.display = 'block';
          } else {
            div.style.display = action.showVideo ? 'block' : 'none';
          }
        }
      } else {
        // This video should not be playing, pause it and hide
        // (Only pause if not found in actions at all)
        if (player) {
          player.pauseVideo();
        }
        if (div && !debugMode) {
          div.style.display = 'none';
        }
      }
    });
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
      return;
    }
    
    const players = this.players;
    const commands = this.commands;
    const blackDiv = this.blackDiv;
    if (!players || !commands || !blackDiv) return;
    
    // Subtask 3.2: Generate the full replay plan and detect resume-from-end
    let plan = this.generateReplayPlan2(enabledCommands);
    if (plan.length === 0) return;
    
    // If endMs is specified, truncate the plan at that time
    if (endMs !== undefined) {
      // Filter and truncate actions
      const truncatedPlan: PlanAction[] = [];
      
      for (const action of plan) {
        if (action.start >= endMs) {
          // Action starts at or after endMs, skip it
          break;
        } else if (action.end <= endMs) {
          // Action ends before endMs, keep it as is
          truncatedPlan.push(action);
        } else {
          // Action spans across endMs, truncate it
          truncatedPlan.push(new PlanAction(
            action.start,
            endMs,
            action.cmdIdx,
            action.playFromStart,
            action.showVideo,
            action.assetName,
            action.overlay,
            action.pauseVideo
          ));
        }
      }
      
      plan = truncatedPlan;
      
      // Add a black screen action at endMs if plan is not empty
      // Use a very short duration (1ms) so it immediately triggers the end-of-plan logic
      if (plan.length > 0) {
        plan.push(new PlanAction(
          endMs,
          endMs + 1,
          -1,
          false,
          true,
          '[Black Screen]'
        ));
      }
    }
    
    if (plan.length === 0) return;
    
    const endTime = plan[plan.length - 1].start;
    
    // If resuming from or past the end, restart from beginning
    if (resumeFromMs !== undefined && resumeFromMs >= endTime) {
      resumeFromMs = 0;
    }
    
    // Subtask 3.3: Find the starting step for resume
    let startStep = 0;
    let initialDelay = plan.length > 0 ? plan[0].start : 0;
    
    if (resumeFromMs !== undefined && resumeFromMs > 0) {
      // Find the plan step where resumeFromMs falls
      for (let i = 0; i < plan.length; i++) {
        if (plan[i].start <= resumeFromMs && resumeFromMs < plan[i].end) {
          // Found a matching action, but we need to find the FIRST action at this time point
          // (since multiple actions can have the same start time)
          const matchingTime = plan[i].start;
          while (startStep < i && plan[startStep].start === matchingTime) {
            startStep++;
          }
          if (plan[startStep].start !== matchingTime) {
            startStep = i;
          }
          // Actually, let's just find the first action with this start time
          startStep = i;
          while (startStep > 0 && plan[startStep - 1].start === matchingTime) {
            startStep--;
          }
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
    this.replayOffset = resumeFromMs !== undefined ? resumeFromMs : (plan.length > 0 ? plan[0].start : 0);
    
    const updatePositionDisplay = () => {
      if (hideTime) return;
      const elapsed = Date.now() - this.replayStart;
      const posMs = this.replayOffset + elapsed;
      posDiv.textContent = `Position: ${(posMs / 1000).toFixed(1)}s`;
      posDiv.style.display = 'block';
    };
    
    let step = startStep;
    
    const nextStep = () => {
      if (!this.isPlaying) return;
      if (step >= plan.length) {
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
      const isStartingStep = (step === startStep);
      
      // Group actions by time point (all actions with the same start time)
      const currentTime = plan[step].start;
      const actions: PlanAction[] = [];
      while (step < plan.length && plan[step].start === currentTime) {
        actions.push(plan[step]);
        step++;
      }
      
      const action = actions[0]; // Use first action for timing info
      
      // Handle automatic pause at playback end
      // When reaching the final black screen step, pause at that position
      if (step >= plan.length && action.cmdIdx === -1) {
        // TODO see whether to use action.start or action.end here to be correct.
        this.pausedAtMs = action.end;
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
      
      // Subtask 3.3: Calculate remaining duration for the current step when resuming
      const isResumingMidStep = isStartingStep && resumeFromMs !== undefined && resumeFromMs > action.start;
      let stepDuration = action.end - action.start;
      if (isResumingMidStep && resumeFromMs !== undefined) {
        stepDuration = action.end - resumeFromMs;
      }
      
      this.replayStart = Date.now();
      this.replayOffset = (isResumingMidStep && resumeFromMs !== undefined) ? resumeFromMs : action.start;
      
      // Find which video should be visible and check for black screen
      const visibleAction = actions.find(a => a.showVideo);
      const isBlackScreen = !visibleAction || visibleAction.cmdIdx === -1 || 
        (visibleAction.cmdIdx >= 0 && this.commands[visibleAction.cmdIdx].asset === '');
      
      // In debug mode, hide black div; otherwise show it for black screens
      if (blackDiv) {
        if (this.isDebugMode()) {
          blackDiv.style.display = 'none';
        } else {
          blackDiv.style.display = isBlackScreen ? 'block' : 'none';
        }
      }
      
      // Execute all plan actions for this time point
      const isResuming = isStartingStep && resumeFromMs !== undefined && resumeFromMs > 0;
      if (isResuming && resumeFromMs !== undefined) {
        // When resuming mid-playback, seek all active videos to the correct position
        const visibleIdx = visibleAction ? visibleAction.cmdIdx : -1;
        this.seekAndPlayAllActiveVideos(resumeFromMs, visibleIdx, enabledCommands);
      } else {
        // Normal playback: execute all actions
        this.executeActions(actions, enabledCommands);
      }
      
      // Update overlay based on visible action
      this.updateOverlay(visibleAction?.overlay);
      
      this._intervalId && clearInterval(this._intervalId);
      this._intervalId = setInterval(updatePositionDisplay, 500);
      updatePositionDisplay();
      
      this._stepTimeoutId = setTimeout(() => {
        nextStep();
      }, Math.max(0, stepDuration));
    };
    
    this.hideAllPlayers();
    if (blackDiv) blackDiv.style.display = 'block';
    
    if (initialDelay > 0) {
      this._stepTimeoutId = setTimeout(() => {
        nextStep();
      }, Math.max(0, initialDelay));
    } else {
      nextStep();
    }
  }
}