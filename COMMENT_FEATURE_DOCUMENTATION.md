# 💬 Comment & Reupload Feature Documentation

## Overview
The comment feature allows admins to review applicant documents, leave feedback, and request reuploads when documents need corrections. This creates a two-way communication system for document review.

---

## 🔧 How It Works (Admin Side)

### Step 1: Admin Reviews Documents
1. Admin navigates to Applications page
2. Selects an application type (CTPO, PLTP, etc.)
3. Clicks on an applicant's folder
4. Reviews uploaded documents

### Step 2: Admin Adds Comment
1. Clicks "Comment" button
2. Selects one or more documents to comment on
3. Enters a comment explaining what needs to be corrected
4. Clicks "Send Comment"

### Step 3: System Updates
When a comment is sent:
- Document is flagged with `reuploadAllowed: true`
- Comment is saved to Firestore
- Document shows 🔄 icon (indicating reupload allowed)
- Applicant can now see the comment and reupload

---

## 📊 Database Structure

### Document Structure After Comment

```
Firestore Path:
applications/
  └── {applicationType}/        (e.g., "ctpo", "pltp")
      └── applicants/
          └── {applicantId}/     (user's ID)
              └── uploads/
                  └── {documentId}/    (e.g., "Land Title", "Tax Declaration")
                      ├── (document fields)
                      │   ├── title: "Land Title"
                      │   ├── fileName: "my_title.pdf"
                      │   ├── url: "https://storage..."
                      │   ├── uploadedAt: Timestamp
                      │   ├── reuploadAllowed: true    ⬅️ SET BY COMMENT
                      │   └── lastCommentAt: Timestamp ⬅️ SET BY COMMENT
                      │
                      └── comments/           ⬅️ SUBCOLLECTION
                          └── {commentId}/    (auto-generated)
                              ├── message: "Please provide a clearer copy..."
                              ├── from: "admin@example.com"
                              └── createdAt: Timestamp
```

---

## 🔍 Reading Comments (Applicant Side)

### Method 1: Check Single Document for Comments

```javascript
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

async function checkDocumentComments(applicationType, applicantId, documentId) {
  try {
    // First, check if reupload is allowed
    const docRef = doc(
      db,
      "applications",
      applicationType,
      "applicants",
      applicantId,
      "uploads",
      documentId
    );
    
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log("Document not found");
      return null;
    }
    
    const docData = docSnap.data();
    const reuploadAllowed = docData.reuploadAllowed || false;
    
    if (!reuploadAllowed) {
      console.log("No reupload needed for this document");
      return { hasComments: false, reuploadAllowed: false };
    }
    
    // If reupload is allowed, fetch comments
    const commentsRef = collection(
      db,
      "applications",
      applicationType,
      "applicants",
      applicantId,
      "uploads",
      documentId,
      "comments"
    );
    
    const commentsSnap = await getDocs(commentsRef);
    
    if (commentsSnap.empty) {
      return { 
        hasComments: false, 
        reuploadAllowed: true,
        comments: [] 
      };
    }
    
    // Get all comments
    const comments = [];
    commentsSnap.forEach((commentDoc) => {
      const commentData = commentDoc.data();
      comments.push({
        id: commentDoc.id,
        message: commentData.message,
        from: commentData.from,
        createdAt: commentData.createdAt?.toDate() || null,
      });
    });
    
    // Sort by newest first
    comments.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt - a.createdAt;
    });
    
    return {
      hasComments: true,
      reuploadAllowed: true,
      comments: comments,
      documentData: docData
    };
    
  } catch (error) {
    console.error("Error checking document comments:", error);
    return null;
  }
}

// Usage Example:
const result = await checkDocumentComments("ctpo", "user123", "Land Title");

if (result && result.hasComments) {
  console.log("📝 Comments found:", result.comments.length);
  result.comments.forEach(comment => {
    console.log(`From: ${comment.from}`);
    console.log(`Message: ${comment.message}`);
    console.log(`Date: ${comment.createdAt?.toLocaleString()}`);
  });
}
```

### Method 2: Check All Documents for Comments

