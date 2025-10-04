import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import Match from '../models/Match.js';
import { generateEmbeddings } from '../utils/embeddings.js';
import { chunkText } from '../utils/fileParser.js';

export const createJob = async (req, res) => {
  try {
    const {
      title,
      company,
      description,
      requirements,
      location,
      salary,
      employmentType,
      experience,
      skills,
      benefits
    } = req.body;
    
    if (!title || !company || !description || !requirements) {
      return res.status(400).json({ 
        error: 'Title, company, description, and requirements are required' 
      });
    }
    
    // Combine description and requirements for processing
    const fullText = `${description}\n\nRequirements:\n${requirements}`;
    
    // Create chunks
    const chunks = chunkText(fullText);
    const chunkTexts = chunks.map(chunk => chunk.text);
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(chunkTexts);
    
    // Add embeddings to chunks
    chunks.forEach((chunk, index) => {
      chunk.embedding = embeddings[index];
    });
    
    const job = new Job({
      title,
      company,
      description,
      requirements,
      location,
      salary,
      employmentType,
      experience,
      skills: skills || [],
      benefits: benefits || [],
      chunks,
      embeddings
    });
    
    await job.save();
    
    res.status(201).json({
      message: 'Job created successfully',
      job: {
        id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.employmentType,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job: ' + error.message });
  }
};

export const getJobs = async (req, res) => {
  try {
    const { limit = 10, offset = 0, q = '', company = '', location = '' } = req.query;
    
    let query = { isActive: true };
    
    // Text search
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { skills: { $in: [new RegExp(q, 'i')] } }
      ];
    }
    
    // Company filter
    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }
    
    // Location filter
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    const jobs = await Job.find(query)
      .select('-chunks -embeddings')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });
    
    const total = await Job.countDocuments(query);
    
    res.json({
      jobs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs: ' + error.message });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await Job.findById(id).select('-chunks -embeddings');
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job: ' + error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // If description or requirements changed, regenerate embeddings
    if (updates.description || updates.requirements) {
      const description = updates.description || job.description;
      const requirements = updates.requirements || job.requirements;
      const fullText = `${description}\n\nRequirements:\n${requirements}`;
      
      const chunks = chunkText(fullText);
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await generateEmbeddings(chunkTexts);
      
      chunks.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });
      
      updates.chunks = chunks;
      updates.embeddings = embeddings;
    }
    
    Object.assign(job, updates);
    await job.save();
    
    res.json({
      message: 'Job updated successfully',
      job: {
        id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        updatedAt: job.updatedAt
      }
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job: ' + error.message });
  }
};

export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Soft delete - set isActive to false
    job.isActive = false;
    await job.save();
    
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job: ' + error.message });
  }
};

export const matchJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { top_n = 10 } = req.body;
    
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get all resumes
    const resumes = await Resume.find({}).select('chunks metadata originalName');
    
    const matches = [];
    
    for (const resume of resumes) {
      // Calculate similarity between job and resume
      const jobChunks = job.chunks;
      const resumeChunks = resume.chunks;
      
      let totalSimilarity = 0;
      let matchCount = 0;
      const evidence = [];
      
      // Find best matching chunks
      for (const jobChunk of jobChunks) {
        let bestSimilarity = 0;
        let bestResumeChunk = null;
        
        for (const resumeChunk of resumeChunks) {
          const similarity = computeCosineSimilarity(jobChunk.embedding, resumeChunk.embedding);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestResumeChunk = resumeChunk;
          }
        }
        
        if (bestSimilarity > 0.3) { // Threshold for relevance
          totalSimilarity += bestSimilarity;
          matchCount++;
          
          evidence.push({
            text: bestResumeChunk.text,
            relevance: bestSimilarity > 0.7 ? 'high' : bestSimilarity > 0.5 ? 'medium' : 'low',
            type: determineEvidenceType(bestResumeChunk.text),
            similarity: Math.round(bestSimilarity * 100)
          });
        }
      }
      
      const avgSimilarity = matchCount > 0 ? totalSimilarity / matchCount : 0;
      const score = Math.round(avgSimilarity * 100);
      
      if (score > 0) {
        // Analyze missing requirements
        const missingRequirements = analyzeMissingRequirements(job, resume);
        const strengths = analyzeStrengths(resume);
        const weaknesses = analyzeWeaknesses(job, resume);
        
        matches.push({
          resumeId: resume._id,
          candidateName: resume.metadata.name,
          resumeName: resume.originalName,
          score,
          evidence: evidence.slice(0, 5), // Top 5 evidence pieces
          missingRequirements,
          strengths,
          weaknesses,
          matchDetails: {
            skillsMatch: calculateSkillsMatch(job.skills, resume.metadata.skills),
            experienceMatch: calculateExperienceMatch(job.experience, resume.metadata.experience),
            educationMatch: calculateEducationMatch(job, resume),
            overallMatch: score
          }
        });
      }
    }
    
    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);
    
    // Return top matches
    const topMatches = matches.slice(0, top_n);
    
    // Save matches to database
    const matchDocs = topMatches.map(match => new Match({
      jobId: job._id,
      resumeId: match.resumeId,
      score: match.score,
      evidence: match.evidence,
      missingRequirements: match.missingRequirements,
      strengths: match.strengths,
      weaknesses: match.weaknesses,
      matchDetails: match.matchDetails
    }));
    
    // Delete existing matches for this job
    await Match.deleteMany({ jobId: job._id });
    
    // Save new matches
    await Match.insertMany(matchDocs);
    
    res.json({
      jobId: job._id,
      jobTitle: job.title,
      company: job.company,
      matches: topMatches,
      totalCandidates: resumes.length,
      matchedCandidates: matches.length,
      topN: top_n
    });
  } catch (error) {
    console.error('Match job error:', error);
    res.status(500).json({ error: 'Failed to match job: ' + error.message });
  }
};

