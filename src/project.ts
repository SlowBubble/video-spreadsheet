export type TextAlignment = 'upper-left' | 'lower-left' | 'upper-right' | 'lower-right' | 'center' | 'lower-center' | 'upper-center';

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
}

export class TextDisplay {
  content: string;
  alignment: TextAlignment;

  constructor(content: string, alignment?: TextAlignment) {
    this.content = content;
    this.alignment = alignment || 'lower-center';
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
    subcommands?: Subcommand[]
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
    if (overlay) {
      this.overlay = overlay;
    }
    if (disabled !== undefined) {
      this.disabled = disabled;
    }
  }
}

export class Project {
  title: string;
  commands: ProjectCommand[];
  shortStartMs?: number;
  shortEndMs?: number;

  constructor(title: string, commands: ProjectCommand[], shortStartMs?: number, shortEndMs?: number) {
    this.title = title;
    this.commands = commands;
    if (shortStartMs !== undefined) this.shortStartMs = shortStartMs;
    if (shortEndMs !== undefined) this.shortEndMs = shortEndMs;
  }

  serialize(): string {
    return JSON.stringify({
      title: this.title,
      commands: this.commands,
      shortStartMs: this.shortStartMs,
      shortEndMs: this.shortEndMs,
    });
  }

  getEnabledCommands(): ProjectCommand[] {
    return this.commands.filter(cmd => !cmd.disabled);
  }

