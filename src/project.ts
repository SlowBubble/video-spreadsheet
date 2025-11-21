export type TextAlignment = 'upper-left' | 'lower-left' | 'upper-right' | 'lower-right' | 'center' | 'lower-center' | 'upper-center';

export class ShortConfig {
  shortStartMs: number;
  shortEndMs: number;
  pctOfFullWidth: number;

  constructor(shortStartMs: number, shortEndMs: number, pctOfFullWidth: number) {
    this.shortStartMs = shortStartMs;
    this.shortEndMs = shortEndMs;
    this.pctOfFullWidth = pctOfFullWidth;
  }

  static fromJSON(data: any): ShortConfig {
    return new ShortConfig(
      data.shortStartMs || 0,
      data.shortEndMs || 60000,
      data.pctOfFullWidth || 60
    );
  }
}

export class Subcommand {
  startMs: number;
  endMs: number;
  name: string;
  overlay?: Overlay;

  constructor(startMs: number, endMs: number, name: string, overlay?: Overlay) {
    this.startMs = startMs;
    this.endMs = endMs;
    this.name = name;
    if (overlay) {
      this.overlay = overlay;
    }
  }

  static fromJSON(data: any): Subcommand {
    const overlay = Overlay.fromJSON(data.overlay);
    return new Subcommand(data.startMs, data.endMs, data.name, overlay);
  }
}

export class TextDisplay {
  content: string;
  alignment: TextAlignment;

  constructor(content: string, alignment?: TextAlignment) {
    this.content = content;
    this.alignment = alignment || 'lower-center';
  }

  static fromJSON(data: any): TextDisplay {
    return new TextDisplay(data.content, data.alignment);
  }
}

export class FullScreenFilter {
  fillStyle: string;

  constructor(fillStyle: string) {
    this.fillStyle = fillStyle;
  }

  static fromJSON(data: any): FullScreenFilter {
    return new FullScreenFilter(data.fillStyle);
  }
}

export class BorderFilter {
  topMarginPct: number;
  bottomMarginPct: number;
  leftMarginPct: number;
  rightMarginPct: number;
  fillStyle: string;

  constructor(topMarginPct: number, bottomMarginPct: number, fillStyle: string, leftMarginPct: number = 0, rightMarginPct: number = 0) {
    this.topMarginPct = topMarginPct;
    this.bottomMarginPct = bottomMarginPct;
    this.leftMarginPct = leftMarginPct;
    this.rightMarginPct = rightMarginPct;
    this.fillStyle = fillStyle;
  }

  static fromJSON(data: any): BorderFilter {
    return new BorderFilter(
      data.topMarginPct,
      data.bottomMarginPct,
      data.fillStyle,
      data.leftMarginPct || 0,
      data.rightMarginPct || 0
    );
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

  static fromJSON(data: any): Overlay | undefined {
    if (!data) return undefined;
    
    const fullScreenFilter = data.fullScreenFilter ? FullScreenFilter.fromJSON(data.fullScreenFilter) : undefined;
    const borderFilter = data.borderFilter ? BorderFilter.fromJSON(data.borderFilter) : undefined;
    const textDisplay = data.textDisplay ? TextDisplay.fromJSON(data.textDisplay) : undefined;
    
    if (fullScreenFilter || borderFilter || textDisplay) {
      return new Overlay(fullScreenFilter, borderFilter, textDisplay);
    }
    return undefined;
  }
}

export class ProjectCommand {
  id: number;
  asset: string;
  positionMs: number;
  startMs: number;
  endMs: number;
  volume: number;
  speed: number;
  name: string;
  overlay?: Overlay;
  disabled?: boolean;
  extendAudioSec: number;
  subcommands: Subcommand[];

  constructor(
    asset: string,
    positionMs: number,
    startMs: number,
    endMs: number,
    volume?: number,
    speed?: number,
    name?: string,
    overlay?: Overlay,
    disabled?: boolean,
    extendAudioSec?: number,
    subcommands?: Subcommand[],
    id?: number
  ) {
    this.asset = asset;
    this.positionMs = positionMs;
    this.startMs = startMs;
    this.endMs = endMs;
    this.volume = volume !== undefined && volume >= 0 ? volume : 100;
    this.speed = speed !== undefined && speed > 0 ? speed : 1;
    this.name = name || '';
    this.extendAudioSec = extendAudioSec !== undefined && extendAudioSec >= 0 ? extendAudioSec : 0;
    this.subcommands = subcommands || [];
    this.id = id || 0; // Will be assigned by Project.ensureCommandIds()
    if (overlay) {
      this.overlay = overlay;
    }
    if (disabled !== undefined) {
      this.disabled = disabled;
    }
  }

