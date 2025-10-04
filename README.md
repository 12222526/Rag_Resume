# ResumeRAG - Resume Search & Job Match System

A comprehensive system for uploading, parsing, and searching resumes with semantic search capabilities and job matching functionality.

## Features

### Core Functionality
- **Multi-format Resume Upload**: Support for PDF, TXT, DOC, DOCX files
- **Bulk ZIP Upload**: Upload multiple resumes in a single ZIP file
- **Semantic Search**: Vector-based search using embeddings
- **Question & Answer**: Ask natural language questions about candidates
- **Job Management**: Create and manage job postings
- **Job Matching**: Match candidates to job requirements with evidence
- **PII Redaction**: Redact personally identifiable information
- **Pagination**: Efficient pagination for large datasets

### Key APIs

#### Resume Management
- `POST /api/resumes/upload` - Upload multiple resume files
- `POST /api/resumes/upload-zip` - Upload ZIP file with resumes
- `GET /api/resumes` - List resumes with pagination and search
- `GET /api/resumes/:id` - Get specific resume
- `DELETE /api/resumes/:id` - Delete resume

#### Search & Query
- `POST /api/search/ask` - Ask questions about candidates
- `GET /api/search/resumes` - Search resumes semantically
- `GET /api/search/candidates/:id` - Get candidate profile

#### Job Management
- `POST /api/jobs` - Create new job posting
- `GET /api/jobs` - List jobs with pagination
- `GET /api/jobs/:id` - Get specific job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/:id/match` - Match job with candidates
- `GET /api/jobs/:id/matches` - Get job matches

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/resumerag
   PORT=5000
   NODE_ENV=development
   ```

5. **Start MongoDB**
   Make sure MongoDB is running on your system:
   ```bash
   # On macOS with Homebrew
   brew services start mongodb-community
   
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On Windows
   net start MongoDB
   ```

6. **Start the backend server**
   ```bash
   npm start
   ```

### Frontend Setup

1. **Open the frontend**
   Simply open `index.html` in your web browser or serve it with a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   ```

2. **Access the application**
   Open your browser and navigate to:
   - Frontend: `http://localhost:8000`
   - Backend API: `http://localhost:5000`

## Usage

### 1. Upload Resumes
- Go to the Upload page
- Select multiple resume files (PDF, TXT, DOC, DOCX)
- Or upload a ZIP file containing multiple resumes
- Resumes will be parsed and embedded automatically

### 2. Search Candidates
- Go to the Search page
- Use the search box to find candidates by keywords
- Or ask natural language questions about candidates
- Results include similarity scores and evidence snippets

### 3. Manage Jobs
- Go to the Jobs page
- Create new job postings with requirements
- Use the "Match" button to find suitable candidates
- View detailed match results with evidence and missing requirements

### 4. View Candidate Profiles
- Click "View Profile" on any candidate
- See detailed information including skills, experience, and education
- PII is automatically redacted for privacy

## Technical Details

### Architecture
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Embeddings**: Local transformers (Xenova/all-MiniLM-L6-v2)
- **File Processing**: PDF parsing, text extraction
- **Frontend**: Vanilla JavaScript with Tailwind CSS

### Data Models
- **Resume**: Stores file info, parsed text, embeddings, metadata
- **Job**: Stores job details, requirements, embeddings
- **Match**: Stores job-candidate matches with scores and evidence

### Key Features
- **Deterministic Rankings**: Consistent search results
- **PII Redaction**: Multiple levels of privacy protection
- **Semantic Search**: Vector similarity for context-aware results
- **Evidence-based Matching**: Shows why candidates match jobs
- **Scalable Architecture**: Handles large datasets efficiently

## API Response Schemas

### Ask Question Response
```json
{
  "query": "Who has React experience?",
  "results": [
    {
      "resumeId": "string",
      "resumeName": "string",
      "candidateName": "string",
      "score": 85,
      "evidence": [
        {
          "text": "string",
          "similarity": 90,
          "startIndex": 0,
          "endIndex": 100
        }
      ]
    }
  ]
}
```

### Job Match Response
```json
{
  "jobId": "string",
  "jobTitle": "string",
  "company": "string",
  "matches": [
    {
      "resumeId": "string",
      "candidateName": "string",
      "score": 78,
      "evidence": [...],
      "missingRequirements": [...],
      "strengths": [...],
      "weaknesses": [...]
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify MongoDB port (default: 27017)

2. **File Upload Issues**
   - Check file size limits (10MB per file)
   - Verify supported file types
   - Ensure uploads directory exists

3. **Embedding Generation Slow**
   - First run downloads model (~50MB)
   - Subsequent runs are faster
   - Consider using GPU if available

4. **Search Results Empty**
   - Ensure resumes are uploaded and processed
   - Check if embeddings were generated
   - Try different search terms

### Performance Tips
- Use pagination for large datasets
- Consider batch processing for bulk uploads
- Monitor memory usage with large files
- Use SSD storage for better I/O performance

## Development

### Adding New Features
1. Create new controller functions
2. Add routes in appropriate route file
3. Update frontend JavaScript
4. Test with sample data

### Testing
- Use the health check endpoint: `GET /api/health`
- Test with sample PDFs and text files
- Verify embedding generation
- Check search functionality

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check server logs for errors
4. Ensure all dependencies are installed
