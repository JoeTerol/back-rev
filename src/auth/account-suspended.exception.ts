import { ForbiddenException } from '@nestjs/common';

export class AccountSuspendedException extends ForbiddenException {
  constructor() {
    super('Cuenta suspendida');
  }
}