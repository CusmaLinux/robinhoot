import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { InvalidQuizStructureError } from '../../../domain/quiz';
import { SaveQuizDto } from './save-quiz.dto';
import { CreateQuizDto } from './create-quiz.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { QuizDetailDto, QuizSummaryDto } from './quiz-response.dto';
import {
  EMPTY_DRAFT_EXAMPLE,
  SAVE_QUIZ_EXAMPLE,
  MIXED_QUIZ_EXAMPLE,
  HOSTABLE_QUIZ_EXAMPLE,
  INCOMPLETE_SAVE_EXAMPLE,
  INCOMPLETE_QUIZ_EXAMPLE,
  QUIZ_LIST_EXAMPLE,
  QUIZ_UNAUTHORIZED_EXAMPLE,
  QUIZ_NOT_FOUND_EXAMPLE,
  QUIZ_BAD_REQUEST_EXAMPLE,
  QUIZ_BAD_ID_EXAMPLE,
} from './quiz-api.examples';
import { CurrentUser } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import type { CurrentUserData } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import { QUIZ_AUTHORING_USE_CASE_PORT } from '../../../application/ports/in/quiz-authoring.use-case';
import type { QuizAuthoringUseCasePort } from '../../../application/ports/in/quiz-authoring.use-case';

@ApiTags('quizzes')
@ApiBearerAuth()
@ApiExtraModels(CreateQuizDto, SaveQuizDto, QuizDetailDto, QuizSummaryDto)
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired, or revoked account credential',
  schema: { example: QUIZ_UNAUTHORIZED_EXAMPLE },
})
@Controller('quizzes')
export class QuizController {
  constructor(
    @Inject(QUIZ_AUTHORING_USE_CASE_PORT)
    private readonly authoring: QuizAuthoringUseCasePort,
  ) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an owned saved quiz',
    description:
      'Deletes only the source quiz. Independent game/report snapshots belong to their own lifecycle. Admins have no cross-owner bypass.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({
    description: 'Owned quiz deleted; empty response body',
  })
  @ApiNotFoundResponse({
    description: 'Missing or foreign quiz (also returned on repeated deletion)',
    schema: { example: QUIZ_NOT_FOUND_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description: 'Malformed quiz UUID',
    schema: { example: QUIZ_BAD_ID_EXAMPLE },
  })
  async delete(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    if (!(await this.authoring.delete(user.userId, id))) {
      throw new NotFoundException('Quiz not found');
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a private empty quiz draft' })
  @ApiBody({
    required: false,
    schema: { $ref: getSchemaPath(CreateQuizDto) },
    examples: { empty: { value: {} }, titled: { value: { title: 'Biology' } } },
  })
  @ApiCreatedResponse({
    description: 'Persisted draft with readiness errors',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(QuizDetailDto) },
        example: EMPTY_DRAFT_EXAMPLE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Malformed input or unknown properties',
    schema: { example: QUIZ_BAD_REQUEST_EXAMPLE },
  })
  create(@CurrentUser() user: CurrentUserData, @Body() input: CreateQuizDto) {
    if (Array.isArray(input)) {
      throw new BadRequestException('Draft body must be a JSON object');
    }
    return this.authoring.create(user.userId, input?.title ?? '');
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Atomically replace an owned draft, preserving supplied IDs and array order',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    type: SaveQuizDto,
    examples: {
      hostable: { value: SAVE_QUIZ_EXAMPLE },
      mixed: { value: MIXED_QUIZ_EXAMPLE },
      incomplete: { value: INCOMPLETE_SAVE_EXAMPLE },
      empty: { value: { title: '', questions: [] } },
    },
  })
  @ApiOkResponse({
    description:
      'Saved aggregate with derived readiness, including incomplete drafts',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(QuizDetailDto) },
        examples: {
          hostable: { value: HOSTABLE_QUIZ_EXAMPLE },
          mixed: {
            value: {
              ...EMPTY_DRAFT_EXAMPLE,
              ...MIXED_QUIZ_EXAMPLE,
              hostable: true,
              errors: [],
            },
          },
          incomplete: { value: INCOMPLETE_QUIZ_EXAMPLE },
          empty: { value: EMPTY_DRAFT_EXAMPLE },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Malformed structure, duplicate IDs, invalid option references, unknown fields or malformed path UUID; no content is changed',
    schema: { example: QUIZ_BAD_REQUEST_EXAMPLE },
  })
  @ApiNotFoundResponse({
    description:
      'Missing quiz or quiz owned by another account, including admins',
    schema: { example: QUIZ_NOT_FOUND_EXAMPLE },
  })
  async save(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SaveQuizDto,
  ) {
    if (!input || Array.isArray(input)) {
      throw new BadRequestException('Draft body must be a JSON object');
    }
    try {
      const quiz = await this.authoring.save(user.userId, id, input);
      if (!quiz) throw new NotFoundException('Quiz not found');
      return quiz;
    } catch (error) {
      if (error instanceof InvalidQuizStructureError) {
        throw new BadRequestException([error.message]);
      }
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an owned quiz draft' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'Owned draft with readiness errors',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(QuizDetailDto) },
        example: EMPTY_DRAFT_EXAMPLE,
      },
    },
  })
  @ApiNotFoundResponse({
    description:
      'Missing quiz or quiz owned by another account (including for admins)',
    schema: { example: QUIZ_NOT_FOUND_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description: 'Malformed quiz UUID',
    schema: { example: QUIZ_BAD_ID_EXAMPLE },
  })
  async read(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const quiz = await this.authoring.read(user.userId, id);
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  @Get()
  @ApiOperation({
    summary:
      'List only owned summaries, newest first (id descending breaks ties)',
  })
  @ApiOkResponse({
    description: 'Owned summaries; empty array when none exist',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: { $ref: getSchemaPath(QuizSummaryDto) },
        },
        example: QUIZ_LIST_EXAMPLE,
      },
    },
  })
  list(@CurrentUser() user: CurrentUserData) {
    return this.authoring.list(user.userId);
  }
}
