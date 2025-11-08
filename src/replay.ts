export class ReplayManager {
  players: any[] = [];
  commands: any[] = [];
  blackDiv: HTMLDivElement | null = null;
  container: HTMLDivElement | null = null;
  replaying: boolean = false;
  paused: boolean = false;
  pausedAtMs: number | undefined = undefined;
  replayStart: number = 0;
  replayOffset: number = 0;
  _intervalId: any = null;
  _stepTimeoutId: any = null;

  constructor(replayDiv: HTMLDivElement, commands: any[], getYouTubeId: (url: string) => string | null) {
    replayDiv.innerHTML = '';
    if (!commands.length) return;
    commands = [...commands].sort((a, b) => a.positionMs - b.positionMs);
    // Container for players and black screen
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '854px';
    container.style.height = '480px';
    container.style.margin = '0 auto';
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
    // Wait for YT API
    const self = this;
    function onYouTubeIframeAPIReady() {
      self.players = [];
      commands.forEach((cmd: any, idx: number) => {
        const ytId = getYouTubeId(cmd.asset);
        const startSec = Math.floor(cmd.startMs / 1000);
        const endSec = Math.floor(cmd.endMs / 1000);
        const div = document.createElement('div');
        div.id = `yt-player-edit-${idx}`;
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.display = 'none';
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
              end: endSec,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: any) => {
                console.log(`[Init ${idx}] onReady - Setting speed: ${cmd.speed}, volume: ${cmd.volume}`);
                event.target.seekTo(startSec);
                event.target.pauseVideo();
                event.target.setVolume(cmd.volume);
                event.target.setPlaybackRate(cmd.speed);
              }
            }
          });
          self.players.push(player);
        } else {
          self.players.push(null);
        }
      });
      // Show black screen initially
      blackDiv.style.display = 'block';
    }
    if ((window as any).YT && (window as any).YT.Player) {
      onYouTubeIframeAPIReady();
    } else {
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    }
    self.commands = commands;
    // Show black screen initially
    blackDiv.style.display = 'block';
  }

  generateReplayPlan() {
    const cmds = this.commands;
    if (!cmds || !cmds.length) return [];
    // Collect all change points (start and end of intervals)
    // Account for playback speed: slower speed = longer actual duration
    const points: number[] = [];
    cmds.forEach((cmd: any) => {
      const a = cmd.positionMs;
      const videoDuration = cmd.endMs - cmd.startMs;
      const actualDuration = videoDuration / cmd.speed;
      const b = cmd.positionMs + actualDuration;
      points.push(a, b);
    });
    // Remove duplicates and sort
    const uniquePoints = Array.from(new Set(points)).sort((a, b) => a - b);
    const plan: { start: number, end: number, idx: number, resume: boolean }[] = [];
    let lastVisible: { [idx: number]: number } = {};
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const c = uniquePoints[i];
      let idx = -1;
      for (let j = cmds.length - 1; j >= 0; j--) {
        const a = cmds[j].positionMs;
        const videoDuration = cmds[j].endMs - cmds[j].startMs;
        const actualDuration = videoDuration / cmds[j].speed;
        const b = cmds[j].positionMs + actualDuration;
        if (c >= a && c < b) {
          idx = j;
          break;
        }
      }
      let resume = false;
      if (idx !== -1) {
        // Resume if this idx was visible before and not restarting
        resume = lastVisible[idx] !== undefined && lastVisible[idx] < c;
        lastVisible[idx] = c;
      }
      plan.push({ start: c, end: uniquePoints[i + 1], idx, resume });
    }
    // For the last change point, show black screen
    plan.push({ start: uniquePoints[uniquePoints.length - 1], end: uniquePoints[uniquePoints.length - 1] + 1000, idx: -1, resume: false });
    return plan;
  }

  stopReplay() {
    this.replaying = false;
    this.paused = false;
    this.pausedAtMs = undefined;
    this._stepTimeoutId && clearTimeout(this._stepTimeoutId);
    this._intervalId && clearInterval(this._intervalId);
    this._stepTimeoutId = null;
    this._intervalId = null;
    this.hideAllPlayers();
    if (this.blackDiv) this.blackDiv.style.display = 'block';
    const posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
    if (posDiv) posDiv.style.display = 'none';
  }

  pauseReplay() {
    if (!this.replaying) return;
    
    // Subtask 2.1: Calculate current position
    this.pausedAtMs = this.replayOffset + (Date.now() - this.replayStart);
    console.log(`[Pause] Paused at position: ${(this.pausedAtMs / 1000).toFixed(1)}s`);
    
    // Subtask 2.2: Update state flags and clear timers
    this.paused = true;
    this.replaying = false;
    this._stepTimeoutId && clearTimeout(this._stepTimeoutId);
    this._intervalId && clearInterval(this._intervalId);
    this._stepTimeoutId = null;
    this._intervalId = null;
    
    // Subtask 2.3: Pause all YouTube players without hiding them
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

  hideAllPlayers() {
    this.players.forEach((player, idx) => {
      const div = document.getElementById(`yt-player-edit-${idx}`);
      if (div) div.style.display = 'none';
      if (player) player.pauseVideo();
    });
  }

  showPlayer(idx: number, resume: boolean) {
    this.players.forEach((player, i) => {
      const div = document.getElementById(`yt-player-edit-${i}`);
      if (div) div.style.display = i === idx ? 'block' : 'none';
      if (i === idx && player) {
        if (!resume) {
          const cmd = this.commands[i];
          const startSec = Math.floor(cmd.startMs / 1000);
          console.log(`[Action ${idx}] Setting speed: ${cmd.speed}, volume: ${cmd.volume}, startSec: ${startSec}`);
          player.seekTo(startSec);
          player.setVolume(cmd.volume);
          player.setPlaybackRate(cmd.speed);
          player.playVideo();
        } else {
          console.log(`[Action ${idx}] Resuming playback (no speed change)`);
          player.playVideo();
        }
      }
    });
  }

  startReplay(resumeFromMs?: number) {
    if (this.replaying) return;
    
    const players = this.players;
    const commands = this.commands;
    const blackDiv = this.blackDiv;
    if (!players || !commands || !blackDiv) return;
    
    // Subtask 3.2: Generate the full replay plan and detect resume-from-end
    const plan = this.generateReplayPlan();
    if (plan.length === 0) return;
    
    const endTime = plan[plan.length - 1].start;
    
    // If resuming from or past the end, restart from beginning
    if (resumeFromMs !== undefined && resumeFromMs >= endTime) {
      console.log(`[Resume] Position ${(resumeFromMs / 1000).toFixed(1)}s is at or past end ${(endTime / 1000).toFixed(1)}s, restarting from beginning`);
      resumeFromMs = 0;
    }
    
    // Subtask 3.3: Find the starting step for resume
    let startStep = 0;
    let initialDelay = plan.length > 0 ? plan[0].start : 0;
    
    if (resumeFromMs !== undefined && resumeFromMs > 0) {
      console.log(`[Resume] Resuming from position: ${(resumeFromMs / 1000).toFixed(1)}s`);
      
      // Find the plan step where resumeFromMs falls
      for (let i = 0; i < plan.length; i++) {
        if (plan[i].start <= resumeFromMs && resumeFromMs < plan[i].end) {
          startStep = i;
          initialDelay = 0; // Start immediately when resuming
          break;
        }
      }
    }
    
    // Subtask 3.5: Update state flags for resume
    this.paused = false;
    this.replaying = true;
    
    // Create or get position display div (fixed at top right of browser)
    let posDiv = document.getElementById('replay-pos-div') as HTMLDivElement;
    if (!posDiv) {
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
    
    // Subtask 3.5: Update replayStart and replayOffset for position tracking
    this.replayStart = Date.now();
    this.replayOffset = resumeFromMs !== undefined ? resumeFromMs : (plan.length > 0 ? plan[0].start : 0);
    
    function updatePositionDisplay() {
      const elapsed = Date.now() - self.replayStart;
      const posMs = self.replayOffset + elapsed;
      posDiv.textContent = `Position: ${(posMs / 1000).toFixed(1)}s`;
      posDiv.style.display = 'block';
    }
    
    let step = startStep;
    const self = this;
    
    function nextStep() {
      if (!self.replaying) return;
      if (step >= plan.length) {
        self.hideAllPlayers();
        if (blackDiv) blackDiv.style.display = 'block';
        if (posDiv) posDiv.style.display = 'none';
        self._intervalId && clearInterval(self._intervalId);
        self._intervalId = null;
        self.replaying = false;
        return;
      }
      const { start, end, idx, resume } = plan[step];
      
      // Task 5: Handle automatic pause at playback end
      // When reaching the final black screen step, transition to paused state
      if (step >= plan.length - 1 && idx === -1) {
        console.log(`[Playback End] Reached end at ${(end / 1000).toFixed(1)}s, transitioning to paused state`);
        self.pausedAtMs = end;
        self.paused = true;
        self.replaying = false;
        self._stepTimeoutId && clearTimeout(self._stepTimeoutId);
        self._intervalId && clearInterval(self._intervalId);
        self._stepTimeoutId = null;
        self._intervalId = null;
        
        // Update position display to show paused at end
        if (posDiv) {
          posDiv.textContent = `Position: ${(self.pausedAtMs / 1000).toFixed(1)}s (Paused at end)`;
          posDiv.style.display = 'block';
        }
        return;
      }
      
      // Subtask 3.3: Calculate remaining duration for the current step when resuming
      let stepDuration = end - start;
      if (step === startStep && resumeFromMs !== undefined && resumeFromMs > start) {
        stepDuration = end - resumeFromMs;
        console.log(`[Plan ${step}] Resuming mid-step: start: ${start}ms, resumeFrom: ${resumeFromMs}ms, end: ${end}ms, idx: ${idx}, remaining: ${stepDuration}ms`);
      } else {
        console.log(`[Plan ${step}] start: ${start}ms, end: ${end}ms, idx: ${idx}, resume: ${resume}`);
      }
      
      self.replayStart = Date.now();
      self.replayOffset = (step === startStep && resumeFromMs !== undefined && resumeFromMs > start) ? resumeFromMs : start;
      
      if (blackDiv) blackDiv.style.display = idx === -1 ? 'block' : 'none';
      
      // Subtask 3.4: Implement video seeking for resume
      if (idx !== -1) {
        if (step === startStep && resumeFromMs !== undefined && resumeFromMs > start) {
          // Calculate elapsed time within the current step
          const elapsedInStep = resumeFromMs - start;
          const cmd = commands[idx];
          
          // Determine if this is a resume scenario (video was already playing)
          // Check if the video started before the pause point
          const videoStartInTimeline = cmd.positionMs;
          const isResumeScenario = resumeFromMs > videoStartInTimeline;
          
          // Calculate video seek position accounting for playback speed
          const videoElapsed = elapsedInStep;
          const seekToMs = cmd.startMs + videoElapsed;
          const seekToSec = seekToMs / 1000;
          
          console.log(`[Action ${idx}] Seeking to ${seekToSec.toFixed(2)}s (elapsed in step: ${(elapsedInStep / 1000).toFixed(2)}s, isResume: ${isResumeScenario})`);
          
          // Show the player and seek to the correct position
          self.players.forEach((player, i) => {
            const div = document.getElementById(`yt-player-edit-${i}`);
            if (div) div.style.display = i === idx ? 'block' : 'none';
            if (i === idx && player) {
              player.seekTo(seekToSec);
              if (!isResumeScenario) {
                // Fresh start - set volume and speed
                player.setVolume(cmd.volume);
                player.setPlaybackRate(cmd.speed);
              }
              player.playVideo();
            }
          });
        } else {
          self.showPlayer(idx, resume);
        }
      }
      
      self._intervalId && clearInterval(self._intervalId);
      self._intervalId = setInterval(updatePositionDisplay, 500);
      updatePositionDisplay();
      
      self._stepTimeoutId = setTimeout(() => {
        step++;
        nextStep();
      }, Math.max(0, stepDuration));
    }
    
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