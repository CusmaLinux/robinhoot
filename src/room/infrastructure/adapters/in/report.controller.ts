import { GameReportDto } from './report-response.dto';
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import type { CurrentUserData } from '../../../../auth/infrastructure/adapters/in/current-user.decorator';
import { READ_REPORTS_PORT } from '../../../application/ports/in/read-reports.use-case';
import type { ReadReportsPort } from '../../../application/ports/in/read-reports.use-case';

@ApiTags('reports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description:
    'A valid account token is required; room credentials grant no history access.',
})
@Controller('reports')
export class ReportController {
  constructor(
    @Inject(READ_REPORTS_PORT) private readonly reports: ReadReportsPort,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List only the authenticated account’s completed reports, newest first',
  })
  @ApiOkResponse({
    type: [GameReportDto],
    description:
      'Version-1 report documents; empty array when no owned reports exist.',
  })
  list(@CurrentUser() user: CurrentUserData) {
    return this.reports.list(user.userId);
  }
  @Get(':id')
  @ApiOperation({
    summary:
      'Reopen an owned report independently of its source quiz or live room',
  })
  @ApiOkResponse({
    type: GameReportDto,
    description:
      'The original version-1 report, including quiz snapshot, shared ranks and question counts.',
  })
  @ApiBadRequestResponse({ description: 'Report ID must be a UUID.' })
  @ApiNotFoundResponse({
    description:
      'Report does not exist or belongs to another account, including for admins.',
  })
  async read(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const report = await this.reports.read(user.userId, id.toLowerCase());
    if (!report)
      throw new NotFoundException({
        statusCode: 404,
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
      });
    return report;
  }
}