  // TODO see if we should clean this up by having fromJSON for the children classes
  static fromJSON(json: string): Project {
    const data = JSON.parse(json);
    return new Project(data.title, data.commands.map((cmd: any) => {
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
      
      // Parse subcommands
      let subcommands: Subcommand[] = [];
      if (cmd.subcommands && Array.isArray(cmd.subcommands)) {
        subcommands = cmd.subcommands.map((sub: any) => {
          let subOverlay: Overlay | undefined = undefined;
          if (sub.overlay) {
            let fullScreenFilter: FullScreenFilter | undefined = undefined;
            if (sub.overlay.fullScreenFilter) {
              fullScreenFilter = new FullScreenFilter(sub.overlay.fullScreenFilter.fillStyle);
            }
            
            let borderFilter: BorderFilter | undefined = undefined;
            if (sub.overlay.borderFilter) {
              borderFilter = new BorderFilter(
                sub.overlay.borderFilter.topMarginPct,
                sub.overlay.borderFilter.bottomMarginPct,
                sub.overlay.borderFilter.fillStyle
              );
            }
            
            let textDisplay: TextDisplay | undefined = undefined;
            if (sub.overlay.textDisplay) {
              textDisplay = new TextDisplay(
                sub.overlay.textDisplay.content,
                sub.overlay.textDisplay.alignment
              );
            }
            
            if (fullScreenFilter || borderFilter || textDisplay) {
              subOverlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
            }
          }
          return new Subcommand(sub.startMs, sub.endMs, sub.name, subOverlay);
        });
      }
      
      return new ProjectCommand(
        cmd.asset,
        cmd.positionMs,
        cmd.startMs,
        cmd.endMs,
        cmd.volume,
        cmd.speed,
        cmd.name,
        overlay,
        cmd.disabled,
        cmd.extendAudioSec,
        subcommands
      );
    }), data.shortStartMs, data.shortEndMs);
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

  static fromData(data: any, currentUserId?: string): TopLevelProject {
    // Check if data is already a TopLevelProject
    if (data.project && data.metadata) {
      const project = new Project(
        data.project.title,
        data.project.commands.map((cmd: any) => {
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
            
            if (fullScreenFilter || borderFilter || textDisplay) {
              overlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
            }
          }
          
          // Parse subcommands
          let subcommands: Subcommand[] = [];
          if (cmd.subcommands && Array.isArray(cmd.subcommands)) {
            subcommands = cmd.subcommands.map((sub: any) => {
              let subOverlay: Overlay | undefined = undefined;
              if (sub.overlay) {
                let fullScreenFilter: FullScreenFilter | undefined = undefined;
                if (sub.overlay.fullScreenFilter) {
                  fullScreenFilter = new FullScreenFilter(sub.overlay.fullScreenFilter.fillStyle);
                }
                
                let borderFilter: BorderFilter | undefined = undefined;
                if (sub.overlay.borderFilter) {
                  borderFilter = new BorderFilter(
                    sub.overlay.borderFilter.topMarginPct,
                    sub.overlay.borderFilter.bottomMarginPct,
                    sub.overlay.borderFilter.fillStyle
                  );
                }
                
                let textDisplay: TextDisplay | undefined = undefined;
                if (sub.overlay.textDisplay) {
                  textDisplay = new TextDisplay(
                    sub.overlay.textDisplay.content,
                    sub.overlay.textDisplay.alignment
                  );
                }
                
                if (fullScreenFilter || borderFilter || textDisplay) {
                  subOverlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
                }
              }
              return new Subcommand(sub.startMs, sub.endMs, sub.name, subOverlay);
            });
          }
          
          return new ProjectCommand(
            cmd.asset,
            cmd.positionMs,
            cmd.startMs,
            cmd.endMs,
            cmd.volume,
            cmd.speed,
            cmd.name,
            overlay,
            cmd.disabled,
            cmd.extendAudioSec,
            subcommands
          );
        }),
        data.project.shortStartMs,
        data.project.shortEndMs
      );
      const metadata = new Metadata(
        data.metadata.id,
        data.metadata.owner,
        data.metadata.createdAt,
        data.metadata.lastEditedAt
      );
      return new TopLevelProject(project, metadata);
    }
    
    // Legacy format: data is a Project
    const project = new Project(
      data.title,
      data.commands.map((cmd: any) => {
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
          
          if (fullScreenFilter || borderFilter || textDisplay) {
            overlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
          }
        }
        
        // Parse subcommands
        let subcommands: Subcommand[] = [];
        if (cmd.subcommands && Array.isArray(cmd.subcommands)) {
          subcommands = cmd.subcommands.map((sub: any) => {
            let subOverlay: Overlay | undefined = undefined;
            if (sub.overlay) {
              let fullScreenFilter: FullScreenFilter | undefined = undefined;
              if (sub.overlay.fullScreenFilter) {
                fullScreenFilter = new FullScreenFilter(sub.overlay.fullScreenFilter.fillStyle);
              }
              
              let borderFilter: BorderFilter | undefined = undefined;
              if (sub.overlay.borderFilter) {
                borderFilter = new BorderFilter(
                  sub.overlay.borderFilter.topMarginPct,
                  sub.overlay.borderFilter.bottomMarginPct,
                  sub.overlay.borderFilter.fillStyle
                );
              }
              
              let textDisplay: TextDisplay | undefined = undefined;
              if (sub.overlay.textDisplay) {
                textDisplay = new TextDisplay(
                  sub.overlay.textDisplay.content,
                  sub.overlay.textDisplay.alignment
                );
              }
              
              if (fullScreenFilter || borderFilter || textDisplay) {
                subOverlay = new Overlay(fullScreenFilter, borderFilter, textDisplay);
              }
            }
            return new Subcommand(sub.startMs, sub.endMs, sub.name, subOverlay);
          });
        }
        
        return new ProjectCommand(
          cmd.asset,
          cmd.positionMs,
          cmd.startMs,
          cmd.endMs,
          cmd.volume,
          cmd.speed,
          cmd.name,
          overlay,
          cmd.disabled,
          cmd.extendAudioSec,
          subcommands
        );
      }),
      data.shortStartMs,
      data.shortEndMs
    );
    
    // Create metadata for legacy project
    const metadata = new Metadata(
      data.id,
      currentUserId || '',
      Date.now(),
      Date.now()
    );
    
    return new TopLevelProject(project, metadata);
  }
}