```javascript
async function getAllDocumentsWithComments(applicationType, applicantId) {
  try {
    const uploadsRef = collection(
      db,
      "applications",
      applicationType,
      "applicants",
      applicantId,
      "uploads"
    );
    
    const uploadsSnap = await getDocs(uploadsRef);
    
    if (uploadsSnap.empty) {
      return [];
    }
    
    const documentsWithComments = [];
    
    for (const uploadDoc of uploadsSnap.docs) {
      const docData = uploadDoc.data();
      const docId = uploadDoc.id;
      
      // Only check documents with reuploadAllowed flag
      if (docData.reuploadAllowed === true) {
        // Fetch comments for this document
        const commentsRef = collection(
          db,
          "applications",
          applicationType,
          "applicants",
          applicantId,
          "uploads",
          docId,
          "comments"
        );
        
        const commentsSnap = await getDocs(commentsRef);
        const comments = [];
        
        commentsSnap.forEach((commentDoc) => {
          const commentData = commentDoc.data();
          comments.push({
            id: commentDoc.id,
            message: commentData.message,
            from: commentData.from,
            createdAt: commentData.createdAt?.toDate() || null,
          });
        });
        
        // Sort comments by newest first
        comments.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt - a.createdAt;
        });
        
        documentsWithComments.push({
          documentId: docId,
          documentTitle: docData.title || docId,
          fileName: docData.fileName || "Unknown",
          reuploadAllowed: true,
          lastCommentAt: docData.lastCommentAt?.toDate() || null,
          comments: comments,
          latestComment: comments[0] || null,
        });
      }
    }
    
    return documentsWithComments;
    
  } catch (error) {
    console.error("Error getting documents with comments:", error);
    return [];
  }
}

// Usage Example:
const docsWithComments = await getAllDocumentsWithComments("ctpo", "user123");

console.log(`📋 Found ${docsWithComments.length} document(s) with comments`);

docsWithComments.forEach(doc => {
  console.log(`\n📄 ${doc.documentTitle}`);
  console.log(`   File: ${doc.fileName}`);
  console.log(`   Comments: ${doc.comments.length}`);
  if (doc.latestComment) {
    console.log(`   Latest: ${doc.latestComment.message}`);
  }
});
```

---

## 📱 UI Implementation Examples

### Example 1: Show Reupload Button

```javascript
// In your document display component
async function displayDocuments(applicationType, applicantId) {
  const uploadsRef = collection(
    db,
    "applications",
    applicationType,
    "applicants",
    applicantId,
    "uploads"
  );
  
  const uploadsSnap = await getDocs(uploadsRef);
  
  for (const uploadDoc of uploadsSnap.docs) {
    const docData = uploadDoc.data();
    const docId = uploadDoc.id;
    
    const reuploadAllowed = docData.reuploadAllowed || false;
    
    // Create UI element
    const documentDiv = document.createElement("div");
    documentDiv.innerHTML = `
      <div class="document-card">
        <h4>${docData.title || docId}</h4>
        <p>File: ${docData.fileName || "Unknown"}</p>
        <p>Status: ${docData.url ? "Uploaded" : "Pending"}</p>
        
        ${reuploadAllowed ? `
          <div class="reupload-notice">
            🔄 Reupload Required
            <button onclick="viewComments('${docId}')">View Comments</button>
            <button onclick="reuploadFile('${docId}')">Reupload File</button>
          </div>
        ` : `
          <div class="status-ok">
            ✅ Document Submitted
          </div>
        `}
      </div>
    `;
    
    container.appendChild(documentDiv);
  }
}
```

### Example 2: Display Comments Modal

