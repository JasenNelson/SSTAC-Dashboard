# Structured Logging Test Guide

**Test:** Verify structured logging works correctly in admin operations

---

## 🧪 **Quick Test Steps**

### **Test 1: Trigger a Database Error (BETTER TEST)**

**The duplicate tag test doesn't log because it's a validation check. Try this instead:**

**Option A: Trigger actual database constraint error**
1. **Navigate to** `/admin/tags`
2. **Try to create a tag with invalid data** that would pass Zod validation but fail at database level
3. **Or try deleting a tag that's in use by documents** - This should trigger a database error

**Option B: Test with a different operation that has database errors**
1. **Navigate to** `/admin/announcements`
2. **Try operations** that might cause database errors
3. **Check terminal** for structured logs

### **Test 1b: Understanding the Duplicate Tag Result**

**What happened:**
- ✅ **Validation working:** Duplicate tag was detected (good!)
- ✅ **Error handling working:** User-friendly error message shown (good!)
- ⚠️ **Not a database error:** The duplicate check happens before database insert, so it doesn't trigger the logger
- ✅ **Structured logging:** Would trigger on actual database errors or unexpected exceptions

**For structured logging test, we need a different scenario...**

```json
{
  "timestamp": "2025-01-31T12:34:56.789Z",
  "level": "error",
  "message": "Error creating tag",
  "operation": "createTag",
  "tagName": "Test Tag",
  "error": "...",
  "errorName": "...",
  "errorMessage": "...",
  "errorStack": "..."
}
```

**What to look for:**
- ✅ JSON format (prettified in development)
- ✅ Includes `timestamp`, `level`, `message`
- ✅ Includes `operation` context (e.g., "createTag")
- ✅ Includes error details (`errorName`, `errorMessage`, `errorStack`)
- ✅ Includes relevant context (e.g., `tagName`)

---

### **Test 2: Trigger Update Error**

1. **Navigate to** `/admin/tags`
2. **Try to update a tag** with an invalid UUID (if editing through API directly)
3. **Or try to update a tag that doesn't exist** (if possible through UI)
4. **Check terminal** for structured error log

---

### **Test 3: Trigger Delete Error**

**If you have a tag that's in use:**

1. **Navigate to** `/admin/tags`
2. **Try to delete a tag** that's assigned to documents
3. **Check terminal** for structured error log with context

---

## ✅ **Expected Results**

### **Development Mode:**
- Logs should be **prettified JSON** (readable, indented)
- Should include full context
- Should be easy to read in terminal

### **Example Development Log (for database errors):**
```json
{
  "timestamp": "2025-01-31T12:34:56.789Z",
  "level": "error",
  "message": "Error deleting tag",
  "operation": "deleteTag",
  "tagId": "123",
  "errorName": "PostgresError",
  "errorMessage": "foreign key constraint violation",
  "errorStack": "..."
}
```

**Note:** Duplicate tag detection happens before database insert, so it doesn't trigger structured logging. That's actually correct behavior - it's a business logic validation, not a database error.

---

## 📝 **What to Verify**

- [ ] Errors are logged in JSON format
- [ ] Logs include timestamp
- [ ] Logs include error level ("error")
- [ ] Logs include operation context (e.g., "createTag", "updateTag")
- [ ] Logs include relevant IDs/names (e.g., tagName, tagId)
- [ ] Logs include error details (errorName, errorMessage)
- [ ] Development logs are readable (prettified)

---

## 🔍 **Where to Check**

**Development:**
- Check the terminal where `npm run dev` is running
- Look for console.error output with JSON structure

**Production:**
- Check your log aggregation service (if configured)
- Logs will be compact JSON (single line) in production

---

## ✅ **Success Criteria**

If you see structured JSON logs in your terminal with:
- ✅ Proper JSON format
- ✅ Timestamp, level, message
- ✅ Operation context
- ✅ Error details
- ✅ Relevant IDs/names

Then structured logging is working correctly! ✅

