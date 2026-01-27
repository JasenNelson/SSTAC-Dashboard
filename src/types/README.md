# Type System Documentation

This directory contains the comprehensive type definitions for the SSTAC Dashboard application.

## Overview

The type system is organized into modular files with a central barrel export (`index.ts`) that serves as the single import point for the entire application.

## Files

### 1. `database.ts` (420+ lines)

Database model types that mirror the Supabase PostgreSQL schema and SQLite regulatory review database.

**Contents:**
- User management types (`UserRole`)
- Document management (`Tag`, `Document`)
- Forum system (`Discussion`, `DiscussionReply`, `Like`)
- Polling system (`Poll`, `PollVote`, `PollResults`)
- Ranking polls (`RankingPoll`, `RankingVote`, `RankingResults`)
- Wordcloud polls (`WordcloudPoll`, `WordcloudVote`, `WordcloudResults`)
- Admin support (`Announcement`, `Milestone`)
- Review submissions (`ReviewSubmission`, `ReviewFile`)
- Regulatory review (`RegulatorySubmission`, `RegulatoryAssessment`, `RegulatoryJudgment`, etc.)
- Derived types for views and aggregations

**Note on Auto-Generation:**
This file was manually created based on the Supabase schema (task 1.1). In the future, this can be supplemented with auto-generated types by running:
```bash
npx supabase gen types typescript --linked > src/types/database.generated.ts
```
To enable this, you need:
1. Supabase project linked to local development
2. Active `.env.local` with Supabase credentials
3. Run from a system with access to Supabase API

The manual types in `database.ts` provide type safety independently of auto-generation.

### 2. `forms.ts` (330+ lines)

Form input types, submission payloads, and form state management.

**Contents:**
- TWG Review form data (`ReviewFormData`, `ReviewFormSection`, `ReviewFormField`)
- Poll submission types (`PollSubmitPayload`, `RankingSubmitPayload`, `WordcloudSubmitPayload`)
- Forum submissions (`DiscussionCreatePayload`, `DiscussionReplyPayload`)
- Document management (`DocumentCreatePayload`, `DocumentUpdatePayload`, `TagCreatePayload`)
- Admin forms (`AnnouncementCreatePayload`, `MilestoneCreatePayload`)
- File uploads (`ReviewFileUploadPayload`)
- Regulatory review forms (`AssessmentFormData`, `SubmissionReviewFormData`)
- Form state types (`FormState<T>`, `FormValidationResult`)

**Key Feature:**
The `ReviewFormData` type properly types the previously untyped `form_data: any` field in database types, replacing JSONB with structured types.

### 3. `api.ts` (488+ lines)

API request and response type contracts for all endpoints.

**Organization by Endpoint Group:**
- Generic wrappers: `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`
- Poll endpoints: GET/POST results, submit votes
- Ranking endpoints: GET/POST rankings
- Wordcloud endpoints: GET/POST word submissions
- Discussion endpoints: CRUD operations, replies, likes
- Document endpoints: CRUD operations, tagging
- Announcements & Milestones: Admin endpoints
- Review submissions: Save, submit, upload files
- Regulatory review: Submissions, assessments, judgments, progress, validation
- Matrix/Prioritization: Data visualization
- Auth: OAuth callback
- Search: Cross-content search
- Health: System health check

**Pattern:**
Each endpoint has:
- `Get/PostEndpointNameRequest` - Incoming request type
- `Get/PostEndpointNameResponse` - Response type
- Proper error handling with `ApiError`
- Pagination support where applicable

### 4. `index.ts` (322+ lines)

Master barrel export file and utility types.

**Contents:**
- Re-exports all types from `database.ts`, `forms.ts`, `api.ts`
- Utility types:
  - `Nullable<T>` - Type or null
  - `Optional<T>` - Type or undefined
  - `Async<T>` - Promise wrapper
  - `DeepPartial<T>` - Recursive optional
  - `DeepReadonly<T>` - Recursive readonly
  - `Awaited<T>` - Extract promise type
  - `ResultType<T, E>` - Success/error union
- API helper types:
  - `ApiHandlerResponse<T>` - Async API handler return
  - `ResponseData<T>` - Extract data from response
  - `QueryParams` - Query string object
  - `RequestHeaders` - HTTP headers object

**Usage:**
```typescript
// Instead of importing from separate files
import type { PollResults, ReviewFormData, ApiResponse } from '@/types'
```

## Type Organization Principles

### 1. Separation of Concerns
- **database.ts** - Only database schema types
- **forms.ts** - Only form/input types
- **api.ts** - Only API contract types
- **index.ts** - Central export point

### 2. No Circular Dependencies
- `database.ts` imports from `forms.ts` (form → db)
- `api.ts` imports from both `database.ts` and `forms.ts`
- `index.ts` imports from all files

