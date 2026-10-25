import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import type { WsExceptionFilter } from '@nestjs/common';
import { LobbyError } from '../../../domain/lobby';

@Catch()
export class LobbyWsExceptionFilter implements WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const error =
      exception instanceof LobbyError
        ? { code: exception.code, message: exception.message }
        : exception instanceof HttpException && exception.getStatus() === 401
          ? { code: 'UNAUTHORIZED', message: 'Unauthorized' }
          : {
              code: 'INTERNAL_ERROR',
              message: 'Unable to process lobby event',
            };
    const ack: unknown = host.getArgByIndex(2);
    if (typeof ack === 'function')
      (ack as (value: unknown) => void)({ ok: false, error });
  }
}
