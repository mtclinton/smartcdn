# Release Checklist

Use this checklist when preparing SmartCDN for release or making it available to others.

## Pre-Release

- [ ] Remove all hardcoded URLs and deployment-specific references
- [ ] Update `wrangler.toml.example` with placeholder URLs
- [ ] Ensure `wrangler.toml` is in `.gitignore`
- [ ] Update all documentation with generic examples
- [ ] Add LICENSE file
- [ ] Add CONTRIBUTING.md
- [ ] Update README.md with setup instructions
- [ ] Create SETUP.md with detailed setup guide
- [ ] Remove or update any demo/test-specific code
- [ ] Update package.json with repository URL and metadata
- [ ] Verify all tests pass
- [ ] Build successfully (`npm run build`)

## Documentation

- [ ] README.md updated with quick start
- [ ] SETUP.md created with detailed instructions
- [ ] All documentation uses placeholder URLs
- [ ] Examples are generic and not deployment-specific
- [ ] Contributing guidelines are clear

## Code

- [ ] No hardcoded deployment URLs
- [ ] Configuration files use environment variables
- [ ] All features are configurable
- [ ] Code is well-commented
- [ ] Tests are comprehensive

## Post-Release

- [ ] Create GitHub release
- [ ] Tag the release
- [ ] Update changelog (if maintained)
- [ ] Announce the release (if applicable)

## Notes

- Users should copy `wrangler.toml.example` to `wrangler.toml` before deploying
- All origin URLs should be user-configurable
- Service bindings are optional but recommended
- Documentation should be clear about prerequisites