```javascript
async function showCommentsModal(applicationType, applicantId, documentId) {
  const result = await checkDocumentComments(
    applicationType, 
    applicantId, 
    documentId
  );
  
  if (!result || !result.hasComments) {
    alert("No comments found for this document.");
    return;
  }
  
  // Create modal content
  let modalHTML = `
    <div class="comments-modal">
      <h3>💬 Comments for ${result.documentData.title}</h3>
      <div class="comments-list">
  `;
  
  result.comments.forEach(comment => {
    const dateStr = comment.createdAt 
      ? comment.createdAt.toLocaleString() 
      : "Unknown date";
    
    modalHTML += `
      <div class="comment-item">
        <div class="comment-header">
          <strong>From: ${comment.from}</strong>
          <span class="comment-date">${dateStr}</span>
        </div>
        <div class="comment-message">
          ${comment.message}
        </div>
      </div>
    `;
  });
  
  modalHTML += `
      </div>
      <button onclick="closeCommentsModal()">Close</button>
      <button onclick="reuploadFile('${documentId}')">Reupload File</button>
    </div>
  `;
  
  // Show modal
  const modal = document.getElementById("commentsModal");
  modal.innerHTML = modalHTML;
  modal.style.display = "block";
}
```

### Example 3: Flutter/Dart Implementation

```dart
import 'package:cloud_firestore/cloud_firestore.dart';

class DocumentComment {
  final String id;
  final String message;
  final String from;
  final DateTime? createdAt;
  
  DocumentComment({
    required this.id,
    required this.message,
    required this.from,
    this.createdAt,
  });
  
  factory DocumentComment.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DocumentComment(
      id: doc.id,
      message: data['message'] ?? '',
      from: data['from'] ?? 'Unknown',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}

class DocumentWithComments {
  final String documentId;
  final String title;
  final String fileName;
  final bool reuploadAllowed;
  final List<DocumentComment> comments;
  
  DocumentWithComments({
    required this.documentId,
    required this.title,
    required this.fileName,
    required this.reuploadAllowed,
    required this.comments,
  });
}

// Check single document for comments
Future<DocumentWithComments?> checkDocumentComments(
  String applicationType,
  String applicantId,
  String documentId,
) async {
  try {
    // Get document data
    final docRef = FirebaseFirestore.instance
        .collection('applications')
        .doc(applicationType)
        .collection('applicants')
        .doc(applicantId)
        .collection('uploads')
        .doc(documentId);
    
    final docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      print('Document not found');
      return null;
    }
    
    final docData = docSnap.data()!;
    final reuploadAllowed = docData['reuploadAllowed'] ?? false;
    
    if (!reuploadAllowed) {
      print('No reupload needed');
      return null;
    }
    
    // Get comments
    final commentsRef = docRef.collection('comments');
    final commentsSnap = await commentsRef.get();
    
    final comments = commentsSnap.docs
        .map((doc) => DocumentComment.fromFirestore(doc))
        .toList();
    
    // Sort by newest first
    comments.sort((a, b) {
      if (a.createdAt == null) return 1;
      if (b.createdAt == null) return -1;
      return b.createdAt!.compareTo(a.createdAt!);
    });
    
    return DocumentWithComments(
      documentId: documentId,
      title: docData['title'] ?? documentId,
      fileName: docData['fileName'] ?? 'Unknown',
      reuploadAllowed: reuploadAllowed,
      comments: comments,
    );
    
  } catch (e) {
    print('Error checking document comments: $e');
    return null;
  }
}

// Get all documents with comments
Future<List<DocumentWithComments>> getAllDocumentsWithComments(
  String applicationType,
  String applicantId,
) async {
  try {
    final uploadsRef = FirebaseFirestore.instance
        .collection('applications')
        .doc(applicationType)
        .collection('applicants')
        .doc(applicantId)
        .collection('uploads');
    
    final uploadsSnap = await uploadsRef.get();
    
    if (uploadsSnap.docs.isEmpty) {
      return [];
    }
    
    final List<DocumentWithComments> documentsWithComments = [];
    
    for (final uploadDoc in uploadsSnap.docs) {
      final docData = uploadDoc.data();
      final reuploadAllowed = docData['reuploadAllowed'] ?? false;
      
      if (reuploadAllowed) {
        final commentsRef = uploadDoc.reference.collection('comments');
        final commentsSnap = await commentsRef.get();
        
        final comments = commentsSnap.docs
            .map((doc) => DocumentComment.fromFirestore(doc))
            .toList();
        
        comments.sort((a, b) {
          if (a.createdAt == null) return 1;
          if (b.createdAt == null) return -1;
          return b.createdAt!.compareTo(a.createdAt!);
        });
        
        documentsWithComments.add(
          DocumentWithComments(
            documentId: uploadDoc.id,
            title: docData['title'] ?? uploadDoc.id,
            fileName: docData['fileName'] ?? 'Unknown',
            reuploadAllowed: true,
            comments: comments,
          ),
        );
      }
    }
    
    return documentsWithComments;
    
  } catch (e) {
    print('Error getting documents with comments: $e');
    return [];
  }
}

// Usage in Flutter Widget:
class DocumentsScreen extends StatefulWidget {
  final String applicationType;
  final String applicantId;
  
  @override
  _DocumentsScreenState createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<DocumentWithComments> documentsWithComments = [];
  bool isLoading = true;
  
  @override
  void initState() {
    super.initState();
    loadDocuments();
  }
  
  Future<void> loadDocuments() async {
    setState(() => isLoading = true);
    
    final docs = await getAllDocumentsWithComments(
      widget.applicationType,
      widget.applicantId,
    );
    
    setState(() {
      documentsWithComments = docs;
      isLoading = false;
    });
  }
  
  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Center(child: CircularProgressIndicator());
    }
    
    if (documentsWithComments.isEmpty) {
      return Center(child: Text('No documents need reuploading'));
    }
    
    return ListView.builder(
      itemCount: documentsWithComments.length,
      itemBuilder: (context, index) {
        final doc = documentsWithComments[index];
        final latestComment = doc.comments.isNotEmpty 
            ? doc.comments.first 
            : null;
        
        return Card(
          margin: EdgeInsets.all(8),
          child: ListTile(
            leading: Icon(Icons.refresh, color: Colors.orange),
            title: Text(doc.title),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('File: ${doc.fileName}'),
                if (latestComment != null) ...[
                  SizedBox(height: 8),
                  Text(
                    '💬 ${latestComment.message}',
                    style: TextStyle(
                      color: Colors.red,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
            trailing: ElevatedButton(
              child: Text('Reupload'),
              onPressed: () => reuploadFile(doc.documentId),
            ),
            onTap: () => showCommentsDialog(doc),
          ),
        );
      },
    );
  }
  
  void showCommentsDialog(DocumentWithComments doc) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('💬 Comments for ${doc.title}'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: doc.comments.map((comment) {
              return Card(
                margin: EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            comment.from,
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          if (comment.createdAt != null)
                            Text(
                              DateFormat('MMM dd, yyyy hh:mm a')
                                  .format(comment.createdAt!),
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                        ],
                      ),
                      SizedBox(height: 8),
                      Text(comment.message),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            child: Text('Close'),
            onPressed: () => Navigator.pop(context),
          ),
          ElevatedButton(
            child: Text('Reupload File'),
            onPressed: () {
              Navigator.pop(context);
              reuploadFile(doc.documentId);
            },
          ),
        ],
      ),
    );
  }
  
  void reuploadFile(String documentId) {
    // Implement file reupload logic
    print('Reupload file for document: $documentId');
  }
}
```

