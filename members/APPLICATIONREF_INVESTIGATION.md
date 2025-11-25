# ApplicationRef Destroyed Error Investigation

## Problem Statement

The test suite for `admin-unclaimed-profile-detail.spec.ts` produces "ApplicationRef has already been destroyed" errors in CI (Ubuntu/Docker) but not locally (Windows). All tests pass successfully in both environments, but CI shows accumulated stderr warnings.

## Environment Details

### Local (Windows)
- OS: Windows (MINGW64_NT-10.0-26200)
- Bun: 1.3.3
- Node: v20.19.4
- Result: **0 ApplicationRef errors** from admin-unclaimed-profile-detail.spec.ts
- Total ApplicationRef errors: 86 (from other test files)

### CI (Ubuntu/Docker)
- OS: Ubuntu 24.04 (Docker container)
- Bun: 1.3.2
- Image: `ghcr.io/${{ github.repository }}:trunk`
- Result: **40 ApplicationRef errors** from admin-unclaimed-profile-detail.spec.ts
- Pattern: 2 errors per test (basic), 6 errors per test (with button interactions)

## Error Pattern Analysis

### Initial Pattern (Before Fixes)
```
Test 1: 1 error
Test 2: 2 errors
Test 3: 3 errors
Test 4: 4 errors
...
Test 11 ("should show success message"): 16+ errors
```
**Accumulating pattern** - each test added more errors than the previous.

### After userEvent.setup() Timing Fix
```
Test 1: 2 errors
Test 2: 2 errors
Test 3: 2 errors
...
Test 11 ("should show success message"): 6 errors
Test 12 ("should show error message"): 6 errors
Test 14 ("should show processing state"): 6 errors
```
**Consistent pattern** - most tests show 2 errors, tests triggering `sendInvitation()` show 6 errors.

## Root Cause Analysis

### Component Architecture
```typescript
@Component({
  providers: [AdminUnclaimedProfileDetailService], // Component-level provider!
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUnclaimedProfileDetail {
  protected service = inject(AdminUnclaimedProfileDetailService);

  protected invitationAlreadySent = computed(() => {
    const resource = this.service.unclaimedProfileResource;
    if (!resource.hasValue()) return false;
    return resource.value().invitationEmailStatus === 'sent';
  });
}
```

### Service Architecture
```typescript
@Injectable()
export class AdminUnclaimedProfileDetailService {
  readonly unclaimedProfileResource = resource({
    params: () => ({ email: this.emailSignal() }),
    loader: ({ params }) => this.adminMembersService.getUnclaimedProfile(params.email),
  });

  async sendInvitation(email: string): Promise<void> {
    // ...
    this.unclaimedProfileResource.reload(); // Triggers new async operation
  }
}
```

### The Issue
1. **Component-level provider** creates a new service instance per component
2. **Angular's `resource()` API** is reactive and tracks signal changes
3. **`resource.reload()`** triggers async operations when buttons are clicked
4. In **CI timing** (Ubuntu/Docker), these async operations are still pending when:
   - Test completes
   - Testing-library cleanup runs
   - ApplicationRef gets destroyed
5. The resource tries to update signals **after** ApplicationRef is destroyed
6. **Zoneless change detection** makes this more sensitive to timing

## Experiments Attempted

### ✅ Experiment 1: Move userEvent.setup() After render()
**Hypothesis**: userEvent.setup() before render() causes ApplicationRef initialization issues.

**Implementation**:
```typescript
// BEFORE (incorrect)
async function setup() {
  const user = userEvent.setup(); // TOO EARLY
  const component = await render(...);
  return { user, component };
}

// AFTER (correct)
async function setup() {
  const component = await render(...);
  const user = userEvent.setup(); // AFTER render
  return { user, component };
}
```

**Result**:
- ✅ **Local (Windows)**: Fixed! 0 errors from this file
- ❌ **CI (Ubuntu)**: Still 40 errors, but pattern changed from accumulating (1,2,3,4...) to consistent (2,2,2,2...)
- **Conclusion**: Partially correct - helps but doesn't fully solve CI issue

### ❌ Experiment 2: Add afterEach with setTimeout(0)
**Hypothesis**: Waiting for one microtask tick allows resources to settle.

**Implementation**:
```typescript
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});
```

