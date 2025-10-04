import Resume from '../models/Resume.js';
import { parsePDF, parseTextFile, extractZipFiles, getFileType, chunkText } from '../utils/fileParser.js';
import { generateEmbeddings } from '../utils/embeddings.js';
import { redactPII, extractMetadata } from '../utils/piiRedaction.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const uploadResumes = async (req, res) => {
  try {
    const files = req.files;
    const uploadedResumes = [];
    
    for (const file of files) {
      const fileInfo = getFileType(file.originalname);
      
      if (!fileInfo.isSupported) {
        continue; // Skip unsupported files
      }
      
      let parsedData;
      
      // Handle different file types
      if (fileInfo.extension === '.pdf') {
        parsedData = await parsePDF(file.path);
      } else if (fileInfo.extension === '.txt') {
        parsedData = await parseTextFile(file.path);
      } else {
        // For other text-based files, try to read as text
        parsedData = await parseTextFile(file.path);
      }
      
      // Extract metadata
      const metadata = extractMetadata(parsedData.text);
      
      // Create chunks for embedding
      const chunks = chunkText(parsedData.text);
      
      // Generate embeddings for chunks
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await generateEmbeddings(chunkTexts);
      
      // Add embeddings to chunks
      chunks.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });
      
      // Create resume document
      const resume = new Resume({
        filename: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: fileInfo.mimeType,
        parsedText: parsedData.text,
        chunks: chunks,
        embeddings: embeddings,
        metadata: {
          ...metadata,
          lastModified: new Date()
        }
      });
      
      await resume.save();
      uploadedResumes.push(resume);
    }
    
    res.status(201).json({
      message: 'Resumes uploaded successfully',
      count: uploadedResumes.length,
      resumes: uploadedResumes.map(r => ({
        id: r._id,
        filename: r.filename,
        originalName: r.originalName,
        metadata: r.metadata
      }))
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload resumes: ' + error.message });
  }
};

export const uploadZipResumes = async (req, res) => {
  try {
    const zipFile = req.file;
    if (!zipFile) {
      return res.status(400).json({ error: 'No ZIP file provided' });
    }
    
    // Create extract directory
    const extractDir = path.join('uploads', 'extracted', uuidv4());
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Extract ZIP file
    const extractedFiles = await extractZipFiles(zipFile.path, extractDir);
    
    // Process each extracted file
    const uploadedResumes = [];
    
    for (const file of extractedFiles) {
      const fileInfo = getFileType(file.name);
      
      if (!fileInfo.isSupported) {
        continue;
      }
      
      let parsedData;
      
      if (fileInfo.extension === '.pdf') {
        parsedData = await parsePDF(file.path);
      } else if (fileInfo.extension === '.txt') {
        parsedData = await parseTextFile(file.path);
      } else {
        parsedData = await parseTextFile(file.path);
      }
      
      const metadata = extractMetadata(parsedData.text);
      const chunks = chunkText(parsedData.text);
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await generateEmbeddings(chunkTexts);
      
      chunks.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });
      
      const resume = new Resume({
        filename: path.basename(file.path),
        originalName: file.name,
        filePath: file.path,
        fileSize: fs.statSync(file.path).size,
        mimeType: fileInfo.mimeType,
        parsedText: parsedData.text,
        chunks: chunks,
        embeddings: embeddings,
        metadata: {
          ...metadata,
          lastModified: new Date()
        }
      });
      
      await resume.save();
      uploadedResumes.push(resume);
    }
    
    // Clean up ZIP file
    fs.unlinkSync(zipFile.path);
    
    res.status(201).json({
      message: 'ZIP file processed successfully',
      count: uploadedResumes.length,
      resumes: uploadedResumes.map(r => ({
        id: r._id,
        filename: r.filename,
        originalName: r.originalName,
        metadata: r.metadata
      }))
    });
  } catch (error) {
    console.error('ZIP upload error:', error);
    res.status(500).json({ error: 'Failed to process ZIP file: ' + error.message });
  }
};

export const getResumes = async (req, res) => {
  try {
    const { limit = 10, offset = 0, q = '' } = req.query;
    
    let query = {};
    
    // Text search
    if (q) {
      query.$or = [
        { originalName: { $regex: q, $options: 'i' } },
        { 'metadata.name': { $regex: q, $options: 'i' } },
        { 'metadata.skills': { $in: [new RegExp(q, 'i')] } },
        { parsedText: { $regex: q, $options: 'i' } }
      ];
    }
    
    const resumes = await Resume.find(query)
      .select('-parsedText -embeddings -chunks.embedding')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });
    
    const total = await Resume.countDocuments(query);
    
    res.json({
      resumes,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ error: 'Failed to fetch resumes: ' + error.message });
  }
};

export const getResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const { redactPII: shouldRedact = false } = req.query;
    
    const resume = await Resume.findById(id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    let responseData = {
      id: resume._id,
      filename: resume.filename,
      originalName: resume.originalName,
      fileSize: resume.fileSize,
      mimeType: resume.mimeType,
      metadata: resume.metadata,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt
    };
    
    if (shouldRedact === 'true' || shouldRedact === true) {
      if (!resume.isRedacted) {
        // Redact PII
        const redacted = redactPII(resume.parsedText, 'standard');
        
        // Update resume with redacted text
        resume.isRedacted = true;
        resume.redactedText = redacted.text;
        await resume.save();
        
        responseData.text = redacted.text;
        responseData.redactionLevel = redacted.redactionLevel;
      } else {
        responseData.text = resume.redactedText;
        responseData.redactionLevel = 'standard';
      }
    } else {
      responseData.text = resume.parsedText;
    }
    
    res.json(responseData);
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Failed to fetch resume: ' + error.message });
  }
};

export const deleteResume = async (req, res) => {
  try {
    const { id } = req.params;
    
    const resume = await Resume.findById(id);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    // Delete file from filesystem
    if (fs.existsSync(resume.filePath)) {
      fs.unlinkSync(resume.filePath);
    }
    
    // Delete from database
    await Resume.findByIdAndDelete(id);
    
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: 'Failed to delete resume: ' + error.message });
  }
};
