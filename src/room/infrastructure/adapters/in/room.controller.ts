import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Inject,
  NotFoundException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import type { CurrentUserData } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import { CREATE_ROOM_USE_CASE_PORT } from '../../../application/ports/in/create-room.use-case';
import type { CreateRoomUseCasePort } from '../../../application/ports/in/create-room.use-case';
import { CreateRoomDto } from './create-room.dto';
import { RoomMetadataDto } from './room-response.dto';
import {
  CREATE_ROOM_EXAMPLE,
  ROOM_CREATED_EXAMPLE,
  ROOM_NOT_HOSTABLE_EXAMPLE,
  ROOM_NOT_FOUND_EXAMPLE,
  ROOM_ACTIVE_EXAMPLE,
  ROOM_REQUEST_CONFLICT_EXAMPLE,
  ROOM_PIN_EXHAUSTED_EXAMPLE,
} from './room-api.examples';
import {
  ActiveRoomError,
  CreationRequestConflictError,
  PinAllocationError,
  QuizNotFoundError,
  QuizNotHostableError,
} from '../../../domain/room.errors';

@ApiTags('rooms')
@ApiBearerAuth()
@ApiExtraModels(CreateRoomDto, RoomMetadataDto)
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired, or revoked account credential',
  schema: {
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    },
  },
})
@Controller('rooms')
export class RoomController {
  constructor(
    @Inject(CREATE_ROOM_USE_CASE_PORT)
    private readonly creation: CreateRoomUseCasePort,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create one owned room from a hostable immutable quiz snapshot',
    description:
      'Use the same requestId and quizId to recover the same 201 response while the room exists. Host identity is bound privately to the authenticated account. A PIN grants no host authority. Live rooms and receipts are process-local.',
  })
  @ApiBody({
    type: CreateRoomDto,
    examples: { create: { value: CREATE_ROOM_EXAMPLE } },
  })
  @ApiCreatedResponse({
    description: 'Safe room metadata, including on an identical retry',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(RoomMetadataDto) },
        example: ROOM_CREATED_EXAMPLE,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid UUIDs, missing/unknown fields, malformed body, or incomplete quiz',
    content: {
      'application/json': {
        examples: {
          incomplete: { value: ROOM_NOT_HOSTABLE_EXAMPLE },
          malformed: {
            value: {
              statusCode: 400,
              message: ['quizId must be a UUID'],
              error: 'Bad Request',
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Missing or foreign quiz, including for admins',
    schema: { example: ROOM_NOT_FOUND_EXAMPLE },
  })
  @ApiConflictResponse({
    description:
      'Another active room or request ID reused for a different quiz',
    content: {
      'application/json': {
        examples: {
          activeRoom: { value: ROOM_ACTIVE_EXAMPLE },
          requestConflict: { value: ROOM_REQUEST_CONFLICT_EXAMPLE },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description:
      'PIN allocation exhausted after 32 collisions; safe to retry the same request',
    schema: { example: ROOM_PIN_EXHAUSTED_EXAMPLE },
  })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() input: CreateRoomDto,
  ) {
    if (!input || Array.isArray(input))
      throw new BadRequestException('Room body must be a JSON object');
    try {
      return await this.creation.execute({
        ownerId: user.userId,
        quizId: input.quizId.toLowerCase(),
        requestId: input.requestId.toLowerCase(),
      });
    } catch (error) {
      if (error instanceof PinAllocationError)
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: 'PIN_ALLOCATION_EXHAUSTED',
          message: error.message,
        });
      if (error instanceof CreationRequestConflictError)
        throw new ConflictException({
          statusCode: 409,
          code: 'CREATION_REQUEST_CONFLICT',
          message: error.message,
        });
      if (error instanceof QuizNotFoundError)
        throw new NotFoundException({
          statusCode: 404,
          code: 'QUIZ_NOT_FOUND',
          message: error.message,
        });
      if (error instanceof ActiveRoomError)
        throw new ConflictException({
          statusCode: 409,
          code: 'OWNER_HAS_ACTIVE_ROOM',
          message: error.message,
        });
      if (error instanceof QuizNotHostableError)
        throw new BadRequestException({
          statusCode: 400,
          code: 'QUIZ_NOT_HOSTABLE',
          message: error.message,
          fields: error.fields,
        });
      throw error;
    }
  }
}
