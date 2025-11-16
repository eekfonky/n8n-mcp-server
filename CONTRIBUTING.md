# Contributing to n8n MCP Server

Thank you for your interest in contributing to the n8n MCP Server! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility and apologize for mistakes

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher (24+ recommended)
- npm or yarn package manager
- Git for version control
- Access to an n8n instance for testing

### First Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/n8n-mcp-server.git
   cd n8n-mcp-server
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/eekfonky/n8n-mcp-server.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your n8n instance details
   ```

## Development Setup

### Environment Variables

Create a `.env` file with:

```bash
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
DEBUG=true
LOG_LEVEL=debug
```

### Running in Development Mode

```bash
# Run with auto-reload
npm run dev

# Run with debugging
DEBUG=true npm run dev
```

### Building

```bash
# Build TypeScript
npm run build

# Clean and rebuild
npm run clean && npm run build
```

## Project Structure

```
n8n-mcp-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── client.ts             # n8n API client
│   ├── logger.ts             # Structured logging
│   ├── cache.ts              # Caching layer
│   ├── types/
│   │   └── n8nApi.ts        # TypeScript type definitions
│   ├── schemas/
│   │   └── validation.ts    # Zod validation schemas
│   ├── tools/               # MCP tool implementations
│   │   ├── discover.ts
│   │   ├── create.ts
│   │   ├── execute.ts
│   │   ├── inspect.ts
│   │   └── remove.ts
│   └── utils/              # Utility functions
├── tests/                   # Additional test files
├── catalog/                # MCP catalog definitions
├── examples/               # Usage examples
└── scripts/                # Build and deployment scripts
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, documented code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

We use conventional commits:

```bash
git commit -m "feat: add new validation for workflow parameters"
git commit -m "fix: handle null response in execute tool"
git commit -m "docs: update README with new examples"
git commit -m "test: add unit tests for cache module"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process or auxiliary tool changes

### 4. Keep Your Fork Updated

```bash
git fetch upstream
git rebase upstream/main
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place test files next to the code they test: `module.ts` → `module.test.ts`
- Use descriptive test names
- Follow the AAA pattern: Arrange, Act, Assert
- Mock external dependencies

Example:

```typescript
describe('MyFunction', () => {
  it('should return expected result when given valid input', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage

We aim for:
- **Minimum 80% code coverage** for new code
- **100% coverage** for critical paths (authentication, data validation)
- All edge cases tested

## Code Style

### TypeScript Guidelines

1. **Use strict TypeScript:**
   - Enable all strict mode options
   - Avoid `any` types (use `unknown` if needed)
   - Define explicit return types for functions

2. **Naming Conventions:**
   - `camelCase` for variables and functions
   - `PascalCase` for classes and types
   - `UPPER_SNAKE_CASE` for constants
   - Prefix interfaces with 'I' only when needed for clarity

3. **File Organization:**
   - One main export per file
   - Group related functionality
   - Keep files under 300 lines when possible

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Code Formatting

We use Prettier for code formatting:

```bash
# Format is automatic on commit via pre-commit hooks
# Or manually format all files:
npx prettier --write .
```

### Pre-commit Hooks

Pre-commit hooks automatically run:
- ESLint (with auto-fix)
- Prettier
- TypeScript type checking

If checks fail, the commit will be rejected.

## Submitting Changes

### Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all tests pass:**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

4. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub:
   - Use a clear title describing the change
   - Reference any related issues
   - Provide context and motivation
   - Include screenshots for UI changes

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Release Process

Releases are managed by maintainers:

1. **Version Bump:**
   - Update version in `package.json`
   - Update `CHANGELOG.md`

2. **Tag Release:**
   ```bash
   git tag -a v2.1.0 -m "Release v2.1.0"
   git push origin v2.1.0
   ```

3. **Publish:**
   - Docker images published automatically via GitHub Actions
   - npm package published manually

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue
- **Security:** Email security@example.com (do not open public issues)

## Additional Resources

- [n8n API Documentation](https://docs.n8n.io/api/)
- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to n8n MCP Server! 🎉
