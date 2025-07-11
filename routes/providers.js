import express from 'express';
import Provider from '../models/Provider.js';
import Service from '../models/Service.js';
import auth from '../middleware/auth.js';
import { storage } from '../utils/firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import multer from 'multer';

const router = express.Router();

// Multer configuration for temporary storage
const upload = multer({ storage: multer.memoryStorage() });

// Get all providers with optional search and location filters
router.get('/', async (req, res) => {
  try {
    const { query, location } = req.query;
    let filter = {};

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { service: { $regex: query, $options: 'i' } },
      ];
    }

    const providers = await Provider.find(filter).populate('services').populate('reviews');
    console.log(`Fetched ${providers.length} providers for query:`, { query, location });
    res.json(providers);
  } catch (err) {
    console.error('Get providers error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get single provider by ID
router.get('/:providerId', async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.providerId).populate('services').populate('reviews');
    if (!provider) {
      console.log(`Provider not found for ID ${req.params.providerId}`);
      return res.status(404).json({ message: 'Provider not found' });
    }
    res.json(provider);
  } catch (err) {
    console.error('Get provider error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get provider profile
router.get('/profile', auth, async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id }).populate('services').populate('reviews');
    if (!provider) {
      console.log(`Provider not found for user ${req.user.id}`);
      return res.status(404).json({ message: 'Provider profile not found' });
    }
    res.json(provider);
  } catch (err) {
    console.error('Get provider profile error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Update provider profile
router.put('/profile', auth, async (req, res) => {
  try {
    let provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      provider = new Provider({
        user: req.user.id,
        name: req.user.name,
        service: req.body.service,
        location: req.body.location,
      });
    } else {
      provider.service = req.body.service || provider.service;
      provider.location = req.body.location || provider.location;
    }
    await provider.save();
    console.log(`Provider profile updated for user ${req.user.id}`);
    res.json(provider);
  } catch (err) {
    console.error('Update provider profile error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Upload provider photo to Firebase
router.post('/upload-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      console.log(`Provider not found for user ${req.user.id}`);
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const file = req.file;
    const storageRef = ref(storage, `provider_photos/${provider._id}_${Date.now()}_${file.originalname}`);
    await uploadBytes(storageRef, file.buffer);
    const photoURL = await getDownloadURL(storageRef);

    provider.photo = photoURL;
    await provider.save();
    console.log(`Photo uploaded for provider ${provider._id}: ${photoURL}`);
    res.json({ photo: photoURL });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

export default router;