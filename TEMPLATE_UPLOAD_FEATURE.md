# 📤 Application-Level Template Upload Feature

## Overview
Admins can now upload template files at the **application type level** that ALL applicants can download as references **before** submitting their documents. Templates are shared across all applicants for a specific application type (CTPO, PLTP, etc.).

## Features Added

### 1. **Manage Templates Button**
- Located at the application type header (next to the application type title)
- Visible when viewing any application type
- Button: � Manage Templates

### 2. **Template Management Modal**
The modal provides two main sections:

#### **Current Templates Section**
- Displays all existing templates for the selected application type
- Shows document type, title, description, file name, upload date, and uploader
- Each template has:
  - 👁️ **View** button - Opens template in new tab
  - 🗑️ **Delete** button - Removes template (with confirmation)

#### **Add New Template Section**
The upload form allows admins to:
- Enter a **Document Type/Label** (e.g., "Land Title", "Tax Declaration")
- Enter a descriptive **Title** for the template
- Add an optional **Description**
- Upload the template file (PDF, Word, Excel, or Images)

### 3. **Template Storage**
Templates are stored in:
- **Firebase Storage**: `applications/{appType}/templates/{documentType}/{fileName}`
- **Firestore**: `applications/{appType}/templates/{documentType}`

Metadata saved includes:
- `documentType`: The document type/label
- `title`: Template title
- `description`: Optional description
- `fileName`: Original file name
- `url`: Download URL from Firebase Storage
- `uploadedAt`: Timestamp
- `uploadedBy`: Admin email

### 4. **Template Display for Applicants**
When admins view an applicant's files:
- **Templates section appears first** at the top of the files table
- Shows all available templates with green highlight
- Each template displays:
  - Document type and title
  - Description (if provided)
  - File name with 📥 icon
  - "📥 Download Template" button
- A separator divides templates from uploaded documents

### 5. **Template Access**
**All applicants** can see and download templates:
- Templates are visible even if applicant hasn't uploaded any files yet
- No need to select specific applicants or documents
- One template applies to all applicants for that document type
- Templates are accessible from the mobile app (when integrated)

## How to Use

### For Admins:

1. **Navigate to Application Type**
   - Click on an application type (CTPO, PLTP, SPLT, etc.)
   - You'll see the "📋 Manage Templates" button next to the title

2. **Manage Templates**
   - Click "� Manage Templates"
   - View all existing templates for this application type
   - You can view or delete existing templates

3. **Upload a New Template**
   - In the "Add New Template" section:
   - Enter **Document Type** (e.g., "Land Title", "Barangay Clearance")
   - Enter a **Template Title** (e.g., "Sample Land Title Format")
   - Optionally add a **Description** explaining what the template is for
   - Choose the template file from your computer
   - Click "Upload Template"

4. **Supported File Types**
   - PDF (.pdf)
   - Word Documents (.doc, .docx)
   - Excel Spreadsheets (.xls, .xlsx)
   - Images (.jpg, .jpeg, .png)

5. **View Templates in Applicant Files**
   - Select any applicant
   - Templates appear at the top of their files table
   - All applicants see the same templates

### For Applicants:

1. When viewing application requirements, templates appear at the top
2. Click "📥 Download Template" to download any template
3. Use the template as a guide for preparing their document
4. Upload their completed document following the template format
5. Templates are available before and after file uploads

## Benefits

✅ **Universal Access**: One template for all applicants of that type  
✅ **Early Access**: Applicants can download templates before starting their application  
✅ **Consistency**: Ensures all applicants follow the same format  
✅ **Efficiency**: No need to upload templates for each individual applicant  
✅ **Easy Management**: Add, view, or delete templates from one central location  
✅ **Better Organization**: Templates are clearly separated from uploaded documents  
✅ **Time-Saving**: Applicants know exactly what format is expected  

## Technical Details

### File Structure
```
applications/
  └── {applicationType}/
      ├── templates/
      │   └── {documentType} (document)
      │       ├── documentType
      │       ├── title
      │       ├── description
      │       ├── fileName
      │       ├── url
      │       ├── uploadedAt
      │       └── uploadedBy
      └── applicants/
          └── {applicantId}/
              └── uploads/...
```

### Code Changes

1. **application.js**
   - Added `displayApplicationTemplates()` function to show templates at top of files table
   - Rewrote `initTemplateModal()` to work with application-level templates
   - Added `loadExistingTemplates()` to display and manage existing templates
   - Modified `loadApplicants()` to show application type header with manage button
   - Modified `showApplicantFiles()` to call `displayApplicationTemplates()` first
   - Added deleteDoc import for template deletion
   - Removed per-applicant template checking code

2. **applications.html**
   - Added application type header with "Manage Templates" button
   - Redesigned template modal with two sections:
     - Current templates list with view/delete actions
     - New template upload form
   - Moved manage button to application type level (not per-applicant)

## Example Use Case

### CTPO Application Templates:

Admin uploads these templates for CTPO:
- **Land Title** - "Sample TCT/OCT Format"
- **Tax Declaration** - "Tax Declaration Template"
- **Barangay Clearance** - "Clearance Format Example"
- **Location Map** - "Sample Property Map"

All CTPO applicants can now:
1. See these 4 templates before uploading anything
2. Download any template they need
3. Prepare their documents following the template
4. Submit their completed documents

## Future Enhancements

Potential improvements:
- Template versioning system
- Template preview without downloading
- Template usage analytics (download counts)
- Template categories/tags
- Bulk template upload
- Template approval workflow
- Copy templates between application types
