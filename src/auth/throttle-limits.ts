import { hours, minutes } from '@nestjs/throttler';

export const LOGIN_LIMIT = { default: { limit: 10, ttl: minutes(1) } };

export const REGISTER_LIMIT = { default: { limit: 5, ttl: hours(1) } };