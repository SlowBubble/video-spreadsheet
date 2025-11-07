export type ProjectCommand = {
  asset: string;
  positionMs: number;
  startMs: number;
  endMs: number;
  volume?: number;
};

// Translate a timeString that can look like 1:23 to 60 * 1 + 23
// Similarly 1:2:3 is 60*60*1+60*2+3
// Also make it work for " " instead of colon as the delimiter
function timeStringToMs(str: string): number {
  if (!str) return 0;
  // Allow both ':' and ' ' as delimiters
  const parts = str.trim().split(/[: ]/).map(Number).filter(n => !isNaN(n));
  if (parts.length === 0) return 0;
  let total = 0;
  let multiplier = 1;
  for (let i = parts.length - 1; i >= 0; i--) {
    total += parts[i] * multiplier;
    multiplier *= 60;
  }
  return total * 1000;
}

export class Project {
  title: string;
  id: string;
  commands: ProjectCommand[];

  constructor(title: string, id: string, commands: ProjectCommand[]) {
    this.title = title;
    this.id = id;
    this.commands = commands;
  }

  serialize(): string {
    return JSON.stringify({
      title: this.title,
      id: this.id,
      commands: this.commands,
    });
  }

  static deserializeFromSpreadsheet(id: string, title: string, tableData: string[][]): Project {
    const commands: ProjectCommand[] = tableData.filter(row => row.some(cell => cell.trim() !== ''))
      .map(row => {
        // Extract start time from position column (format: "0:00-1:12" or just "0:00")
        const positionStr = row[1] || '';
        const positionStartTime = positionStr.split('-')[0].trim();
        
        return {
          asset: row[0] || '',
          positionMs: timeStringToMs(positionStartTime) || 0,
          startMs: timeStringToMs(row[2]) || 0,
          endMs: timeStringToMs(row[3]) || 0,
          volume: row[4] !== undefined ? Number(row[4]) : 100,
        };
      });
    return new Project(title, id, commands);
  }

  static fromJSON(json: string): Project {
    const data = JSON.parse(json);
    return new Project(data.title, data.id, (data.commands as ProjectCommand[]).map(cmd => ({
      ...cmd,
      volume: cmd.volume ?? 100,
    })));
  }
}