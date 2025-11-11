export function getShortcutsModalHtml(): string {
  return `
    <div id="shortcuts-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 8px; max-width: 500px; width: 90%;">
        <h2 style="margin-top: 0;">Keyboard Shortcuts</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 4px 8px;"><strong>Arrow Keys</strong></td><td style="padding: 4px 8px;">Navigate cells</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Tab / Shift+Tab</strong></td><td style="padding: 4px 8px;">Move right / left</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Enter</strong></td><td style="padding: 4px 8px;">Edit cell</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Cmd+S</strong></td><td style="padding: 4px 8px;">Save project</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Cmd+Shift+S</strong></td><td style="padding: 4px 8px;">Clone project</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Cmd+Backspace</strong></td><td style="padding: 4px 8px;">Delete project</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>Space</strong></td><td style="padding: 4px 8px;">Start/stop replay</td></tr>
          <tr><td style="padding: 4px 8px;"><strong>X</strong></td><td style="padding: 4px 8px;">Export/import project</td></tr>
        </table>
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
