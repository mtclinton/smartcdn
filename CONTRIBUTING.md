# Contributing to SmartCDN

Thank you for your interest in contributing to SmartCDN! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/smartcdn.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

### Code Style

- Follow existing code style and patterns
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

### Testing

- Write tests for new features
- Ensure all tests pass: `npm test`
- Aim for good test coverage
- Test edge cases and error conditions

### Building

```bash
# Build the worker
npm run build

# Build for production
npm run build:prod
```

### Local Testing

```bash
# Run the worker locally
npx wrangler dev
```

## Pull Request Process

1. Ensure your code follows the project's style guidelines
2. Add or update tests as needed
3. Update documentation if you're adding features
4. Ensure all tests pass
5. Create a clear PR description explaining your changes
6. Reference any related issues

## Feature Requests

If you have an idea for a new feature:

1. Check existing issues to see if it's already discussed
2. Open an issue describing the feature and use case
3. Wait for feedback before implementing

## Bug Reports

When reporting bugs, please include:

- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, OS, etc.)
- Any error messages or logs

## Questions?

Open an issue with your question and we'll help you out.

