import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  evidence: [{
    text: String,
    relevance: String,
    type: {
      type: String,
      enum: ['skill', 'experience', 'education', 'requirement']
    }
  }],
  missingRequirements: [String],
  strengths: [String],
  weaknesses: [String],
  matchDetails: {
    skillsMatch: Number,
    experienceMatch: Number,
    educationMatch: Number,
    overallMatch: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Match', matchSchema);
