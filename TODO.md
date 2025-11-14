

# Wishlist

P1:
- Increase the load length by 1 second on the left for smoother loading
- Increase the load length by 5 seconds on the right to extend the audio a little
  - If so, need to include pause in the Plan Action

P2:
- Design subcommands
  - Add a subcommands field to the ProjectCommand class which will have type (ProjectCommand[] vs Subcommand[]) and default to an empty list.
    - Think about the use case before deciding; see `Other subcommands`
  - Press `shift+enter` on a row will add a subcommand to the command.
- Other subcommands
  - slow-mo a certain segment
  - silence a certain segment
  - skip a certain segment
  - pause a certain segment  (may need to slo-mo and repeat instead due to unwanted recommendations showing up)
  - Add text
  - Add arrow or box at a certain location
  - Add filter (likely the full segment)
  - Zooming in may be hard
    - Instead, put a border around to block stuff

P2:
Given that all assets are online, decide wether to make an online version.

Pros:
- Can edit with different computers, even different domains (do I need to do that?)
- Backup in case my computer is fried.

Cons:
- Work and maintenance
  - Idea: Just allowlist my own emails to edit anything.
- Have to deal with sign-in.

Possible design:
- Integrate with firebase
  - Have a private param to show a private homepage that list all my projects (it's not sensitive data so I won't need to use ACL).

P3:
- Present mode
  - warm up all the assets
  - display the first YT player's screen
- Use a slidebar for position

# Failed

P3:
- volume fade-out to be too laggy
  
- If the volume is > 0 and < 100, implement volume fade out in the final second, by turning down linearly every 0.2 second.

```
    // Step 4: Add volume fade-out actions for commands with volume > 0 and < 100
    cmds.forEach((cmd: any, cmdIdx: number) => {
      if (cmd.volume > 0 && cmd.volume < 100) {
        const startTime = cmd.positionMs;
        const videoDuration = cmd.endMs - cmd.startMs;
        const rate = speedToRate(cmd.speed);
        const actualDuration = videoDuration / rate;
        const endTime = startTime + actualDuration;
        
        // Generate 3 volume update actions in the final 1500ms
        const fadeStartTime = endTime - 1000;
        const fadeInterval = 500; // Every 0.5 seconds
        const steps = 1;
        const volumeDecrement = cmd.volume / steps;
        
        for (let step = 1; step <= steps; step++) {
          const actionTime = fadeStartTime + (step - 1) * fadeInterval;
          const newVolume = Math.floor(Math.max(0, cmd.volume - (volumeDecrement * step)));
          const assetName = this.getCommandName(cmdIdx);
          
          plan.push(new PlanAction(
            actionTime,
            actionTime + fadeInterval,
            cmdIdx,
            false, // Don't restart
            false, // Don't change visibility
            assetName,
            undefined, // No overlay change
            newVolume // Update volume
          ));
        }
      }
    });
    
    // Sort plan by start time
    plan.sort((a, b) => a.start - b.start);
```

```
        // Update volume if specified in the action
        if (action.updateVolume !== undefined && player) {
          player.setVolume(action.updateVolume);
        }
        // Update volume if specified in the action
        if (action.updateVolume !== undefined && player) {
          player.setVolume(action.updateVolume);
        }
```