### 3. Naming Conventions
- Database types: `PascalCase` (e.g., `Poll`, `ReviewSubmission`)
- Request types: `EndpointNameRequest` (e.g., `SubmitPollRequest`)
- Response types: `EndpointNameResponse` (e.g., `SubmitPollResponse`)
- Payload types: `EntityNamePayload` (e.g., `PollSubmitPayload`)
- Enum-like types: `PascalCase | PascalCase` unions preferred over enums

### 4. Documentation
- Every major type has JSDoc comments
- Complex types include usage examples
- Relationships between types are documented

## Integration with Application

### In Components
```typescript
import type { PollResults, ReviewFormData } from '@/types'

interface PollComponentProps {
  results: PollResults
  onSubmit: (payload: PollSubmitPayload) => Promise<SubmitPollResponse>
}
```

### In API Routes
```typescript
import type { GetPollResultsResponse, ApiError } from '@/types'

export async function GET(req: Request): Promise<Response> {
  const data: GetPollResultsResponse = { success: true, data: results }
  return Response.json(data)
}
```

### In Hooks
```typescript
import type { ApiResponse, PaginatedResponse } from '@/types'

const [data, setData] = useState<PaginatedResponse<Poll> | null>(null)
```

## Type Coverage Goals

### Phase 1 (Current)
- ✅ Database schema types (100%)
- ✅ Form submission types (100%)
- ✅ API endpoint contracts (33+ endpoints)
- ✅ Utility and helper types
- 📈 Target: 85% type coverage across application

### Phase 2 (Security)
- Update `ReviewFormData` to secure data handling
- Type-safe auth/permission checks
- Audit trail types for regulatory compliance

### Phase 3 (Testing)
- Test fixture types
- Mock API response types
- Test helper function types

### Phase 4 (Performance)
- Caching types
- Pagination optimization types
- Rate limiting types

## Common Patterns

### Optional Fields
Use `| null` for nullable fields from database:
```typescript
export interface Document {
  description: string | null  // Nullable
  content?: string           // Optional
}
```

### Union Types for Variants
```typescript
export type Result = 'pass' | 'partial' | 'fail'
export type Status = 'draft' | 'submitted' | 'approved'
```

### Nested Objects
Flatten when possible; use compositional types:
```typescript
// Prefer this
export interface Review {
  submissionId: string
  assessments: Assessment[]  // Not nested Assessment[][]
}

// Over this
export interface Review {
  submission: {
    assessments: Assessment[]
  }
}
```

### Generic Wrappers for Reuse
```typescript
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

// Usage
const pollResponse: ApiResponse<PollResults> = { ... }
const submissionResponse: ApiResponse<ReviewSubmission> = { ... }
```

## Type Checking Configuration

Ensure `tsconfig.json` has strict type checking enabled:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

## Next Steps (Task 1.3+)

1. **API Client Layer** - Use these types to create type-safe API wrapper
2. **Component Props** - Update all component props to use exported types
3. **Hook Return Types** - Type all custom hooks with return types
4. **State Management** - Type Zustand stores or context with these types
5. **Test Types** - Create test fixtures using these types

## Migration Guide

Updating existing code to use new types:

### Before (Any Types)
```typescript
const pollResults: any = await fetchPoll()
const formData: any = formState
const response: any = await submitReview()
```

### After (Typed)
```typescript
import type { PollResults, ReviewFormData, SubmitReviewResponse } from '@/types'

const pollResults: PollResults = await fetchPoll()
const formData: ReviewFormData = formState
const response: SubmitReviewResponse = await submitReview()
```

## Troubleshooting

### Import Not Found
Ensure you're importing from `@/types` (barrel export):
```typescript
// ✅ Correct
import type { PollResults } from '@/types'

// ❌ Wrong
import type { PollResults } from '@/types/database'
```

### Circular Dependency Error
Check the import order:
1. `forms.ts` imports from nothing
2. `database.ts` imports from `forms.ts`
3. `api.ts` imports from both
4. `index.ts` imports from all

### Type Mismatch on API Response
Ensure the response structure matches the type:
```typescript
// If API returns { success, data, error }
export interface GetPollResultsResponse extends ApiResponse<PollResults> {
  userVote?: number
}
```

## Contributing

When adding new types:
1. Determine which file they belong in (database, forms, or api)
2. Follow naming conventions
3. Add JSDoc comments
4. Update barrel export in `index.ts`
5. Add to this README if creating new category
6. Verify types compile: `npx tsc --noEmit`

---

**Phase 1 Status:** ✅ Task 1.1 (Type Foundation) Complete
**Next Task:** 1.3 - Create API Client Layer
**Progress:** 8/70 hours used, 62 hours remaining