  static fromJSON(data: any): ProjectCommand {
    const overlay = Overlay.fromJSON(data.overlay);
    const subcommands = data.subcommands && Array.isArray(data.subcommands)
      ? data.subcommands.map((sub: any) => Subcommand.fromJSON(sub))
      : [];
    
    return new ProjectCommand(
      data.asset,
      data.positionMs,
      data.startMs,
      data.endMs,
      data.volume,
      data.speed,
      data.name,
      overlay,
      data.disabled,
      data.extendAudioSec,
      subcommands,
      data.id
    );
  }
}

export class Project {
  title: string;
  commands: ProjectCommand[];
  shortStartMs?: number;
  shortEndMs?: number;
  shortConfig?: ShortConfig;

  constructor(title: string, commands: ProjectCommand[], shortStartMs?: number, shortEndMs?: number, shortConfig?: ShortConfig) {
    this.title = title;
    this.commands = commands;
    if (shortStartMs !== undefined) this.shortStartMs = shortStartMs;
    if (shortEndMs !== undefined) this.shortEndMs = shortEndMs;
    if (shortConfig) this.shortConfig = shortConfig;
    this.ensureCommandIds();
  }

  serialize(): string {
    return JSON.stringify({
      title: this.title,
      commands: this.commands,
      shortStartMs: this.shortStartMs,
      shortEndMs: this.shortEndMs,
      shortConfig: this.shortConfig,
    });
  }

  getEnabledCommands(): ProjectCommand[] {
    return this.commands.filter(cmd => !cmd.disabled);
  }

  // Ensure all commands have unique IDs
  ensureCommandIds(): void {
    // Find the highest existing ID
    let maxId = 0;
    this.commands.forEach(cmd => {
      if (cmd.id > 0) {
        maxId = Math.max(maxId, cmd.id);
      }
    });

    // Assign IDs to commands that don't have one (id === 0)
    this.commands.forEach(cmd => {
      if (!cmd.id || cmd.id === 0) {
        maxId++;
        cmd.id = maxId;
      }
    });
  }

  static fromJSONString(json: string): Project {
    const data = JSON.parse(json);
    return Project.fromJSON(data);
  }

  static fromJSON(data: any): Project {
    const commands = data.commands.map((cmd: any) => ProjectCommand.fromJSON(cmd));
    
    // TODO: Remove this migration code once data is migrated
    // Migrate old shortStartMs/shortEndMs to shortConfig if shortConfig doesn't exist
    let shortConfig: ShortConfig | undefined = undefined;
    if (data.shortConfig) {
      shortConfig = ShortConfig.fromJSON(data.shortConfig);
    } else if (data.shortStartMs !== undefined && data.shortEndMs !== undefined) {
      // Migrate old fields to new ShortConfig
      shortConfig = new ShortConfig(data.shortStartMs, data.shortEndMs, 60);
    }
    
    return new Project(data.title, commands, data.shortStartMs, data.shortEndMs, shortConfig);
  }
}

export class Metadata {
  id: string;
  owner: string;
  createdAt: number;
  lastEditedAt: number;

  constructor(id: string, owner: string, createdAt?: number, lastEditedAt?: number) {
    this.id = id;
    this.owner = owner;
    this.createdAt = createdAt || Date.now();
    this.lastEditedAt = lastEditedAt || Date.now();
  }
}

export class TopLevelProject {
  project: Project;
  metadata: Metadata;

  constructor(project: Project, metadata: Metadata) {
    this.project = project;
    this.metadata = metadata;
  }

  serialize(): string {
    return JSON.stringify({
      project: this.project,
      metadata: this.metadata,
    });
  }

  static fromJSON(data: any): TopLevelProject {
    if (!data.project || !data.metadata) {
      throw new Error('Invalid project data format');
    }

    const project = Project.fromJSON(data.project);
    const metadata = new Metadata(
      data.metadata.id,
      data.metadata.owner,
      data.metadata.createdAt,
      data.metadata.lastEditedAt
    );
    
    return new TopLevelProject(project, metadata);
  }
}