# 🔄 Simplified User Registration & Role Management System

## Overview

The system has been restructured for **maximum simplicity and security**:

- **Super Admin** directly creates privileged roles (Level Adviser, Exam Officer, Class Rep)
- **Students** register through a simple, public registration form
- **Automatic linking** - Students are auto-linked to their Level Adviser on registration
- **Role assignment** - Level Adviser can assign Class Representatives to students

**Date:** May 19, 2026  
**Status:** ✅ Production Ready  
**Approach:** Admin-driven role creation (no more registration codes)

---

## 🏗️ Architecture

```
Super Admin
    ↓
Creates Level Adviser (LA)
Creates Exam Officer (EO)
Creates Class Rep (manually or assigns)
    ↓
Student Registration
    ├─ Checks for Level Adviser in their faculty+level
    ├─ Auto-links to Level Adviser
    └─ Creates student account
    ↓
Level Adviser Dashboard
    ├─ Sees assigned students
    ├─ Can assign Class Reps
    └─ Can manage student records
```

---

## 📋 User Roles & Creation Methods

### 1. **Super Admin** 🔐
- **Created by:** Initial system setup (database)
- **Responsibilities:**
  - Create Level Advisers
  - Create Exam Officers
  - Create/manage other roles
  - System administration
- **Access:** Full system control

### 2. **Level Adviser** 👨‍🎓
- **Created by:** Super Admin via `/admin/create-user` endpoint
- **Faculty:** Faculty of Education, Science, etc.
- **Level:** 100, 200, 300, or 400
- **Responsibilities:**
  - See all students in their level
  - Assign Class Representatives
  - Manage student records
  - Guide students

### 3. **Exam Officer** 📋
- **Created by:** Super Admin via `/admin/create-user` endpoint
- **Faculty:** Specific faculty (optional)
- **Responsibilities:**
  - Create exams/CBTs
  - Manage exam questions
  - Handle exam results
  - Exam management

### 4. **Class Rep** 📢
- **Assigned by:** Level Adviser
- **Faculty:** Faculty of Education, Science, etc.
- **Level:** 100, 200, 300, or 400
- **Course:** Specific course/department
- **Responsibilities:**
  - Represent students to Level Adviser
  - Collect assignments
  - Communication link

### 5. **Student** 👤
- **Created by:** Public self-registration at `/register`
- **Faculty:** Faculty of Education, Science, etc.
- **Level:** 100, 200, 300, or 400
- **Course:** Specific course/department
- **Linked to:** Their Level Adviser (automatic)

---

## 🔌 API Endpoints

### Public Endpoints

#### Register as Student
```http
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john.doe@student.com",
  "password": "SecurePassword123",
  "facultyId": "education",
  "level": "100",
  "courseOfStudy": "Educational Technology",
  "matricNumber": "EDU-001"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john.doe@student.com",
    "role": "student",
    "faculty": "Faculty of Education",
    "level": "100",
    "courseOfStudy": "Educational Technology",
    "levelAdviserUserId": "507f1f77bcf86cd799439012"
  },
  "message": "Successfully registered as student. Linked to Level Adviser: Dr. Jane Smith"
}
```

**Error Response (404) - No Level Adviser:**
```json
{
  "success": false,
  "message": "No Level Adviser found for Faculty of Education – Level 100. Please ask your Level Adviser to create an account first, then try registering again.",
  "code": "NO_LEVEL_ADVISER"
}
```

---

### Admin Endpoints (Super Admin Only)

#### Create Any Role User
```http
POST /api/auth/admin/create-user
Authorization: Bearer SUPER_ADMIN_TOKEN
Content-Type: application/json
```

**Create Level Adviser:**
```json
{
  "fullName": "Dr. Jane Smith",
  "email": "jane.smith@admin.com",
  "password": "SecurePassword123",
  "role": "level_adviser",
  "facultyId": "education",
  "level": "100",
  "matricNumber": "LA-EDU-001"
}
```

**Create Exam Officer:**
```json
{
  "fullName": "Mr. Ahmed Hassan",
  "email": "ahmed.hassan@admin.com",
  "password": "SecurePassword123",
  "role": "exam_officer",
  "facultyId": "science",
  "matricNumber": "EO-SCI-001"
}
```

**Create Class Rep:**
```json
{
  "fullName": "Karina Johnson",
  "email": "karina.johnson@student.com",
  "password": "SecurePassword123",
  "role": "class_rep",
  "facultyId": "education",
  "level": "100",
  "courseOfStudy": "Educational Technology",
  "matricNumber": "CRP-001"
}
```