---

## 🔄 Reupload Workflow

### Step 1: Applicant Checks for Comments
```javascript
const docs = await getAllDocumentsWithComments("ctpo", currentUserId);
if (docs.length > 0) {
  showNotification(`You have ${docs.length} document(s) that need reuploading`);
}
```

### Step 2: Display Documents Needing Reupload
- Show documents with `reuploadAllowed: true`
- Display 🔄 icon or badge
- Show latest comment message
- Provide "View Comments" and "Reupload" buttons

### Step 3: Applicant Reuploads File
When applicant reuploads:
```javascript
async function reuploadDocument(applicationType, applicantId, documentId, newFile) {
  // 1. Upload new file to Firebase Storage
  const storageRef = ref(storage, `applications/${applicationType}/applicants/${applicantId}/uploads/${documentId}/${newFile.name}`);
  const uploadResult = await uploadBytes(storageRef, newFile);
  const downloadURL = await getDownloadURL(uploadResult.ref);
  
  // 2. Update document in Firestore
  const docRef = doc(
    db,
    "applications",
    applicationType,
    "applicants",
    applicantId,
    "uploads",
    documentId
  );
  
  await updateDoc(docRef, {
    url: downloadURL,
    fileName: newFile.name,
    uploadedAt: serverTimestamp(),
    reuploadAllowed: false,  // ⬅️ RESET FLAG
    reuploadedAt: serverTimestamp(),
  });
  
  console.log("✅ File reuploaded successfully");
}
```

