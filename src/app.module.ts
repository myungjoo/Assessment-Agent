import { Module } from '@nestjs/common';

/**
 * Root application module.
 *
 * Intentionally empty for T-0001 bootstrap. Domain modules (Assessment, User,
 * GitHub integration, etc.) will be added in Phase P1+ as their own ADRs and
 * tasks land.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
