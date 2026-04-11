# 📋 Template Feature Quick Guide

## How It Works - Step by Step

### 🔧 Admin Workflow

#### Step 1: Select Application Type
```
Applications Page → Click "CTPO" (or any application type)
```
✅ You'll see the application type header with "📋 Manage Templates" button

#### Step 2: Open Template Manager
```
Click "📋 Manage Templates" button
```
✅ Modal opens showing:
- **Current Templates** (if any exist)
- **Add New Template** section

#### Step 3: Upload a Template
```
1. Enter Document Type: "Land Title"
2. Enter Title: "Sample Land Title Format"
3. Add Description: "Use this format when submitting your land title"
4. Choose File: [Select PDF/Word/Excel/Image]
5. Click "Upload Template"
```
✅ Template is now available to ALL applicants for this application type

#### Step 4: Manage Existing Templates
```
In the "Current Templates" section, you can:
- Click "👁️ View" to preview any template
- Click "🗑️ Delete" to remove a template
```

---

### 📱 What Applicants See

#### When viewing any applicant's files:

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Available Templates (Download before uploading)          │
├───────────────┬──────────────┬──────────┬───────────────────┤
│ 📄 Land Title │ 📥 sample    │ Template │ 📥 Download       │
│   Sample TCT  │    .pdf      │          │    Template       │
│   Format      │              │          │                   │
├───────────────┼──────────────┼──────────┼───────────────────┤
│ 📄 Tax Decl.  │ 📥 tax_decl  │ Template │ 📥 Download       │
│   Template    │    .docx     │          │    Template       │
├───────────────┴──────────────┴──────────┴───────────────────┤
│          📤 Uploaded Documents                                │
├───────────────┬──────────────┬──────────┬───────────────────┤
│ Land Title    │ my_title.pdf │ Nov 13   │ [View]            │
│               │              │          │                   │
└───────────────┴──────────────┴──────────┴───────────────────┘
```

---

## 💡 Key Points

### ✅ Application-Level (Not Per-Applicant)
- Upload once → Available to ALL applicants
- No need to upload for each individual applicant
- Centralized management

### ✅ Available Before Upload
- Applicants can see templates immediately
- Don't need to upload files first
- Download templates → Prepare documents → Upload

### ✅ Easy Management
- View all templates in one place
- Delete outdated templates easily
- Update templates anytime

---

## 🎯 Example Scenarios

### Scenario 1: New Application Type Setup

**Admin wants to set up CTPO templates:**

1. Click "CTPO Applications"
2. Click "📋 Manage Templates"
3. Upload templates for:
   - Land Title
   - Tax Declaration
   - Barangay Clearance
   - Location Map
   - Affidavit
4. Done! All CTPO applicants can now download these templates

### Scenario 2: Update Template

**Admin needs to update the Land Title template:**

1. Click "CTPO Applications"
2. Click "📋 Manage Templates"
3. In "Current Templates", find "Land Title"
4. Click "🗑️ Delete" on old template
5. Upload new template with same document type "Land Title"
6. Done! All applicants now see the updated template

### Scenario 3: Applicant View

**Applicant starts CTPO application:**

1. Logs in to mobile app
2. Starts new CTPO application
3. Sees "Available Templates" section
4. Downloads "Land Title" template
5. Reviews the format
6. Prepares their own land title document following the template
7. Uploads their completed document
8. Document is in correct format → Faster approval!

---

## 🔐 Access Control

| User Type | Can Upload Templates | Can Delete Templates | Can Download Templates |
|-----------|---------------------|---------------------|------------------------|
| **Admin** | ✅ Yes              | ✅ Yes              | ✅ Yes                 |
| **Forester** | ❌ No            | ❌ No               | ✅ Yes                 |
| **Applicant** | ❌ No           | ❌ No               | ✅ Yes                 |

---

## 📊 Database Structure

### Templates Location:
```
Firestore:
applications/
  └── ctpo/
      └── templates/
          ├── Land Title (document)
          ├── Tax Declaration (document)
          └── Barangay Clearance (document)

Storage:
applications/
  └── ctpo/
      └── templates/
          ├── Land Title/
          │   └── sample_title.pdf
          ├── Tax Declaration/
          │   └── tax_decl_template.docx
          └── Barangay Clearance/
              └── clearance_format.pdf
```

---

## ⚠️ Important Notes

1. **Document Type as ID**: The document type you enter becomes the unique ID for that template
   - Use consistent naming (e.g., always "Land Title", not "land title" or "LandTitle")
   - Uploading with same document type will overwrite the existing template

2. **File Size**: Keep template files reasonable in size
   - Recommended: Under 5MB
   - Large files take longer for applicants to download

3. **File Format**: Use common formats
   - PDF (most universal)
   - Word/Excel (editable)
   - Images (for visual examples)

4. **Delete Carefully**: Deleting a template removes it for ALL applicants
   - Always confirm before deleting
   - Consider updating instead of deleting

5. **Clear Descriptions**: Add helpful descriptions
   - Explain what the template is for
   - Mention any special notes or requirements

---

## 🚀 Quick Tips

✨ **Best Practices:**
- Upload templates BEFORE accepting applications
- Use clear, descriptive document type names
- Keep templates updated with current requirements
- Test templates by downloading them yourself
- Get feedback from applicants about template clarity

✨ **Naming Conventions:**
- Use title case: "Land Title" not "land title"
- Be specific: "Certified True Copy of Tax Declaration" not "Tax Dec"
- Use consistent names across all application types

✨ **Template Content:**
- Include clear instructions within the template
- Show examples with annotations
- Highlight required fields
- Use placeholder text that's obvious (e.g., [YOUR NAME HERE])

---

## 📞 Support

If you encounter issues:
1. Check that you selected the correct application type
2. Verify file format is supported
3. Ensure file size is reasonable
4. Try refreshing the page
5. Contact system administrator if problem persists
