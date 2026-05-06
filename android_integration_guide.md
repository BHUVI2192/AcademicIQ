# Technical Integration Guide: AcademeIQ Parent Portal (End-to-End)

This guide provides a comprehensive technical blueprint for integrating the AcademeIQ Android application with the existing Supabase backend. It ensures parity with the Web portal's standardized authentication and data access patterns.

---

## 1. Authentication Architecture (Standardized)

The Parent Portal uses a "Phone-First" identity model. While parents enter their phone numbers, the backend utilizes an internal email format to maintain identity integrity across the platform.

### A. Identifier Normalization
All authentication calls must use the normalized internal email.

- **Normalization Logic**: 
  1. Strip all non-digit characters from the phone number.
  2. Prepend `parent.` and append `@academeiq.net`.
- **Example**:
  - Input: `+91 96633 33141`
  - Internal Email: `parent.919663333141@academeiq.net`

### B. Login Flow
Use the standard Supabase `signInWithPassword` method.

```dart
// Android / Flutter Pseudo-code
final String normalizedEmail = "parent.${phone.replaceAll(RegExp(r'\D'), '')}@academeiq.net";
final AuthResponse res = await supabase.auth.signInWithPassword(
  email: normalizedEmail,
  password: password,
);
```

### C. Account Verification (RPC)
Before prompting for a password, verify if the parent exists and is authorized to log in.
- **RPC Function**: `check_parent_login_allowed`
- **Parameter**: `p_phone` (The raw or normalized phone number)
- **Returns**: Boolean and basic metadata.

---

## 2. Password Recovery (Self-Healing)

The recovery system is designed to be "self-healing," meaning it automatically repairs account mismatches (e.g., if a parent was registered with a personal email instead of the internal identifier).

### A. Requesting a Temporary Password
The app should trigger the `recover-password` Edge Function.
- **Endpoint**: `https://[PROJECT_REF].functions.supabase.co/recover-password`
- **Method**: `POST`
- **Body**: `{ "phone": "+919663333141" }`
- **Backend Action**: 
  1. Validates the parent in the `parents` table.
  2. Generates an 8-character temporary password.
  3. Updates the `auth.users` record to the correct `parent.[digits]@academeiq.net` identifier.
  4. Emails the temporary password to the parent's linked recovery email (SMTP).

### B. Finalizing Password Change
Once the parent logs in with the temporary password, the app **MUST** detect the `temp_password_set` flag in the profile and force a password update.
```dart
await supabase.auth.updateUser(
  UserAttributes(password: 'new_secure_password')
);
```

---

## 3. Data Schema & Access Patterns

### A. Linking Parents to Students
Parents can have multiple children. Data access is controlled via Row Level Security (RLS) on the `parent_student_map` table.

- **Query Pattern**:
```sql
-- Fetch all verified children linked to the logged-in parent
SELECT 
  s.id, 
  s.full_name, 
  s.roll_number, 
  b.name as batch_name
FROM parent_student_map m
JOIN students s ON m.student_id = s.id
JOIN batches b ON s.batch_id = b.id
WHERE m.parent_id = auth.uid() 
  AND m.is_verified = true;
```

### B. Academic Performance Data
Once a `student_id` is selected, fetch rankings and marks.

| Information | Table | Important Filters |
| :--- | :--- | :--- |
| **Rankings** | `rankings` | `student_id`, `is_published = true` (join `tests`) |
| **Subject Marks** | `marks` | `student_id`, `test_id` |
| **Test Metadata** | `tests` | `id`, `is_published = true` |

**Ranking Logic**: Use the `rankings` table rather than calculating on-the-fly. The `rank` and `percentage` fields are pre-computed by the system for accuracy.

---

## 4. Integration Checklist

- [ ] **Normalize Phone**: Ensure non-digits are stripped before auth calls.
- [ ] **Internal Email**: Use the `parent.[digits]@academeiq.net` format for all `auth` service interactions.
- [ ] **Edge Function Auth**: Include the `anon` key or user `JWT` when calling `recover-password`.
- [ ] **State Management**: Persist the `selectedChildId` locally to avoid redundant selection screens.
- [ ] **Security**: Ensure all data queries are scoped to the `student_id` obtained from the verified map.

---

## 5. Visual Standards (Aesthetic Parity)
To match the Web Portal's premium editorial feel:
- **Font**: Use **Outfit** or **Inter** (Medium weight for headers, Light/Regular for body).
- **Colors**:
  - Background: `#f8fafc` (Slate 50) or Glassmorphic cards.
  - Primary Text: `#0f172a` (Slate 900).
  - Accents: Subtle gradients or thin borders (`1px`).
- **Layout**: High whitespace, minimalist cards, and smooth transitions.