---

## 📋 Key Fields Reference

### Document Fields
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Document type name (e.g., "Land Title") |
| `fileName` | string | Original file name |
| `url` | string | Firebase Storage download URL |
| `uploadedAt` | Timestamp | When file was uploaded |
| `reuploadAllowed` | boolean | **TRUE if admin requested reupload** |
| `lastCommentAt` | Timestamp | When last comment was added |
| `reuploadedAt` | Timestamp | When file was reuploaded |

### Comment Fields
| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Admin's comment/feedback |
| `from` | string | Admin email who left comment |
| `createdAt` | Timestamp | When comment was created |

---

## 🎨 UI/UX Best Practices

### Visual Indicators
```css
/* Document with reupload required */
.document-needs-reupload {
  border-left: 4px solid #ff9800;
  background-color: #fff3e0;
}

/* Comment badge */
.comment-badge {
  background-color: #f44336;
  color: white;
  border-radius: 50%;
  padding: 4px 8px;
  font-size: 12px;
}

/* Reupload button */
.reupload-btn {
  background-color: #ff9800;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
```

### Notification Examples
```javascript
// Show count of documents needing reupload
function showReuploadNotification() {
  const count = documentsWithComments.length;
  if (count > 0) {
    const notification = document.createElement("div");
    notification.className = "notification warning";
    notification.innerHTML = `
      🔄 You have ${count} document${count > 1 ? 's' : ''} that need${count === 1 ? 's' : ''} reuploading.
      <button onclick="showDocumentsNeedingReupload()">View Details</button>
    `;
    document.body.appendChild(notification);
  }
}
```

---

## ✅ Complete Checklist for Applicant Side

- [ ] Fetch all documents for the applicant
- [ ] Check each document's `reuploadAllowed` field
- [ ] Display 🔄 indicator for documents needing reupload
- [ ] Fetch comments from subcollection
- [ ] Display comments in chronological order (newest first)
- [ ] Show "View Comments" button
- [ ] Show "Reupload File" button
- [ ] Implement file selection/upload UI
- [ ] Upload new file to Firebase Storage
- [ ] Update Firestore document with new URL
- [ ] Set `reuploadAllowed: false` after successful reupload
- [ ] Show success message to applicant
- [ ] Refresh UI to remove reupload indicator

---

## 🚨 Important Notes

1. **Always check `reuploadAllowed` field first** - Don't query comments subcollection if this is false
2. **Comments are stored in a subcollection** - Not in the document itself
3. **Multiple comments possible** - An admin can add multiple comments
4. **Reset `reuploadAllowed` after reupload** - Set to `false` when applicant successfully reuploads
5. **Sort comments by date** - Show newest first for better UX
6. **Handle no comments gracefully** - Document might have `reuploadAllowed: true` but no comments yet

---

## 📞 Support & Troubleshooting

### Common Issues:

**Q: Document shows reupload allowed but no comments found?**  
A: Admin set the flag but didn't add a comment. Show generic message: "Please reupload this document"

**Q: How to handle multiple comments?**  
A: Show all comments in chronological order. Latest comment is usually most important.

**Q: Should old comments be deleted after reupload?**  
A: No, keep comment history for audit trail. Just set `reuploadAllowed: false`

**Q: Can applicant reply to comments?**  
A: Not in current implementation. This is one-way admin → applicant communication.

---

## 📚 Related Features

- **Template Upload**: Applicants can download templates before uploading
- **File Preview**: Admins can view files before commenting
- **Application Status**: Track overall application progress