**Result**:
- **CI**: Still 40 errors with same consistent pattern (2,2,2,2...)
- **Conclusion**: Microtask tick not sufficient for resource cleanup

### ❌ Experiment 3: Increase afterEach to setTimeout(100)
**Hypothesis**: Resource needs a full macrotask cycle (100ms) to complete.

**Implementation**:
```typescript
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});
```

**Result**:
- **CI**: Still 40 errors, pattern became more variable (some 6-7, some more)
- **Side effect**: Added 1.5 seconds to test suite runtime (100ms × 15 tests)
- **Conclusion**: Timeout approach unreliable due to race conditions

### ❌ Experiment 4: Mock AdminUnclaimedProfileDetailService
**Hypothesis**: Mocking the service removes real resource() operations.

**Implementation**:
```typescript
const mockService = {
  unclaimedProfileResource: {
    isLoading: vi.fn(() => false),
    hasValue: vi.fn(() => true),
    value: vi.fn(() => mockProfile),
    error: vi.fn(() => undefined),
    reload: vi.fn(),
  },
  // ... other mocked properties
};

await render(AdminUnclaimedProfileDetail, {
  providers: [
    { provide: AdminUnclaimedProfileDetailService, useValue: mockService },
  ],
});
```

**Result**:
- **CI**: Still 40 errors with EXACT same pattern
- **Reason**: Component uses `providers: [AdminUnclaimedProfileDetailService]` at component level, which creates a **new real instance** despite test mocks
- **Conclusion**: Component-level providers bypass test mocks

## Key Findings

### Why Local Works But CI Doesn't
1. **OS-level async scheduling differences**: Windows vs Linux handle async operations differently
2. **Docker containerization**: Different resource constraints and timing
3. **Test execution speed**: CI might be slower/faster, exposing race conditions
4. **Event loop timing**: Different microtask/macrotask scheduling between platforms

### Why Component-Level Providers Are Problematic for Testing
The component decorator includes:
```typescript
providers: [AdminUnclaimedProfileDetailService]
```

This means:
- Every component instance creates its own service instance
- Test-level providers are overridden by component-level providers
- The real service with real resource() API runs even when mocked
- Impossible to prevent resource() lifecycle without modifying component

### Tests That Trigger More Errors
Tests that click buttons and call `service.sendInvitation()`:
- "should show success message after sending invitation" (6 errors)
- "should show error message when sending invitation fails" (6 errors)
- "should show processing state while sending invitation" (6 errors)

These trigger `resource.reload()` which starts new async operations.

## Current State

### What Works
- ✅ All 220 tests pass in local environment
- ✅ All 220 tests pass in CI environment
- ✅ Application functionality is unaffected
- ✅ userEvent timing fix prevents accumulation locally

### What Doesn't Work
- ❌ CI still shows 40 ApplicationRef warnings in stderr
- ❌ Mocking approach failed due to component-level providers
- ❌ Timeout approaches unreliable due to race conditions

### Files Modified
1. `admin-unclaimed-profile-detail.spec.ts`
   - Added `computed` and `signal` imports
   - Moved `userEvent.setup()` after `render()`
   - Added `afterEach` hook with 100ms timeout
   - Added mock service implementation
   - Fixed lint error (null → undefined)

2. `edit-profile.spec.ts`
   - Moved `userEvent.setup()` after `render()`

3. `auth-actions.integration.spec.ts`
   - Moved `userEvent.setup()` after `render()`

## Potential Solutions

### Option 1: Accept as Known Issue ⭐ RECOMMENDED
**Pros**:
- Tests pass successfully
- Application works correctly
- No code changes needed
- Documented understanding of issue

