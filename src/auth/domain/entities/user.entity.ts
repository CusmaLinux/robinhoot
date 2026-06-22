export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly tokenVersion: number,
    public readonly createdAt: Date,
  ) {}
}
