# NPM Deprecation Warnings

This document explains the npm deprecation warnings you may see during installation and why they can be safely ignored.

## Current Warnings

### `inflight@1.0.6`
- **Warning**: Memory leak warning 
- **Source**: ESLint dependency chain
- **Impact**: Build-time only, doesn't affect runtime
- **Status**: Will be resolved when ESLint ecosystem updates

### `rimraf@3.0.2` and `glob@7.2.3`
- **Warning**: Versions prior to v4/v9 no longer supported
- **Source**: ESLint and other tooling dependencies
- **Impact**: Build-time only, doesn't affect runtime
- **Status**: Overridden in package.json where possible

### `@humanwhocodes/*` packages
- **Warning**: Use `@eslint/*` packages instead
- **Source**: ESLint configuration dependencies
- **Impact**: Build-time only, doesn't affect runtime
- **Status**: Will be resolved with ESLint 9 migration

### `eslint@8.57.0`
- **Warning**: Version no longer supported
- **Source**: Next.js 14 compatibility requirement
- **Impact**: None - ESLint 8.57 is the last version compatible with Next.js 14
- **Status**: Will be resolved when upgrading to Next.js 15

## Why These Warnings Exist

These warnings occur because:

1. **Next.js 14** requires ESLint 8.x (doesn't support ESLint 9's flat config yet)
2. **ESLint 8.x** depends on older versions of `rimraf`, `glob`, and `inflight`
3. **Ecosystem transition** - tools are moving to newer versions but maintain backward compatibility

## Resolution Timeline

- **Short term**: Warnings are cosmetic and don't affect functionality
- **Medium term**: Next.js 15 will support ESLint 9 and resolve most warnings
- **Long term**: All ecosystem tools will migrate to modern dependency versions

## Current Mitigation

1. **Package overrides** force newer versions where safe
2. **ESLint configuration** limited to specific directories to minimize warning exposure  
3. **Build still succeeds** - warnings don't prevent deployment

## Action Items

- [ ] Monitor Next.js 15 stable release for ESLint 9 support
- [ ] Update to Next.js 15 when stable and compatible with our dependencies
- [ ] Migrate to ESLint 9 flat config after Next.js upgrade
- [ ] Remove package overrides once ecosystem catches up

These warnings are a common issue in the JavaScript ecosystem during major version transitions and can be safely ignored for now.