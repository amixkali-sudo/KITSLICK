const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();

// Import our custom modules with PostgreSQL support
const db = require('./db-pg');
const { initSocket, emitNewSnap } = require('./socket');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// --- Cleanup Job ---
// Function to delete expired snaps (older than 12 hours)
async function cleanupExpiredSnaps() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // Delete snaps that are older than 12 hours
        const result = await client.query(
            `DELETE FROM snaps 
             WHERE created_at < NOW() - INTERVAL '12 hours' 
             RETURNING id, image_url`
        );
        
        // Log the cleanup
        if (result.rowCount > 0) {
            console.log(`[${new Date().toISOString()}] Cleaned up ${result.rowCount} expired snaps`);
            
            // If you want to clean up the image files as well, uncomment this:
            /*
            for (const row of result.rows) {
                if (row.image_url) {
                    const filePath = path.join(__dirname, 'public', row.image_url);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted file: ${filePath}`);
                    } catch (err) {
                        console.error(`Error deleting file ${filePath}:`, err);
                    }
                }
            }
            */
        }
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during snap cleanup:', error);
    } finally {
        client.release();
    }
}

// Run cleanup immediately on server start
cleanupExpiredSnaps().catch(console.error);

// Schedule cleanup to run every hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(cleanupExpiredSnaps, CLEANUP_INTERVAL);

// --- Socket.IO Initialization ---
initSocket(server);

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- File Upload Setup ---
const uploadDir = path.join(__dirname, 'public', 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const fileExt = path.extname(file.originalname).toLowerCase();
        const newFilename = `${uuidv4()}${fileExt}`;
        cb(null, newFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'));
        }
    }
});

// --- Helper Functions ---
const handleDatabaseError = (res, error) => {
    console.error('Database error:', error);
    res.status(500).json({
        success: false,
        message: 'A database error occurred',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

// Serve the index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the upload page
app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

// Serve the feed page
app.get('/feed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'feed.html'));
});

// User registration
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, email = `${username}@example.com` } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        // Check if user already exists
        const userExists = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user with email (default to username@example.com if not provided)
        const result = await db.query(
            'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username',
            [username, hashedPassword, email]
        );
        
        // Generate JWT
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
        
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating account',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('Login attempt missing username or password');
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        console.log(`Login attempt for user: ${username}`);
        
        // Find user
        const result = await db.query(
            'SELECT id, username, password_hash FROM users WHERE username = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            console.log(`User not found: ${username}`);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        const user = result.rows[0];
        console.log(`User found: ${user.username} (ID: ${user.id})`);
        
        // Verify password
        console.log('Verifying password...');
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username or password' 
            });
        }
        
        // Generate JWT
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        
        // Get user data (excluding password)
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email || ''
        };
        
        res.json({
            success: true,
            token,
            user: userData
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Upload a new snap
app.post('/api/snaps', authenticateToken, upload.single('image'), async (req, res) => {
    console.log('Processing upload for user ID:', req.user.id);
    const { caption } = req.body;
    const userId = req.user.id;
    
    console.log('Caption:', caption);
    console.log('User ID:', userId);
    
    console.log('=== UPLOAD REQUEST RECEIVED ===');
    console.log('Headers:', req.headers);
    console.log('Files:', req.files);
    console.log('File:', req.file);
    console.log('Body:', req.body);
    console.log('User:', req.user);
    
    if (!req.file) {
        console.error('No file was uploaded');
        return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    
    console.log('Uploaded file details:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
    });

    const { hashtags = '', location = '' } = req.body;
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Set expiration time to 12 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 12);
        
        // Get user from JWT token
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        
        // Verify token and get user ID
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id; // Changed from decoded.userId to decoded.id
        
        // Get user details
        const userResult = await client.query(
            'SELECT id, username FROM users WHERE id = $1', 
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const username = userResult.rows[0].username;
        
        // Read the image file
        const imageData = fs.readFileSync(req.file.path);
        // Get hashtags from the request body (default to empty string if not provided)
        const hashtags = req.body.hashtags || '';
        
        // Insert the snap with the raw hashtags string and expiration time
        const result = await client.query(
            `INSERT INTO snaps (
                user_id, 
                caption, 
                hashtags,
                location, 
                image_data, 
                mime_type,
                image_url,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, created_at`,
            [
                userId, 
                caption, 
                hashtags,  
                location, 
                imageData, 
                req.file.mimetype,
                `/api/snaps/image/${Date.now()}-${req.file.originalname}`,  // Virtual URL
                expiresAt
            ]
        );
        
        // Process and insert individual hashtags into snaps_hashtags
        if (hashtags) {
            const snapId = result.rows[0].id;
            // Split hashtags by space or comma and clean them up
            const tags = hashtags.split(/[\s,]+/).filter(tag => tag.startsWith('#'));
            
            for (const tag of tags) {
                try {
                    // Insert each hashtag into snaps_hashtags
                    await client.query(
                        `INSERT INTO snaps_hashtags (snap_id, hashtag) 
                         VALUES ($1, $2) 
                         ON CONFLICT DO NOTHING`,
                        [snapId, tag]
                    );
                } catch (error) {
                    console.error('Error inserting hashtag:', tag, error);
                }
            }
        }
        
        // Remove the temporary file
        fs.unlinkSync(req.file.path);
        
        const snapId = result.rows[0].id;
        console.log('Snap uploaded successfully with ID:', snapId);
        
        const snap = {
            id: snapId,
            username: username,
            imageUrl: `/api/snaps/image/${snapId}`,  // New endpoint to serve images
            caption: caption,
            location: location,
            createdAt: result.rows[0].created_at
        };
        
        await client.query('COMMIT');
        
        // Notify connected clients about the new snap
        if (emitNewSnap) {
            emitNewSnap(snap);
        }
        
        res.status(201).json({
            success: true,
            snap: snap
        });
        
    } catch (error) {
        // Clean up the uploaded file if something went wrong
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        
        await client.query('ROLLBACK');
        console.error('Error uploading snap:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload snap',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        client.release();
    }
});

// Serve image data from database
app.get('/api/snaps/image/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT image_data, mime_type FROM snaps WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Image not found');
        }

        const { image_data, mime_type } = result.rows[0];
        
        // Set appropriate headers
        res.set('Content-Type', mime_type);
        res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(image_data);
        
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).send('Error serving image');
    }
});

