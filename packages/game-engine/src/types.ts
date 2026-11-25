export interface GamePlayerSeed {
  userId: string;
  displayName: string;
  seatIndex: number;
}

export type ActionValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string };

export interface ActionApplyResult<TState, TEvent> {
  state: TState;
  events: TEvent[];
}

export interface GamePlayerResult {
  userId: string;
  displayName: string;
  score: number;
  isWinner: boolean;
  roleLabel?: string;
}

export interface GameResultSummary {
  winningTeam: string;
  headline: string;
  players: GamePlayerResult[];
}

export interface GameModule<
  TState,
  TAction,
  TPublicState,
  TPrivateState,
  TDisplayState,
  TEvent,
  TConfig = Record<string, unknown>,
> {
  readonly slug: string;
  readonly title: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  createInitialState(
    players: GamePlayerSeed[],
    config: TConfig,
    rngSeed: number
  ): TState;

  validateAction(
    state: TState,
    playerId: string,
    action: TAction
  ): ActionValidationResult;

  applyAction(
    state: TState,
    playerId: string,
    action: TAction
  ): ActionApplyResult<TState, TEvent>;

  onTurnTimeout(state: TState): ActionApplyResult<TState, TEvent>;

  getPublicState(state: TState): TPublicState;

  getPrivateState(state: TState, playerId: string): TPrivateState;

  getDisplayState(state: TState): TDisplayState;

  isGameCompleted(state: TState): boolean;

  getResults(state: TState): GameResultSummary | null;
}
