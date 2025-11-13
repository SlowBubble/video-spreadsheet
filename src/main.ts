import { Editor, getDao } from './edit';
import './style.css';
import { getHashParams } from './urlUtil';
import type { IDao } from './dao';
import { signInWithGoogle, signOutUser, onAuthChange } from './auth';
import type { User } from 'firebase/auth';

async function getProjects(dao: IDao): Promise<{ id: string, title: string }[]> {
  const docs = await dao.getAll();
  const projects = docs.map(data => ({ id: data.id, title: data.title }));
  return projects.sort((a, b) => b.id.localeCompare(a.id));
}

async function renderHome(user: User | null) {
  const dao = getDao();
  const projects = await getProjects(dao);
  
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = 
    user ? `
    <div>
      <h1>Video Spreadsheet Projects</h1>
       <div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
        <button id="sign-out" style="margin-left: 10px;">Sign Out</button>
      </div>
      <button id="new-project">New Project</button>
      <h2>Saved Projects</h2>
      <ul style="list-style:none; padding:0;">
        ${projects.length === 0 ? '<li>No projects yet.</li>' : projects.map(p => `<li><a href="#id=${p.id}" class="project-link" data-id="${p.id}">${p.title}</a></li>`).join('')}
      </ul>
    </div>
  ` : `
    <div style="margin-bottom: 20px;">
      <h1>Video Spreadsheet Projects</h1>
      <button id="sign-in">Sign in with Google</button>
    </div>
  `;
  
  // Auth button handlers
  const signInBtn = document.getElementById('sign-in');
  if (signInBtn) {
    signInBtn.onclick = async () => {
      await signInWithGoogle();
    };
  }
  
  const signOutBtn = document.getElementById('sign-out');
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await signOutUser();
    };
  }
  
  // Project buttons
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
  const params = getHashParams();
  if (params.has('id')) {
    new Editor();
    return;
  }
  
  // Set up auth state listener for home page
  onAuthChange((user) => {
    renderHome(user);
  });
}

main();

window.addEventListener('hashchange', () => {
  main();
});

