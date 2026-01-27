# 🌊 CEW vs. Authenticated User Data Flow

## 📌 Overview

The SSTAC Dashboard handles data through two primary pathways to accommodate both registered committee members (TWG/SSTAC) and anonymous conference attendees (CEW). Understanding the technical distinction between these paths is critical for debugging poll results, matrix graphs, and admin panel filters.

---

## 🔐 1. Authenticated Path (TWG/SSTAC)

This path is used for users who log in via the standard authentication system.

### **Authentication Mechanism**
- **System**: Supabase Auth (JWT).
- **User Identification**: A persistent, unique UUID assigned to each registered user.
- **Access Control**: Row Level Security (RLS) ensures users can only view or modify their own data.

### **Data Flow Behavior**
- **Persistence**: Votes are linked to the user's UUID.
- **Update Logic (Upsert)**: "One User, One Vote." When an authenticated user submits a poll multiple times, their previous response is **overwritten**.
- **Context**: Used on `/survey-results/*` pages.

---

## 🕵️ 2. CEW Path (Conference/Anonymous)

This path is used for anonymous conference attendees who use a common access code (e.g., `CEW2025`) rather than a personal login.

### **Authentication Mechanism**
- **System**: Code-based entry (not a true "login").
- **User Identification**: 
  - **Primary**: `x-session-id` header (sent by the frontend, typically a fingerprint or session-specific UUID).
  - **Fallback**: Generated timestamp-based ID: `CEW2025_session_{timestamp}_{random}`.
- **Backend Generator**: `generateCEWUserId()` in `src/lib/supabase-auth.ts`.

### **Data Flow Behavior**
- **Persistence**: Votes are stored with a generated user ID starting with `CEW2025_`.
- **Update Logic (Additive)**: "One Session, One Vote." Each unique session creates a **new** response record. Existing responses are **never deleted or overwritten**.
- **Context**: Used on `/cew-polls/*` pages.

---

## 🛠️ Technical Implementation Details

### **Identification Logic**
The backend determines the user identity using the following priority:

```typescript
// Simplified logic from src/lib/supabase-auth.ts
export function generateCEWUserId(authCode: string = 'CEW2025', sessionId?: string | null): string {
  if (sessionId) {
    // If frontend provides x-session-id, use it to group multiple question responses together
    return `${authCode}_${sessionId}`;
  }
  
  // Fallback for one-off submissions without a session
  return `${authCode}_session_${Date.now()}_${Math.random()}`;
}
```

### **API Route Handling**
API routes (e.g., `/api/polls/submit`) detect the path based on the `page_path` parameter:
1. If `page_path` starts with `/cew-polls/`, it uses the **Anonymous Path**.
2. Otherwise, it attempts to fetch the **Authenticated User** via the Supabase JWT.

---

## 📊 Admin Panel Aggregation (The "Combined" View)

The Admin Panel (`/admin/poll-results`) is the only location where these two paths converge.

### **Filtering Logic**
- **"All Responses"**: Aggregates both UUID-based records and `CEW2025_`-prefixed records.
- **"TWG Only"**: Filters for records where `user_id` is a valid UUID (not starting with `CEW`).
- **"CEW Only"**: Filters for records where `user_id` starts with `CEW`.

### **Matrix Graph Challenges**
Matrix graphs (Importance vs. Feasibility) require **paired responses**. 
- **Authenticated Users**: The pairing is simple because there is only one response per user per question.
- **CEW Users**: The system must pair responses by the generated `user_id`. This is why consistent `x-session-id` headers are vital; without them, Q1 and Q2 from the same person would have different `user_id`s and wouldn't appear on the matrix graph.

---

## 🧪 K6 Testing Implications

To simulate realistic CEW traffic, K6 tests **must** send a unique `x-session-id` for each virtual user (VU).
- **Correct**: `headers: { 'x-session-id': 'test-session-' + __VU }`
- **Incorrect**: Sending no header (causes every question response to get a random ID, breaking matrix graph pairing).

---

## 📖 Summary Table

| Feature | Authenticated (TWG) | Anonymous (CEW) |
| :--- | :--- | :--- |
| **Login Required** | Yes | No (Access Code Only) |
| **User ID** | persistent UUID | `CEW2025_{session_id}` |
| **Duplicate Submissions** | Overwrites (Upsert) | Adds New (Additive) |
| **Data Source** | `/survey-results/*` | `/cew-polls/*` |
| **Primary Identifier** | Supabase Auth Token | `x-session-id` Header |

