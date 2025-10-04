import Resume from '../models/Resume.js';
import { generateEmbedding, findSimilarChunks } from '../utils/embeddings.js';
import { chunkText } from '../utils/fileParser.js';

export const askQuestion = async (req, res) => {
  try {
    const { query, k = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Get all resumes with their chunks
    const resumes = await Resume.find({}).select('chunks metadata originalName');
    
    const results = [];
    
    for (const resume of resumes) {
      // Find similar chunks in this resume
      const similarChunks = findSimilarChunks(queryEmbedding, resume.chunks, k);
      
      if (similarChunks.length > 0) {
        // Calculate overall similarity score for this resume
        const avgSimilarity = similarChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / similarChunks.length;
        
        results.push({
          resumeId: resume._id,
          resumeName: resume.originalName,
          candidateName: resume.metadata.name,
          score: Math.round(avgSimilarity * 100),
          evidence: similarChunks.map(chunk => ({
            text: chunk.chunk.text,
            similarity: Math.round(chunk.similarity * 100),
            startIndex: chunk.chunk.startIndex,
            endIndex: chunk.chunk.endIndex
          }))
        });
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Return top results
    const topResults = results.slice(0, k);
    
    res.json({
      query,
      results: topResults,
      totalFound: results.length,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            resumeId: { type: 'string' },
            resumeName: { type: 'string' },
            candidateName: { type: 'string' },
            score: { type: 'number', minimum: 0, maximum: 100 },
            evidence: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  similarity: { type: 'number', minimum: 0, maximum: 100 },
                  startIndex: { type: 'number' },
                  endIndex: { type: 'number' }
                }
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({ error: 'Failed to process query: ' + error.message });
  }
};

export const searchResumes = async (req, res) => {
  try {
    const { q, limit = 10, offset = 0, minScore = 0 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(q);
    
    // Get resumes with pagination
    const resumes = await Resume.find({})
      .select('chunks metadata originalName')
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const results = [];
    
    for (const resume of resumes) {
      // Calculate similarity with all chunks
      let maxSimilarity = 0;
      let bestChunk = null;
      
      for (const chunk of resume.chunks) {
        const similarity = computeCosineSimilarity(queryEmbedding, chunk.embedding);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestChunk = chunk;
        }
      }
      
      const score = Math.round(maxSimilarity * 100);
      
      if (score >= minScore) {
        results.push({
          resumeId: resume._id,
          resumeName: resume.originalName,
          candidateName: resume.metadata.name,
          email: resume.metadata.email,
          phone: resume.metadata.phone,
          skills: resume.metadata.skills,
          experience: resume.metadata.experience,
          score,
          snippet: bestChunk ? bestChunk.text.substring(0, 200) + '...' : '',
          matchType: 'semantic'
        });
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Get total count for pagination
    const totalResumes = await Resume.countDocuments({});
    
    res.json({
      query: q,
      results,
      pagination: {
        total: results.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalResumes
      },
      minScore: parseInt(minScore)
    });
  } catch (error) {
    console.error('Search resumes error:', error);
    res.status(500).json({ error: 'Failed to search resumes: ' + error.message });
  }
};

export const getCandidateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeText = false, redactPII = false } = req.query;
    
    const resume = await Resume.findById(id);
    if (!resume) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const profile = {
      id: resume._id,
      resumeName: resume.originalName,
      metadata: resume.metadata,
      fileInfo: {
        filename: resume.filename,
        fileSize: resume.fileSize,
        mimeType: resume.mimeType,
        uploadedAt: resume.createdAt,
        lastModified: resume.updatedAt
      },
      stats: {
        totalChunks: resume.chunks.length,
        textLength: resume.parsedText.length,
        embeddingDimensions: resume.chunks.length > 0 ? resume.chunks[0].embedding.length : 0
      }
    };
    
    if (includeText === 'true' || includeText === true) {
      if (redactPII === 'true' || redactPII === true) {
        if (resume.isRedacted) {
          profile.text = resume.redactedText;
        } else {
          const { redactPII } = await import('../utils/piiRedaction.js');
          const redacted = redactPII(resume.parsedText, 'standard');
          profile.text = redacted.text;
          profile.redactionLevel = redacted.redactionLevel;
        }
      } else {
        profile.text = resume.parsedText;
      }
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get candidate profile error:', error);
    res.status(500).json({ error: 'Failed to fetch candidate profile: ' + error.message });
  }
};

export const checkEligibility = async (req, res) => {
  try {
    const { 
      requiredSkills = [], 
      minExperience = 0, 
      requiredEducation = '', 
      requiredCertifications = [], 
      additionalRequirements = '' 
    } = req.body;
    
    const { resumeId } = req.params;
    
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    const eligibilityResults = {
      resumeId: resume._id,
      candidateName: resume.metadata.name,
      resumeName: resume.originalName,
      overallScore: 0,
      isEligible: false,
      criteria: {
        skills: { status: 'pending', score: 0, details: [] },
        experience: { status: 'pending', score: 0, details: [] },
        education: { status: 'pending', score: 0, details: [] },
        certifications: { status: 'pending', score: 0, details: [] },
        additional: { status: 'pending', score: 0, details: [] }
      },
      evidence: [],
      missingRequirements: [],
      recommendations: []
    };
    
    // Check Skills
    if (requiredSkills.length > 0) {
      const resumeSkills = resume.metadata.skills || [];
      const matchedSkills = [];
      const missingSkills = [];
      
      requiredSkills.forEach(skill => {
        const skillLower = skill.toLowerCase().trim();
        const found = resumeSkills.some(resumeSkill => 
          resumeSkill.toLowerCase().includes(skillLower) || 
          skillLower.includes(resumeSkill.toLowerCase())
        );
        
        if (found) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      });
      
      const skillsScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);
      eligibilityResults.criteria.skills = {
        status: skillsScore >= 70 ? 'pass' : skillsScore >= 40 ? 'partial' : 'fail',
        score: skillsScore,
        details: {
          matched: matchedSkills,
          missing: missingSkills,
          total: requiredSkills.length
        }
      };
      
      if (missingSkills.length > 0) {
        eligibilityResults.missingRequirements.push(`Missing skills: ${missingSkills.join(', ')}`);
      }
    }
    
    // Check Experience
    if (minExperience > 0) {
      const candidateExperience = resume.metadata.experience || 0;
      const experienceScore = candidateExperience >= minExperience ? 100 : Math.round((candidateExperience / minExperience) * 100);
      
      eligibilityResults.criteria.experience = {
        status: experienceScore >= 100 ? 'pass' : 'fail',
        score: experienceScore,
        details: {
          required: minExperience,
          candidate: candidateExperience,
          difference: candidateExperience - minExperience
        }
      };
      
      if (candidateExperience < minExperience) {
        eligibilityResults.missingRequirements.push(`Insufficient experience: ${candidateExperience} years (required: ${minExperience})`);
      }
    }
    
    // Check Education
    if (requiredEducation) {
      const candidateEducation = resume.metadata.education || [];
      const educationLevels = ['high-school', 'associate', 'bachelor', 'master', 'phd'];
      const requiredLevel = educationLevels.indexOf(requiredEducation);
      
      let educationMatch = false;
      let educationScore = 0;
      
      candidateEducation.forEach(edu => {
        const eduLower = edu.toLowerCase();
        if (requiredEducation === 'high-school' && (eduLower.includes('high school') || eduLower.includes('secondary'))) {
          educationMatch = true;
          educationScore = 100;
        } else if (requiredEducation === 'associate' && (eduLower.includes('associate') || eduLower.includes('diploma'))) {
          educationMatch = true;
          educationScore = 100;
        } else if (requiredEducation === 'bachelor' && (eduLower.includes('bachelor') || eduLower.includes('degree') || eduLower.includes('bsc') || eduLower.includes('ba'))) {
          educationMatch = true;
          educationScore = 100;
        } else if (requiredEducation === 'master' && (eduLower.includes('master') || eduLower.includes('msc') || eduLower.includes('ma') || eduLower.includes('mba'))) {
          educationMatch = true;
          educationScore = 100;
        } else if (requiredEducation === 'phd' && (eduLower.includes('phd') || eduLower.includes('doctorate') || eduLower.includes('doctor'))) {
          educationMatch = true;
          educationScore = 100;
        }
      });
      
      eligibilityResults.criteria.education = {
        status: educationMatch ? 'pass' : 'fail',
        score: educationScore,
        details: {
          required: requiredEducation,
          candidate: candidateEducation,
          match: educationMatch
        }
      };
      
      if (!educationMatch) {
        eligibilityResults.missingRequirements.push(`Education requirement not met: ${requiredEducation}`);
      }
    }
    
    // Check Certifications
    if (requiredCertifications.length > 0) {
      const resumeText = resume.parsedText.toLowerCase();
      const matchedCerts = [];
      const missingCerts = [];
      
      requiredCertifications.forEach(cert => {
        const certLower = cert.toLowerCase().trim();
        if (resumeText.includes(certLower)) {
          matchedCerts.push(cert);
        } else {
          missingCerts.push(cert);
        }
      });
      
      const certsScore = Math.round((matchedCerts.length / requiredCertifications.length) * 100);
      eligibilityResults.criteria.certifications = {
        status: certsScore >= 70 ? 'pass' : certsScore >= 40 ? 'partial' : 'fail',
        score: certsScore,
        details: {
          matched: matchedCerts,
          missing: missingCerts,
          total: requiredCertifications.length
        }
      };
      
      if (missingCerts.length > 0) {
        eligibilityResults.missingRequirements.push(`Missing certifications: ${missingCerts.join(', ')}`);
      }
    }
    
    // Check Additional Requirements
    if (additionalRequirements) {
      const resumeText = resume.parsedText.toLowerCase();
      const additionalLower = additionalRequirements.toLowerCase();
      
      // Simple keyword matching for additional requirements
      const keywords = additionalLower.split(/[,\s]+/).filter(word => word.length > 3);
      let matchedKeywords = 0;
      
      keywords.forEach(keyword => {
        if (resumeText.includes(keyword)) {
          matchedKeywords++;
        }
      });
      
      const additionalScore = Math.round((matchedKeywords / keywords.length) * 100);
      eligibilityResults.criteria.additional = {
        status: additionalScore >= 70 ? 'pass' : additionalScore >= 40 ? 'partial' : 'fail',
        score: additionalScore,
        details: {
          matchedKeywords,
          totalKeywords: keywords.length,
          requirement: additionalRequirements
        }
      };
      
      if (additionalScore < 70) {
        eligibilityResults.missingRequirements.push('Additional requirements not fully met');
      }
    }
    
    // Calculate Overall Score
    const criteriaScores = Object.values(eligibilityResults.criteria)
      .filter(criterion => criterion.status !== 'pending')
      .map(criterion => criterion.score);
    
    if (criteriaScores.length > 0) {
      eligibilityResults.overallScore = Math.round(criteriaScores.reduce((sum, score) => sum + score, 0) / criteriaScores.length);
    }
    
    // Determine Eligibility
    eligibilityResults.isEligible = eligibilityResults.overallScore >= 70 && 
      eligibilityResults.missingRequirements.length === 0;
    
    // Generate Recommendations
    if (!eligibilityResults.isEligible) {
      if (eligibilityResults.criteria.skills.score < 70) {
        eligibilityResults.recommendations.push('Consider gaining experience with required skills through courses or projects');
      }
      if (eligibilityResults.criteria.experience.score < 100) {
        eligibilityResults.recommendations.push('Look for opportunities to gain relevant experience');
      }
      if (eligibilityResults.criteria.education.score === 0) {
        eligibilityResults.recommendations.push('Consider pursuing the required education level');
      }
      if (eligibilityResults.criteria.certifications.score < 70) {
        eligibilityResults.recommendations.push('Obtain the required certifications');
      }
    }
    
    res.json(eligibilityResults);
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ error: 'Failed to check eligibility: ' + error.message });
  }
};

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
