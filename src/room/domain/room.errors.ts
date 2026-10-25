export class QuizNotFoundError extends Error {}
export class PinAllocationError extends Error {
  constructor() {
    super('Unable to allocate a room PIN; retry this request');
  }
}
export class CreationRequestConflictError extends Error {
  constructor() {
    super('Request ID was already used for another quiz');
  }
}
export class ActiveRoomError extends Error {
  constructor() {
    super('Owner already has an active room');
  }
}

export class QuizNotHostableError extends Error {
  constructor(
    readonly fields: readonly {
      field: string;
      code: string;
      message: string;
    }[],
  ) {
    super('Quiz is not hostable');
  }
}
