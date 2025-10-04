import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  parsedText: {
    type: String,
    required: true
  },
  embeddings: {
    type: [[Number]],
    default: []
  },
  chunks: [{
    text: String,
    startIndex: Number,
    endIndex: Number,
    embedding: [Number]
  }],
  metadata: {
    name: String,
    email: String,
    phone: String,
    skills: [String],
    experience: Number,
    education: [String],
    summary: String,
    lastModified: Date
  },
  isRedacted: {
    type: Boolean,
    default: false
  },
  redactedText: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

resumeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Resume', resumeSchema);
