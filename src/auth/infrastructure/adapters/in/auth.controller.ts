import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type {
  LoginUseCasePort,
  LoginOutput,
} from '../../../application/ports/in/login.use-case';
import {
  LoginInput,
  LOGIN_USE_CASE_PORT,
} from '../../../application/ports/in/login.use-case';
import type {
  RegisterUseCasePort,
  RegisterOutput,
} from '../../../application/ports/in/register.use-case';
import {
  RegisterInput,
  REGISTER_USE_CASE_PORT,
} from '../../../application/ports/in/register.use-case';
import type {
  LogoutUseCasePort,
  LogoutOutput,
} from '../../../application/ports/in/logout.use-case';
import { LOGOUT_USE_CASE_PORT } from '../../../application/ports/in/logout.use-case';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUserData } from './current-user.decorator';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_USE_CASE_PORT)
    private readonly loginService: LoginUseCasePort,
    @Inject(REGISTER_USE_CASE_PORT)
    private readonly registerService: RegisterUseCasePort,
    @Inject(LOGOUT_USE_CASE_PORT)
    private readonly logoutService: LogoutUseCasePort,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  async register(@Body() input: RegisterInput): Promise<RegisterOutput> {
    return this.registerService.execute(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  async login(@Body() input: LoginInput): Promise<LoginOutput> {
    return this.loginService.execute(input);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: CurrentUserData): Promise<LogoutOutput> {
    return this.logoutService.execute({ userId: user.userId });
  }
}
