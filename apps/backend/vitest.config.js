import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['api/**/*.{test,spec}.{js,ts}', 'lib/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['api/**/*.js', 'lib/**/*.js'],
      exclude: ['api/**/*.{test,spec}.*', 'lib/**/*.{test,spec}.*'],
    },
  },
});
