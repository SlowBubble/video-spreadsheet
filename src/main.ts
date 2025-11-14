import { Editor, getDao } from './edit';
import './style.css';
import { getHashParams } from './urlUtil';
import type { IDao } from './dao';
import { signInWithGoogle, signOutUser, onAuthChange } from './auth';
import type { User } from 'firebase/auth';

async function getProjects(dao: IDao): Promise<{ id: string, title: string }[]> {
  const docs = await dao.getAll();
  const projects = docs.map(data => {
    // Handle both TopLevelProject and legacy Project formats
    if (data.project && data.metadata) {
      // TopLevelProject format
      return { id: data.metadata.id, title: data.project.title };
    } else {
      // Legacy Project format
      return { id: data.id, title: data.title };
    }
  });
  return projects.sort((a, b) => b.id.localeCompare(a.id));
}

async function renderHome(user: User | null) {
  if (!user) {
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h1>Video Spreadsheet Projects</h1>
        <button id="sign-in">Sign in with Google</button>
      </div>
    `;
    const signInBtn = document.getElementById('sign-in');
    if (signInBtn) {
      signInBtn.onclick = async () => {
        await signInWithGoogle();
      };
    }
    return;
  }
  const dao = getDao();
  const projects = await getProjects(dao);
  
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div>
      <h1>Video Spreadsheet Projects</h1>
       <button id="new-project">New Project</button>
       <button id="sign-out" style="margin-left: 10px;">Sign Out</button>
      <h2>Saved Projects</h2>
      <ul style="list-style:none; padding:0;">
        ${projects.length === 0 ? '<li>No projects yet.</li>' : projects.map(p => `<li><a href="#id=${p.id}" class="project-link" data-id="${p.id}">${p.title}</a></li>`).join('')}
      </ul>
    </div>
  `;
  
  
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

