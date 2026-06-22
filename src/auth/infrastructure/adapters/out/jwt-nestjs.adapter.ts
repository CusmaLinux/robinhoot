import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  JwtServicePort,
  JwtPayload,
} from '../../../application/ports/out/jwt.service.port';

@Injectable()
export class JwtNestJsAdapter implements JwtServicePort {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: object): string {
    return this.jwtService.sign(payload);
  }

  verify(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }
}
