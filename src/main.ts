import './style.css';

function getProjects(): { id: string, title: string }[] {
  const projects: { id: string, title: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('project-')) {
      try {
        const data = JSON.parse(localStorage.getItem(key)!);
        projects.push({ id: data.id, title: data.title });
      } catch {}
    }
  }
  return projects.sort((a, b) => b.id.localeCompare(a.id));
}

function renderHome() {
  const projects = getProjects();
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div>
      <h1>Video Spreadsheet Projects</h1>
      <button id="new-project">New Project</button>
      <h2>Saved Projects</h2>
      <ul style="list-style:none; padding:0;">
        ${projects.length === 0 ? '<li>No projects yet.</li>' : projects.map(p => `<li><a href="#id=${p.id}" class="project-link" data-id="${p.id}">${p.title}</a></li>`).join('')}
      </ul>
    </div>
  `;
  document.getElementById('new-project')!.onclick = () => {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    window.location.hash = `id=${ts}`;
    window.location.reload();
  };
  document.querySelectorAll('.project-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id) {
        window.location.hash = `id=${id}`;
        window.location.reload();
      }
    });
  });
}

function main() {
  if (window.location.hash.startsWith('#id=')) {
    import('./edit');
    return;
  }
  renderHome();
}

main();

window.addEventListener('hashchange', () => {
  main();
});

