import { Editor, getDao } from './edit';
import './style.css';
import { getHashParams } from './urlUtil';
import type { IDao } from './dao';
import { signInWithGoogle, signOutUser, onAuthChange } from './auth';
import type { User } from 'firebase/auth';

async function getProjects(dao: IDao): Promise<{ id: string, title: string, lastEditedAt: number, owner: string }[]> {
  const docs = await dao.getAll();
  const projects = docs.map(data => {
    // Handle both TopLevelProject and legacy Project formats
    if (data.project && data.metadata) {
      // TopLevelProject format
      return { 
        id: data.metadata.id, 
        title: data.project.title,
        lastEditedAt: data.metadata.lastEditedAt || Date.now(),
        owner: data.metadata.owner || ''
      };
    } else {
      // Legacy Project format - use current time as fallback
      return { 
        id: data.id, 
        title: data.title,
        lastEditedAt: Date.now(),
        owner: data.owner || ''
      };
    }
  });
  // Sort by lastEditedAt descending (most recent first)
  return projects.sort((a, b) => b.lastEditedAt - a.lastEditedAt);
}

async function renderHome(user: User | null) {
  // Remove edit-mode class to ensure home page is centered
  document.body.classList.remove('edit-mode');
  
  // Get opacity from URL parameter, default to 0 if not specified
  const params = getHashParams();
  const dimOpacity = params.has('opacity') ? params.get('opacity') : '0';
  
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
  const currentUserId = user.uid;
  
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div>
      <div style="position: fixed; top: 16px; right: 16px; z-index: 1000;">
        <button id="new-project">New Project</button>
        <button id="sign-out" style="margin-left: 10px;">Sign Out</button>
      </div>
      <h1>Video Spreadsheet Projects</h1>
      <h2>Saved Projects</h2>
      <ul style="list-style:none; padding:0;">
        ${projects.length === 0 ? '<li>No projects yet.</li>' : projects.map(p => {
          const date = new Date(p.lastEditedAt);
          const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isOwner = p.owner === currentUserId;
          const opacity = isOwner ? '1' : dimOpacity;
          return `<li style="margin-bottom: 8px; opacity: ${opacity};">
            <a href="#id=${p.id}" class="project-link" data-id="${p.id}" style="text-decoration: none; color: #0066cc;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">${p.title}</span>
                <span style="color: #666; font-size: 0.9em; margin-left: 16px;">${dateStr}</span>
              </div>
            </a>
          </li>`;
        }).join('')}
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

