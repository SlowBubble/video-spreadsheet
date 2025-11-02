import { Project } from './project';

// Helper to extract YouTube video ID from a URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu.be\/|embed\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function getProjectIdFromHash(): string | null {
  if (window.location.hash.startsWith('#id=')) {
    return window.location.hash.replace('#id=', '');
  }
  return null;
}

function loadProject(id: string): Project | null {
  const json = localStorage.getItem('project-' + id);
  if (json) {
    return Project.fromJSON(json);
  }
  return null;
}

function playCommands(project: Project) {
  if (!project || !project.commands.length) {
    document.body.innerHTML = '<h2>No commands to replay.</h2>';
    return;
  }
  // Sort commands by positionMs
  const commands = [...project.commands].sort((a, b) => a.positionMs - b.positionMs);
  document.body.innerHTML = '<div id="replay-msg" style="text-align:center; margin-bottom:8px; font-size:1.1em; color:#666;">Press <b>space</b> to start the replay.</div>';
  // Create a container for iframes
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = '1280px';
  container.style.height = '720px';
  container.style.margin = '0 auto';
  document.body.appendChild(container);

  // Preload all iframes (visible, but only the first is shown, others hidden)
  const iframes: HTMLIFrameElement[] = commands.map((cmd, idx) => {
    const ytId = getYouTubeId(cmd.asset);
    const startSec = Math.floor(cmd.startMs / 1000);
    const endSec = Math.floor(cmd.endMs / 1000);
    const iframe = document.createElement('iframe');
    iframe.width = '480';
    iframe.height = '854';
    iframe.style.border = 'none';
    iframe.style.display = 'none';
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    if (ytId) {
      // Load the iframe with the video (no autoplay)
      iframe.src = `https://www.youtube.com/embed/${ytId}?start=${startSec}&end=${endSec}&controls=0&modestbranding=1&rel=0`;
    } else {
      iframe.src = '';
    }
    container.appendChild(iframe);
    return iframe;
  });

  // Show the first iframe (paused, not autoplaying) for preview
  if (iframes.length > 0) {
    iframes[0].style.display = 'block';
  }

  let started = false;
  let timeouts: number[] = [];

  function clearAllTimeouts() {
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
  }

  function showIframe(idx: number) {
    iframes.forEach((iframe, i) => {
      iframe.style.display = i === idx ? 'block' : 'none';
      if (i === idx) {
        // Force reload with autoplay=1
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
    timeouts.push(window.setTimeout(() => {
      playCommand(idx + 1);
    }, Math.max(0, duration)));
  }

  function startReplay() {
    if (started) return;
    started = true;
    document.getElementById('replay-msg')!.textContent = 'Replaying...';
    clearAllTimeouts();
    // Hide all iframes first
    iframes.forEach(iframe => (iframe.style.display = 'none'));
    // Schedule each command based on positionMs
    commands.forEach((cmd, idx) => {
      timeouts.push(window.setTimeout(() => {
        playCommand(idx);
      }, Math.max(0, cmd.positionMs - commands[0].positionMs)));
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      startReplay();
    }
  }
  window.addEventListener('keydown', onKeydown);
}

window.onload = () => {
  const id = getProjectIdFromHash();
  if (!id) {
    document.body.innerHTML = '<h2>No project id specified.</h2>';
    return;
  }
  const project = loadProject(id);
  if (!project) {
    document.body.innerHTML = '<h2>Project not found.</h2>';
    return;
  }
  playCommands(project);
};
