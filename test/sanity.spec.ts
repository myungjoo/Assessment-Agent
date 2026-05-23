/**
 * Sanity smoke test for T-0001 bootstrap.
 *
 * Purpose: prove that Jest + ts-jest are wired correctly and that the NestJS
 * AppModule bootstraps in a test environment using only the dependencies that
 * are already declared in package.json (@nestjs/core + @nestjs/common). Domain
 * tests arrive with their owning modules in Phase P1+.
 */
import 'reflect-metadata';
import { bootstrap } from '../src/main';

describe('T-0001 bootstrap sanity', () => {
  it('arithmetic baseline (jest is alive)', () => {
    expect(1 + 1).toBe(2);
  });

  it('exported bootstrap() runs end-to-end (createApplicationContext + close)', async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});
