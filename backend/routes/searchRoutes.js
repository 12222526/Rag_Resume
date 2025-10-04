import express from 'express';
import {
  askQuestion,
  searchResumes,
  getCandidateProfile,
  checkEligibility
} from '../controllers/searchController.js';

const router = express.Router();

// Routes
router.post('/ask', askQuestion);
router.get('/resumes', searchResumes);
router.get('/candidates/:id', getCandidateProfile);
router.post('/eligibility/:resumeId', checkEligibility);

export default router;
