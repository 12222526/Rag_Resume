import express from 'express';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  matchJob,
  getJobMatches
} from '../controllers/jobsController.js';

const router = express.Router();

// Routes
router.post('/', createJob);
router.get('/', getJobs);
router.get('/:id', getJobById);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);
router.post('/:id/match', matchJob);
router.get('/:id/matches', getJobMatches);

export default router;