**Cons**:
- CI logs contain warnings (doesn't fail builds)
- Aesthetic issue in test output

**Action**: Document in README, move on to other work

### Option 2: Remove Component-Level Provider
**Pros**:
- Would likely eliminate errors completely
- Makes component more testable

**Cons**:
- Requires production code change
- May affect component lifecycle/isolation
- Need to carefully test side effects

**Action**:
```typescript
@Component({
  // Remove this line:
  // providers: [AdminUnclaimedProfileDetailService],
})
```
Then provide service at module/route level instead.

### Option 3: Suppress Specific Warnings in CI
**Pros**:
- Keeps stderr clean in CI
- No code changes

**Cons**:
- Might hide other important warnings
- Band-aid solution

**Action**: Add to CI workflow:
```yaml
- name: Test Members site
  run: bun run test 2>&1 | grep -v "ApplicationRef has already been destroyed" || true
```

### Option 4: Wait for Angular Framework Fix
**Pros**:
- Official solution
- Would fix for everyone

**Cons**:
- No timeline
- May not be considered a bug by Angular team

**Action**: File issue with Angular team about zoneless + resource() + component-level providers interaction

## Tests to Run on MacBook

### Test 1: Basic Error Count
```bash
cd members
bun run test 2>&1 | grep -c "ApplicationRef"
bun run test 2>&1 | grep "admin-unclaimed-profile" | grep -c "ApplicationRef"
```

**Expected on MacBook (macOS/Unix-like)**:
- Might show similar pattern to CI (Ubuntu)
- Or might show similar pattern to Windows local
- This will tell us if it's Windows vs Unix, or just Windows vs everything

### Test 2: Run Tests Multiple Times
```bash
cd members
for i in {1..5}; do
  echo "=== Run $i ==="
  bun run test 2>&1 | grep "admin-unclaimed-profile" | grep -c "ApplicationRef"
done
```

**Purpose**: Check if error count is consistent or varies (indicates race condition)

### Test 3: Run with Different Bun Versions
```bash
# Check current version
bun --version

# Run tests
bun run test 2>&1 | grep "admin-unclaimed-profile" | grep "ApplicationRef" | wc -l

# If possible, try with Bun 1.3.2 (same as CI)
# Or Bun 1.3.3 (same as Windows local)
```

**Purpose**: Determine if Bun version affects async timing

### Test 4: Run in Docker (Most Important!)
```bash
# Pull or build the CI image if available
docker run -it --rm -v $(pwd):/app -w /app/members ubuntu:24.04 bash

# Inside container:
apt-get update && apt-get install -y curl unzip
curl -fsSL https://bun.sh/install | bash
export PATH="/root/.bun/bin:$PATH"
bun install
bun run test 2>&1 | grep "admin-unclaimed-profile" | grep -c "ApplicationRef"
```

**Purpose**: Reproduce exact CI environment to confirm Docker isolation is the factor

### Test 5: Run with Node Instead of Bun
```bash
cd members
npm install  # or use existing node_modules
npm test 2>&1 | grep "admin-unclaimed-profile" | grep -c "ApplicationRef"
```

**Purpose**: Determine if it's Bun-specific or runtime-agnostic

### Test 6: Run Single Test File in Isolation
```bash
cd members
# Try to run just the problematic file
# (May need to check test runner docs for syntax)
bun run test src/app/admin/users/admin-unclaimed-profile-detail/admin-unclaimed-profile-detail.spec.ts 2>&1 | grep -c "ApplicationRef"
```

**Purpose**: Check if isolation affects the issue

### Test 7: Check System Resources During Tests
```bash
cd members
# In one terminal:
bun run test

# In another terminal:
watch -n 0.5 'ps aux | grep -E "(bun|node)" | grep -v grep'
```

**Purpose**: See if resource constraints affect timing

## Additional Information

### Angular Version
- @angular/core: 21.0.0
- @angular/build: 21.0.0
- Zoneless change detection enabled globally in `test-providers.ts`

### Testing Library Versions
- @testing-library/angular: 18.1.1
- @testing-library/user-event: 14.6.1
- vitest: 4.0.13

### Related Documentation
- Angular resource() API: https://angular.dev/guide/signals#resource
- Testing Library cleanup: https://testing-library.com/docs/react-testing-library/api/#cleanup
- Angular zoneless: https://angular.dev/guide/experimental/zoneless

## Conclusion

This is a complex interaction between:
1. Angular's zoneless change detection
2. Angular's resource() API with reactive signals
3. Component-level dependency injection
4. OS-level async timing differences
5. Testing library cleanup lifecycle

The issue manifests as warnings in CI but doesn't affect functionality. The recommended approach is to **document and accept** this as a known environmental quirk while the Angular framework matures its zoneless and resource() APIs.

## Document History

- 2025-11-25: Initial investigation and documentation
- Author: Claude Code debugging session
- Last Updated: 2025-11-25