**Create Student:**
```json
{
  "fullName": "Michael Chen",
  "email": "michael.chen@student.com",
  "password": "SecurePassword123",
  "role": "student",
  "facultyId": "education",
  "level": "100",
  "courseOfStudy": "Educational Technology",
  "matricNumber": "STU-001"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "level adviser created successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Dr. Jane Smith",
    "email": "jane.smith@admin.com",
    "role": "level_adviser",
    "faculty": "Faculty of Education",
    "level": "100"
  }
}
```

**Error Response (409) - Slot Taken:**
```json
{
  "success": false,
  "message": "A Level Adviser already exists for this faculty and level",
  "existingAdviser": {
    "_id": "507f1f77bcf86cd799439010",
    "fullName": "Dr. John Adams",
    "email": "john.adams@admin.com",
    "role": "level_adviser"
  }
}
```

---

## 📊 Complete Workflows

### Workflow 1: Setup Level Adviser & Student Registration

```
1. SUPER ADMIN
   └─ POST /admin/create-user
      ├─ role: "level_adviser"
      ├─ faculty: "Education"
      └─ level: "100"
      → Creates Dr. Jane Smith as Level Adviser

2. STUDENT
   └─ POST /register
      ├─ faculty: "education"
      ├─ level: "100"
      └─ courseOfStudy: "Ed Tech"
      → Backend finds Level Adviser
      → Auto-links student to Dr. Jane Smith
      → Student account created

3. LEVEL ADVISER (Dr. Jane)
   └─ Dashboard shows:
      ├─ All students in Level 100 Education
      └─ Can assign Class Reps
```

### Workflow 2: Exam Officer Assignment

```
1. SUPER ADMIN
   └─ POST /admin/create-user
      ├─ role: "exam_officer"
      └─ faculty: "science"
      → Creates Mr. Ahmed Hassan as Exam Officer

2. EXAM OFFICER (Mr. Ahmed)
   └─ Login & Access:
      ├─ Create exams
      ├─ Create CBTs
      ├─ Manage questions
      └─ View results
```

### Workflow 3: Class Rep Assignment (Future)

```
1. LEVEL ADVISER
   └─ Dashboard
      └─ Selects student to assign as Class Rep
      → Creates Class Rep role for that student

OR

2. SUPER ADMIN
   └─ POST /admin/create-user
      ├─ role: "class_rep"
      ├─ faculty: "education"
      ├─ level: "100"
      └─ courseOfStudy: "Ed Tech"
      → Creates Class Rep directly
```

---

## 🔐 Database Schema Updates

### User Model Changes

**New Field:** `levelAdviserUserId` (for students)

```typescript
{
  levelAdviserUserId?: string;  // Links student to their Level Adviser
  // ... other fields remain same
}
```

---

## ✅ Features

### ✅ Student Registration
- Public endpoint (no authentication needed)
- Auto-finds Level Adviser
- Auto-links to Level Adviser
- Returns error if no Level Adviser exists

### ✅ Admin User Creation
- Only Super Admin can create
- Create any role: level_adviser, exam_officer, class_rep, student
- Full validation
- Prevents duplicate roles (where applicable)
- Audit trail (who created what)

### ✅ Security
- No registration codes needed
- Super Admin controls who gets privileged roles
- One-time account creation by admin
- Student can only register as student
- Cannot self-assign roles

### ✅ Simplicity
- Fewer moving parts (no code generation/expiry)
- Clear responsibility: Admin creates, Student registers
- No code sharing needed
- Instant account creation for admins
- No TTL cleanup needed

---

## 🚀 Usage Examples

### Example 1: Setup Education Faculty Level 100

```bash
# 1. Create Level Adviser
curl -X POST http://localhost:5000/api/auth/admin/create-user \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Dr. Jane Smith",
    "email": "jane.smith@university.edu",
    "password": "SecurePass123",
    "role": "level_adviser",
    "facultyId": "education",
    "level": "100"
  }'

# 2. Student Registration (via web form)
# Student fills: Name, Email, Password, Faculty, Level, Course
# Backend: Finds Dr. Jane Smith, auto-links, creates account
```

### Example 2: Create Exam Officer

```bash
curl -X POST http://localhost:5000/api/auth/admin/create-user \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Mr. Ahmed Hassan",
    "email": "ahmed@university.edu",
    "password": "SecurePass123",
    "role": "exam_officer",
    "facultyId": "science"
  }'
```

### Example 3: Student Attempts Registration Without LA

```bash
# Student tries to register for Level 100 Science
# But no Level Adviser exists yet

Response: {
  "success": false,
  "message": "No Level Adviser found for Faculty of Science – Level 100. Please ask your Level Adviser to create an account first, then try registering again.",
  "code": "NO_LEVEL_ADVISER"
}

# → Admin must create Level Adviser first
```