// Get paginated feed of snaps
app.get('/api/feed', async (req, res) => {
    const client = await db.pool.connect();
    try {
        console.log('\n=== /api/feed request received ===');
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;
        
        console.log(`Fetching snaps - page: ${page}, limit: ${limit}, offset: ${offset}`);
        
        // First, get the basic snap data with user info
        const result = await db.query(
            `WITH snap_data AS (
                SELECT 
                    s.id, 
                    s.caption,
                    s.hashtags,
                    s.location,
                    s.created_at,
                    u.id as user_id,
                    u.username,
                    u.profile_picture_url
                FROM snaps s
                LEFT JOIN users u ON s.user_id = u.id
                ORDER BY s.created_at DESC
                LIMIT $1 OFFSET $2
            )
            SELECT 
                sd.*,
                (
                    SELECT json_agg(h.hashtag)
                    FROM snaps_hashtags h
                    WHERE h.snap_id = sd.id
                ) as hashtag_list,
                '/api/snaps/image/' || sd.id as "imageUrl",
                sd.created_at as "createdAt",
                sd.profile_picture_url as "profilePictureUrl"
            FROM snap_data sd`,
            [limit, offset]
        );
        
        console.log('\nRaw query result rows:', JSON.stringify(result.rows, null, 2));
        
        // Process the rows to ensure proper format
        const processedSnaps = result.rows.map(row => {
            const snap = { ...row };
            
            // Ensure hashtag_list is an array
            if (!Array.isArray(snap.hashtag_list)) {
                snap.hashtag_list = [];
                
                // If we have a hashtags string but no list, parse it
                if (snap.hashtags && typeof snap.hashtags === 'string') {
                    snap.hashtag_list = snap.hashtags.split(/\s+/).filter(tag => tag.startsWith('#'));
                }
            }
            
            console.log(`Processed snap ${snap.id}:`, {
                id: snap.id,
                caption: snap.caption,
                hashtags: snap.hashtags,
                hashtag_list: snap.hashtag_list
            });
            
            return snap;
        });
        
        // Get total count for pagination
        const countResult = await db.query('SELECT COUNT(*) FROM snaps');
        const totalSnaps = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalSnaps / limit);
        
        console.log(`\nSending response with ${processedSnaps.length} snaps`);
        
        res.json({
            success: true,
            snaps: processedSnaps,
            pagination: {
                page,
                limit,
                totalItems: totalSnaps,
                totalPages
            }
        });
        
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get a single snap by ID
app.get('/api/snaps/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                s.id, 
                s.image_url as "imageUrl",
                s.caption,
                s.hashtags,
                (SELECT array_agg(hashtag) FROM snaps_hashtags sh WHERE sh.snap_id = s.id) as hashtag_list,
                s.location,
                s.created_at as "createdAt",
                u.username,
                u.profile_picture_url as "profilePictureUrl"
            FROM snaps s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Snap not found'
            });
        }
        
        res.json({
            success: true,
            snap: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error fetching snap:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch snap',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

module.exports = { app, server };
