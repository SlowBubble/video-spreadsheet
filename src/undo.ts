export class UndoManager {
  private pastStates: string[] = [];
  private currentState: string;
  private futureStates: string[] = [];

  constructor(initialState: string) {
    this.currentState = initialState;
  }

  hasChanged(currJsonString: string): boolean {
    return this.currentState !== currJsonString;
  }

  updateIfChanged(currentJsonString: string): void {
    if (this.hasChanged(currentJsonString)) {
      // Push current state to past
      this.pastStates.push(this.currentState);
      // Update current state
      this.currentState = currentJsonString;
      // Clear future states since we're creating a new branch
      this.futureStates = [];
    }
  }

  canUndo(): boolean {
    return this.pastStates.length > 0;
  }

  canRedo(): boolean {
    return this.futureStates.length > 0;
  }

  undo(): void {
    if (!this.canUndo()) return;
    
    // Move current state to future
    this.futureStates.push(this.currentState);
    // Pop from past and make it current
    this.currentState = this.pastStates.pop()!;
  }

  redo(): void {
    if (!this.canRedo()) return;
    
    // Move current state to past
    this.pastStates.push(this.currentState);
    // Pop from future and make it current
    this.currentState = this.futureStates.pop()!;
  }

  getCurrentState(): string {
    return this.currentState;
  }
}
