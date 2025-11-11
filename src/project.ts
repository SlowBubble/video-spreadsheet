export type TextAlignment = 'upper-left' | 'lower-left' | 'upper-right' | 'lower-right' | 'center';

export class TextDisplay {
  content: string;
  alignment: TextAlignment;

  constructor(content: string, alignment?: TextAlignment) {
    this.content = content;
    this.alignment = alignment || 'lower-left';
  }
}

export class FullScreenFilter {
  fillStyle: string;

  constructor(fillStyle: string) {
    this.fillStyle = fillStyle;
  }
}

export class BorderFilter {
  topMarginPct: number;
  bottomMarginPct: number;
  fillStyle: string;

  constructor(topMarginPct: number, bottomMarginPct: number, fillStyle: string) {
    this.topMarginPct = topMarginPct;
    this.bottomMarginPct = bottomMarginPct;
    this.fillStyle = fillStyle;
  }
}

export class Overlay {
  fullScreenFilter?: FullScreenFilter;
  borderFilter?: BorderFilter;
  textDisplay?: TextDisplay;

  constructor(fullScreenFilter?: FullScreenFilter, borderFilter?: BorderFilter, textDisplay?: TextDisplay) {
    if (fullScreenFilter) this.fullScreenFilter = fullScreenFilter;
    if (borderFilter) this.borderFilter = borderFilter;
    if (textDisplay) this.textDisplay = textDisplay;
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
  overlay?: Overlay;

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
    if (overlay) {
      this.overlay = overlay;
    }
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
      let overlay: Overlay | undefined = undefined;
      if (cmd.overlay) {
        let fullScreenFilter: FullScreenFilter | undefined = undefined;
        if (cmd.overlay.fullScreenFilter) {
          fullScreenFilter = new FullScreenFilter(cmd.overlay.fullScreenFilter.fillStyle);
        }
        
        let borderFilter: BorderFilter | undefined = undefined;
        if (cmd.overlay.borderFilter) {
          borderFilter = new BorderFilter(
            cmd.overlay.borderFilter.topMarginPct,
            cmd.overlay.borderFilter.bottomMarginPct,
            cmd.overlay.borderFilter.fillStyle
          );
        }
        
        let textDisplay: TextDisplay | undefined = undefined;
        if (cmd.overlay.textDisplay) {
          textDisplay = new TextDisplay(
            cmd.overlay.textDisplay.content,
            cmd.overlay.textDisplay.alignment
          );
        }
        
        // Only create overlay if at least one filter/text is present
        if (fullScreenFilter || borderFilter || textDisplay) {
          overlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
        }
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