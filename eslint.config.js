module.exports = [
    {
      files: ['src/**/*.js', 'tests/**/*.js'],                                                  languageOptions: {
        ecmaVersion: 'latest',                                                            
        sourceType: 'commonjs',
        globals: {
          console: 'readonly',
          process: 'readonly',
          __dirname: 'readonly',
          module: 'readonly',
          require: 'readonly',
          exports: 'readonly',
          jest: 'readonly',
          describe: 'readonly',
          test: 'readonly',
          expect: 'readonly',
          beforeEach: 'readonly',
          afterEach: 'readonly',
        },
      },
      rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_|next' }],
      },
    },
  ];