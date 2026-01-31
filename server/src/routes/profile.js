import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getProfile, updateProfile } from '../controllers/profile.js'

const router = Router()

router.get('/profile', authMiddleware, getProfile)
router.patch('/profile', authMiddleware, updateProfile)

export default router
