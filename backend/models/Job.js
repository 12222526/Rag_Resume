import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: String,
    required: true
  },
  location: String,
  salary: {
    min: Number,
    max: Number,
    currency: String
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    default: 'full-time'
  },
  experience: {
    type: String,
    required: true
  },
  skills: [String],
  benefits: [String],
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
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Job', jobSchema);
