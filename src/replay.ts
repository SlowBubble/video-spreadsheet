import { Project } from './project';

export class ReplayManager {
  players: any[] = [];
  commands: any[] = [];
  blackDiv: HTMLDivElement | null = null;
  container: HTMLDivElement | null = null;

  constructor(replayDiv: HTMLDivElement, projectId: string, projectTitle: string, tableData: string[][], getYouTubeId: (url: string) => string | null) {
    replayDiv.innerHTML = '';
    const proj = Project.deserializeFromSpreadsheet(
      projectId,
      projectTitle,
      tableData
    );
    if (!proj.commands.length) return;
    const commands = [...proj.commands].sort((a, b) => a.positionMs - b.positionMs);
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
                event.target.seekTo(startSec);
                event.target.pauseVideo();
                event.target.setVolume(typeof cmd.volume === 'number' ? cmd.volume : 100);
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
    const points: number[] = [];
    cmds.forEach((cmd: any) => {
      const a = cmd.positionMs;
      const b = cmd.positionMs + (cmd.endMs - cmd.startMs);
      points.push(a, b);
    });
    // Remove duplicates and sort
    const uniquePoints = Array.from(new Set(points)).sort((a, b) => a - b);
    const plan: { start: number, end: number, idx: number, resume: boolean }[] = [];
    let prevIdx = -1;
    let lastVisible: { [idx: number]: number } = {};
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const c = uniquePoints[i];
      let idx = -1;
      for (let j = cmds.length - 1; j >= 0; j--) {
        const a = cmds[j].positionMs;
        const b = cmds[j].positionMs + (cmds[j].endMs - cmds[j].startMs);
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
      prevIdx = idx;
    }
    // For the last change point, show black screen
    plan.push({ start: uniquePoints[uniquePoints.length - 1], end: uniquePoints[uniquePoints.length - 1] + 1000, idx: -1, resume: false });
    return plan;
  }

  startReplay() {
    const players = this.players;
    const commands = this.commands;
    const blackDiv = this.blackDiv;
    if (!players || !commands || !blackDiv) return;
    const plan = this.generateReplayPlan();
    console.log(JSON.stringify(plan));
    function showPlayer(idx: number, resume: boolean) {
      players.forEach((player, i) => {
        const div = document.getElementById(`yt-player-edit-${i}`);
        if (div) div.style.display = i === idx ? 'block' : 'none';
        if (i === idx && player) {
          if (!resume) {
            const cmd = commands[i];
            const startSec = Math.floor(cmd.startMs / 1000);
            player.seekTo(startSec);
            player.setVolume(typeof cmd.volume === 'number' ? cmd.volume : 100);
            player.playVideo();
          }
          // If resume, just show the iframe, let it keep playing
        }
      });
    }
    function hideAllPlayers() {
      players.forEach((player, idx) => {
        const div = document.getElementById(`yt-player-edit-${idx}`);
        if (div) div.style.display = 'none';
        if (player) player.pauseVideo();
      });
    }
    // Execute plan
    let step = 0;
    function nextStep() {
      if (step >= plan.length) {
        hideAllPlayers();
        if (blackDiv) blackDiv.style.display = 'block';
        return;
      }
      const { start, end, idx, resume } = plan[step];
      if (blackDiv) blackDiv.style.display = idx === -1 ? 'block' : 'none';
      if (idx !== -1) showPlayer(idx, resume);
      setTimeout(() => {
        step++;
        nextStep();
      }, Math.max(0, end - start));
    }
    hideAllPlayers();
    if (blackDiv) blackDiv.style.display = 'block';
    if (plan.length > 0) {
      setTimeout(() => {
        nextStep();
      }, Math.max(0, plan[0].start));
    }
  }
}