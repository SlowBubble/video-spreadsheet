export function getShortcutsModalHtml(): string {
  return `
    <div id="shortcuts-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 8px; max-width: 500px; width: 90%;">
        <h2 style="margin-top: 0;">Keyboard Shortcuts</h2>
        <div style="max-height: 60vh; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td colspan="2" style="padding: 8px 8px 4px 8px; font-weight: bold; background: #f0f0f0;">Navigation</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Arrow Keys</strong></td><td style="padding: 4px 8px;">Navigate cells</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Tab / Shift+Tab</strong></td><td style="padding: 4px 8px;">Move right / left</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Enter</strong></td><td style="padding: 4px 8px;">Edit cell</td></tr>
            
            <tr><td colspan="2" style="padding: 8px 8px 4px 8px; font-weight: bold; background: #f0f0f0;">Playback</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Space / K</strong></td><td style="padding: 4px 8px;">Start/stop replay</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>0</strong></td><td style="padding: 4px 8px;">Restart from beginning</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>1-9</strong></td><td style="padding: 4px 8px;">Jump to 10%-90% of timeline</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>J</strong></td><td style="padding: 4px 8px;">Rewind 3 seconds</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>L</strong></td><td style="padding: 4px 8px;">Fast forward 3 seconds</td></tr>
            
            <tr><td colspan="2" style="padding: 8px 8px 4px 8px; font-weight: bold; background: #f0f0f0;">Editing</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+C / Cmd+V</strong></td><td style="padding: 4px 8px;">Copy / paste cell</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+Z / Cmd+Shift+Z</strong></td><td style="padding: 4px 8px;">Undo / redo</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Backspace / Cmd+X</strong></td><td style="padding: 4px 8px;">Delete row</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+Backspace</strong></td><td style="padding: 4px 8px;">Delete row</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Alt+Up / Alt+Down</strong></td><td style="padding: 4px 8px;">Move row up / down</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Alt+Left / Alt+Right</strong></td><td style="padding: 4px 8px;">Adjust time -/+ 0.5s (or cycle Vol/Speed)</td></tr>
            
            <tr><td colspan="2" style="padding: 8px 8px 4px 8px; font-weight: bold; background: #f0f0f0;">Filters & Effects</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>F</strong></td><td style="padding: 4px 8px;">Cycle fullscreen filter</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>B</strong></td><td style="padding: 4px 8px;">Toggle border filter</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>A</strong></td><td style="padding: 4px 8px;">Toggle text alignment</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>T</strong></td><td style="padding: 4px 8px;">Tether to previous row</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>P</strong></td><td style="padding: 4px 8px;">Toggle time precision</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>[ / ]</strong></td><td style="padding: 4px 8px;">Extend audio -/+ 1s</td></tr>
            
            <tr><td colspan="2" style="padding: 8px 8px 4px 8px; font-weight: bold; background: #f0f0f0;">Project</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+S</strong></td><td style="padding: 4px 8px;">Save project</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+Shift+S</strong></td><td style="padding: 4px 8px;">Clone project</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>Cmd+Shift+Backspace</strong></td><td style="padding: 4px 8px;">Delete project</td></tr>
            <tr><td style="padding: 4px 8px;"><strong>X</strong></td><td style="padding: 4px 8px;">Export/import project</td></tr>
          </table>
        </div>
        <button id="close-modal-btn" style="margin-top: 16px; padding: 8px 16px; cursor: pointer;">Close</button>
      </div>
    </div>
  `;
}

export function setupShortcutsModal(): void {
  const shortcutsBtn = document.getElementById('shortcuts-btn');
  const modal = document.getElementById('shortcuts-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  
  if (shortcutsBtn && modal) {
    shortcutsBtn.onclick = () => {
      modal.style.display = 'block';
    };
  }
  
  if (closeModalBtn && modal) {
    closeModalBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    };
  }
}
