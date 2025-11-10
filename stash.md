
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