export const getJobMatches = async (req, res) => {
  try {
    const { id } = req.params;
    
    const matches = await Match.find({ jobId: id })
      .populate('resumeId', 'originalName metadata')
      .sort({ score: -1 });
    
    if (matches.length === 0) {
      return res.status(404).json({ error: 'No matches found for this job' });
    }
    
    res.json({
      jobId: id,
      matches: matches.map(match => ({
        id: match._id,
        resumeId: match.resumeId._id,
        candidateName: match.resumeId.metadata.name,
        resumeName: match.resumeId.originalName,
        score: match.score,
        evidence: match.evidence,
        missingRequirements: match.missingRequirements,
        strengths: match.strengths,
        weaknesses: match.weaknesses,
        matchDetails: match.matchDetails,
        matchedAt: match.createdAt
      }))
    });
  } catch (error) {
    console.error('Get job matches error:', error);
    res.status(500).json({ error: 'Failed to fetch job matches: ' + error.message });
  }
};

// Helper functions
function determineEvidenceType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('skill') || lowerText.includes('technology') || lowerText.includes('programming')) {
    return 'skill';
  } else if (lowerText.includes('experience') || lowerText.includes('worked') || lowerText.includes('years')) {
    return 'experience';
  } else if (lowerText.includes('education') || lowerText.includes('degree') || lowerText.includes('university')) {
    return 'education';
  } else {
    return 'requirement';
  }
}

function analyzeMissingRequirements(job, resume) {
  const missing = [];
  const jobSkills = job.skills.map(s => s.toLowerCase());
  const resumeSkills = resume.metadata.skills.map(s => s.toLowerCase());
  
  for (const skill of jobSkills) {
    if (!resumeSkills.some(rs => rs.includes(skill) || skill.includes(rs))) {
      missing.push(skill);
    }
  }
  
  // Check experience requirement
  const jobExp = extractYears(job.experience);
  const resumeExp = resume.metadata.experience;
  
  if (jobExp && resumeExp < jobExp) {
    missing.push(`${jobExp} years of experience (candidate has ${resumeExp})`);
  }
  
  return missing;
}

function analyzeStrengths(resume) {
  const strengths = [];
  
  if (resume.metadata.skills.length > 5) {
    strengths.push('Diverse skill set');
  }
  
  if (resume.metadata.experience > 5) {
    strengths.push('Senior-level experience');
  }
  
  if (resume.metadata.education && resume.metadata.education.length > 0) {
    strengths.push('Strong educational background');
  }
  
  return strengths;
}

function analyzeWeaknesses(job, resume) {
  const weaknesses = [];
  
  const jobSkills = job.skills.map(s => s.toLowerCase());
  const resumeSkills = resume.metadata.skills.map(s => s.toLowerCase());
  const skillMatch = jobSkills.filter(skill => 
    resumeSkills.some(rs => rs.includes(skill) || skill.includes(rs))
  ).length;
  
  if (skillMatch < jobSkills.length * 0.5) {
    weaknesses.push('Limited skill overlap with job requirements');
  }
  
  const jobExp = extractYears(job.experience);
  const resumeExp = resume.metadata.experience;
  
  if (jobExp && resumeExp < jobExp * 0.7) {
    weaknesses.push('Below required experience level');
  }
  
  return weaknesses;
}

function calculateSkillsMatch(jobSkills, resumeSkills) {
  if (!jobSkills || !resumeSkills || jobSkills.length === 0) return 0;
  
  const jobLower = jobSkills.map(s => s.toLowerCase());
  const resumeLower = resumeSkills.map(s => s.toLowerCase());
  
  const matches = jobLower.filter(skill => 
    resumeLower.some(rs => rs.includes(skill) || skill.includes(rs))
  );
  
  return Math.round((matches.length / jobSkills.length) * 100);
}

function calculateExperienceMatch(jobExperience, resumeExperience) {
  if (!jobExperience || !resumeExperience) return 0;
  
  const jobYears = extractYears(jobExperience);
  if (!jobYears) return 0;
  
  const match = Math.min((resumeExperience / jobYears) * 100, 100);
  return Math.round(match);
}

function calculateEducationMatch(job, resume) {
  if (!job.description || !resume.metadata.education) return 0;
  
  const jobLower = job.description.toLowerCase();
  const educationKeywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college'];
  
  let score = 0;
  for (const edu of resume.metadata.education) {
    const eduLower = edu.toLowerCase();
    for (const keyword of educationKeywords) {
      if (eduLower.includes(keyword) && jobLower.includes(keyword)) {
        score += 25;
      }
    }
  }
  
  return Math.min(score, 100);
}

function extractYears(text) {
  const match = text.match(/(\d+)\+?\s*years?/i);
  return match ? parseInt(match[1]) : null;
}

function computeCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
