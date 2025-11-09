export class FullScreenFilter {
  fillStyle: string;

  constructor(fillStyle: string) {
    this.fillStyle = fillStyle;
  }
}

export class Overlay {
  fullScreenFilter: FullScreenFilter | null;

  constructor(fullScreenFilter?: FullScreenFilter | null) {
    this.fullScreenFilter = fullScreenFilter || null;
  }
}

export class ProjectCommand {
  asset: string;
  positionMs: number;
  startMs: number;
  endMs: number;
  volume: number;
  speed: number;
  name: string;
  overlay: Overlay;

  constructor(
    asset: string,
    positionMs: number,
    startMs: number,
    endMs: number,
    volume?: number,
    speed?: number,
    name?: string,
    overlay?: Overlay
  ) {
    this.asset = asset;
    this.positionMs = positionMs;
    this.startMs = startMs;
    this.endMs = endMs;
    this.volume = volume !== undefined && volume >= 0 ? volume : 100;
    this.speed = speed !== undefined && speed > 0 ? speed : 1;
    this.name = name || '';
    this.overlay = overlay || new Overlay();
  }
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

  static fromJSON(json: string): Project {
    const data = JSON.parse(json);
    return new Project(data.title, data.id, data.commands.map((cmd: any) => {
      let overlay = new Overlay();
      if (cmd.overlay) {
        let fullScreenFilter = null;
        if (cmd.overlay.fullScreenFilter) {
          fullScreenFilter = new FullScreenFilter(cmd.overlay.fullScreenFilter.fillStyle);
        }
        // Support legacy borderFilter field
        if (cmd.overlay.borderFilter) {
          fullScreenFilter = new FullScreenFilter(cmd.overlay.borderFilter.fillStyle);
        }
        overlay = new Overlay(fullScreenFilter);
      }
      return new ProjectCommand(
        cmd.asset,
        cmd.positionMs,
        cmd.startMs,
        cmd.endMs,
        cmd.volume,
        cmd.speed,
        cmd.name,
        overlay
      );
    }));
  }
}