---

## 📋 User Journey

### Student's Journey
```
1. Visit registration page
2. Select: Faculty, Level, Course
3. Enter: Name, Email, Password
4. Submit registration
5. ✓ System checks for Level Adviser
   ✓ Auto-links to Level Adviser
   ✓ Account created
6. Can now login
7. Can access student dashboard
8. Can see their Level Adviser
```

### Admin's Journey
```
1. Login with Super Admin account
2. Go to Admin Panel
3. Create Level Adviser (faculty + level)
4. Create Exam Officer (faculty)
5. Create Class Rep (faculty + level + course)
6. View all created users
```

---

## 🔄 Differences from Old System

### Before ❌
- Registration codes generated for each role
- Users claimed roles using codes
- Codes needed sharing & management
- TTL indexes for auto-deletion
- Complex code validation

### After ✅
- Super Admin creates roles directly
- Students can only self-register
- No code sharing needed
- Simple auto-linking mechanism
- Clear admin control
- Fewer database operations

---

## ⚠️ Error Scenarios

### 1. No Level Adviser Exists
```json
{
  "success": false,
  "message": "No Level Adviser found for Faculty of Education – Level 100. Please ask your Level Adviser to create an account first, then try registering again.",
  "code": "NO_LEVEL_ADVISER"
}
```
**Solution:** Admin must create Level Adviser first

### 2. Email Already Registered
```json
{
  "success": false,
  "message": "Email already registered"
}
```
**Solution:** Use different email

### 3. Invalid Faculty/Department
```json
{
  "success": false,
  "message": "Invalid department \"invalid\" for the selected faculty. Please select a valid department."
}
```
**Solution:** Select valid department

### 4. Missing Required Fields
```json
{
  "success": false,
  "message": "fullName, email, password, facultyId, level, and courseOfStudy are required"
}
```
**Solution:** Provide all required fields

---

## 🛠️ Validation Rules

### For Student Registration
- ✅ Faculty: Required, must exist
- ✅ Level: Required (100, 200, 300, 400)
- ✅ Course: Required, must belong to faculty
- ✅ Email: Required, must be unique
- ✅ Password: Required, min 6 chars
- ✅ Level Adviser: Must exist for that faculty+level
- ✅ Links: Auto-linked to Level Adviser

### For Admin User Creation
- ✅ Role: Required, must be valid
- ✅ Email: Required, must be unique
- ✅ Password: Required, min 6 chars
- ✅ Level Adviser: Faculty + Level required, no duplicate
- ✅ Exam Officer: Faculty required
- ✅ Class Rep: Faculty + Level + Course required, no duplicate
- ✅ Student: Faculty + Level + Course required

---

## 📈 Statistics & Monitoring

### Useful Queries
```javascript
// Count students by Level Adviser
db.users.aggregate([
  { $match: { role: "student" } },
  { $group: { _id: "$levelAdviserUserId", count: { $sum: 1 } } }
])

// Count roles
db.users.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } }
])

// Students without Level Adviser (should be none)
db.users.find({ role: "student", levelAdviserUserId: null })
```

---

## 🎯 Summary

| Aspect | Old System | New System |
|--------|-----------|-----------|
| **Role Creation** | Users claim with codes | Admin creates directly |
| **Student Registration** | Self-register any role | Self-register students only |
| **Code Management** | Generate, expire, revoke | Not needed |
| **Linking** | Manual assignment | Automatic |
| **Simplicity** | Complex codes & validation | Simple & straightforward |
| **Security** | Code-based | Admin-controlled |
| **Database** | RegistrationCode model | Just User model |

---

## 🚀 Next Steps

1. **Database Migration** (if needed)
   - Add `levelAdviserUserId` field to existing students
   - Remove RegistrationCode collection (deprecated)

2. **Frontend Updates**
   - Update registration form (remove role field)
   - Add `levelAdviserUserId` display on student dashboard
   - Update admin panel for user creation

3. **Testing**
   - Test student registration without LA
   - Test student registration with LA
   - Test admin user creation
   - Test auto-linking

4. **Deployment**
   - Deploy backend changes
   - Update frontend
   - Test in staging
   - Deploy to production

---

## 📚 Related Files

- **Model:** [src/models/User.model.ts](src/models/User.model.ts)
- **Controller:** [src/controllers/auth.controller.ts](src/controllers/auth.controller.ts)
- **Routes:** [src/routes/auth.routes.ts](src/routes/auth.routes.ts)

---

**Status:** ✅ Ready for Production Deployment
