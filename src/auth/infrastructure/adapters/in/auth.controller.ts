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
  LoginInput,
  LoginOutput,
} from '../../../application/ports/in/login.use-case';
import { LOGIN_USE_CASE_PORT } from '../../../application/ports/in/login.use-case';
import type {
  RegisterUseCasePort,
  RegisterInput,
  RegisterOutput,
} from '../../../application/ports/in/register.use-case';
import { REGISTER_USE_CASE_PORT } from '../../../application/ports/in/register.use-case';
import type {
  LogoutUseCasePort,
  LogoutOutput,
} from '../../../application/ports/in/logout.use-case';
import { LOGOUT_USE_CASE_PORT } from '../../../application/ports/in/logout.use-case';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUserData } from './current-user.decorator';

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
  async register(@Body() input: RegisterInput): Promise<RegisterOutput> {
    return this.registerService.execute(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginInput): Promise<LoginOutput> {
    return this.loginService.execute(input);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: CurrentUserData): Promise<LogoutOutput> {
    return this.logoutService.execute({ userId: user.userId });
  }
}
