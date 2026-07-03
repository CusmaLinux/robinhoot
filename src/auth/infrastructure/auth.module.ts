import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './adapters/in/auth.controller';
import { JwtAuthGuard } from './adapters/in/jwt-auth.guard';
import { RolesGuard } from './adapters/in/roles.guard';
import { JwtNestJsAdapter } from './adapters/out/jwt-nestjs.adapter';
import { BcryptAdapter } from './adapters/out/bcrypt.adapter';
import { UserKyselyAdapter } from './adapters/out/user.kysely.adapter';
import { LoginService } from '../application/services/login.service';
import { RegisterService } from '../application/services/register.service';
import { ValidateTokenService } from '../application/services/validate-token.service';
import { LogoutService } from '../application/services/logout.service';
import { LOGIN_USE_CASE_PORT } from '../application/ports/in/login.use-case';
import { REGISTER_USE_CASE_PORT } from '../application/ports/in/register.use-case';
import { VALIDATE_TOKEN_USE_CASE_PORT } from '../application/ports/in/validate-token.use-case';
import { LOGOUT_USE_CASE_PORT } from '../application/ports/in/logout.use-case';
import { JWT_SERVICE_PORT } from '../application/ports/out/jwt.service.port';
import { BCRYPT_SERVICE_PORT } from '../application/ports/out/bcrypt.service.port';
import { USER_REPOSITORY_PORT } from '../application/ports/out/user.repository.port';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Use cases
    LoginService,
    RegisterService,
    ValidateTokenService,
    LogoutService,
    // Port tokens (useExisting maps Symbol → Service class for @Inject resolution)
    { provide: LOGIN_USE_CASE_PORT, useExisting: LoginService },
    { provide: REGISTER_USE_CASE_PORT, useExisting: RegisterService },
    {
      provide: VALIDATE_TOKEN_USE_CASE_PORT,
      useExisting: ValidateTokenService,
    },
    { provide: LOGOUT_USE_CASE_PORT, useExisting: LogoutService },
    // Outbound port → adapter bindings
    {
      provide: JWT_SERVICE_PORT,
      useClass: JwtNestJsAdapter,
    },
    {
      provide: BCRYPT_SERVICE_PORT,
      useClass: BcryptAdapter,
    },
    {
      provide: USER_REPOSITORY_PORT,
      useClass: UserKyselyAdapter,
    },
    // Global guards
    {
      provide: 'APP_GUARD',
      useClass: JwtAuthGuard,
    },
    {
      provide: 'APP_GUARD',
      useClass: RolesGuard,
    },
  ],
  exports: [
    AuthModule,
    JWT_SERVICE_PORT,
    BCRYPT_SERVICE_PORT,
    USER_REPOSITORY_PORT,
  ],
})
export class AuthModule {}
