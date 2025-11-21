// Quick test to verify subcommand ID assignment
import { Project, ProjectCommand, Subcommand } from './src/project';

// Create a project with commands and subcommands
const cmd1 = new ProjectCommand('video1.mp4', 0, 0, 5000, 100, 100, 'Command 1');
const cmd2 = new ProjectCommand('video2.mp4', 5000, 0, 3000, 100, 100, 'Command 2');

// Add subcommands to cmd1
cmd1.subcommands.push(new Subcommand(1000, 2000, 'Subcommand 1-1'));
cmd1.subcommands.push(new Subcommand(2000, 3000, 'Subcommand 1-2'));

// Add subcommands to cmd2
cmd2.subcommands.push(new Subcommand(500, 1500, 'Subcommand 2-1'));

const project = new Project('Test Project', [cmd1, cmd2]);

// Check IDs
console.log('Command 1 ID:', cmd1.id);
console.log('Command 2 ID:', cmd2.id);
console.log('Subcommand 1-1 ID:', cmd1.subcommands[0].id);
console.log('Subcommand 1-2 ID:', cmd1.subcommands[1].id);
console.log('Subcommand 2-1 ID:', cmd2.subcommands[0].id);

// Verify all IDs are unique
const allIds = [
  cmd1.id,
  cmd2.id,
  cmd1.subcommands[0].id,
  cmd1.subcommands[1].id,
  cmd2.subcommands[0].id
];

const uniqueIds = new Set(allIds);
console.log('\nAll IDs:', allIds);
console.log('Unique IDs:', Array.from(uniqueIds));
console.log('All IDs are unique:', allIds.length === uniqueIds.size);
console.log('All IDs are positive:', allIds.every(id => id > 0));
