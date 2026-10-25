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
