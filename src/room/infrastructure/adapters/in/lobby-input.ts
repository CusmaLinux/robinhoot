import { isUUID } from 'class-validator';
import { LobbyError } from '../../../domain/lobby';

function object(input: unknown, fields: string[]): Record<string, string> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== fields.length ||
    Object.keys(input).some((key) => !fields.includes(key)) ||
    fields.some(
      (key) => typeof (input as Record<string, unknown>)[key] !== 'string',
    )
  ) {
    throw new LobbyError(
      'INVALID_PAYLOAD',
      'Payload must contain exactly the documented string fields',
    );
  }
  return input as Record<string, string>;
}
export function joinInput(payload: unknown) {
  const input = object(payload, ['pin', 'nickname', 'requestId']);
  if (!/^\d{6}$/.test(input.pin) || !isUUID(input.requestId))
    throw new LobbyError(
      'INVALID_PAYLOAD',
      'PIN must be six digits and requestId must be a UUID',
    );
  return {
    pin: input.pin,
    nickname: input.nickname,
    requestId: input.requestId.toLowerCase(),
  };
}
export function hostInput(payload: unknown) {
  const input = object(payload, ['roomId']);
  if (!isUUID(input.roomId))
    throw new LobbyError('INVALID_PAYLOAD', 'roomId must be a UUID');
  return { roomId: input.roomId.toLowerCase() };
}

export function restoreInput(payload: unknown) {
  const input = object(payload, ['roomId', 'credential']);
  if (!isUUID(input.roomId) || !/^[A-Za-z0-9_-]{43}$/.test(input.credential))
    throw new LobbyError(
      'INVALID_PAYLOAD',
      'roomId must be a UUID and credential must be an issued guest secret',
    );
  return { roomId: input.roomId.toLowerCase(), credential: input.credential };
}

export function cancelInput(payload: unknown) {
  const input = object(payload, ['roomId', 'commandId']);
  if (!isUUID(input.roomId) || !isUUID(input.commandId))
    throw new LobbyError(
      'INVALID_PAYLOAD',
      'roomId and commandId must be UUIDs',
    );
  return {
    roomId: input.roomId.toLowerCase(),
    commandId: input.commandId.toLowerCase(),
  };
}

export function startInput(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new LobbyError('INVALID_PAYLOAD', 'Invalid start payload');
  const { expectedRevision, ...command } = payload as Record<string, unknown>;
  const input = cancelInput(command);
  if (
    !Number.isSafeInteger(expectedRevision) ||
    (expectedRevision as number) < 0
  )
    throw new LobbyError(
      'INVALID_PAYLOAD',
      'expectedRevision must be a nonnegative safe integer',
    );
  return { ...input, expectedRevision: expectedRevision as number };
}

export function answerInput(payload: unknown) {
  const input = object(payload, [
    'roomId',
    'questionId',
    'submissionId',
    'optionId',
  ]);
  if (Object.values(input).some((value) => !isUUID(value)))
    throw new LobbyError('INVALID_PAYLOAD', 'Answer identifiers must be UUIDs');
  return {
    roomId: input.roomId.toLowerCase(),
    questionId: input.questionId.toLowerCase(),
    submissionId: input.submissionId.toLowerCase(),
    optionId: input.optionId.toLowerCase(),
  };
}
