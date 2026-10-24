import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateQuizDto } from './create-quiz.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
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
@ApiExtraModels(CreateQuizDto, QuizDetailDto, QuizSummaryDto)
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
