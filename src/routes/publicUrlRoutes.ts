const router = require('express').Router();

const urlController = require('../controllers/urlController');
const validate = require('../utils/validator');
const fields = require('../validators/urlValidator');

/**
 * Public URL Routes
 *
 * Defines routes for public URL shortening and management that don't require authentication
 * @module routes/publicUrlRoutes
 */

/**
 * @swagger
 * /api/v1/public/urls:
 *   post:
 *     summary: Create a shortened URL without authentication
 *     tags: [Public URLs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - original_url
 *             properties:
 *               original_url:
 *                 type: string
 *                 description: The original URL to shorten
 *                 example: https://example.com/very-long-url-path
 *               custom_code:
 *                 type: string
 *                 description: Optional custom short code
 *                 example: mylink
 *               title:
 *                 type: string
 *                 description: Optional title for the URL
 *                 example: Example Title
 *               expiry_date:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date in ISO format
 *                 example: 2025-05-10T00:00:00Z
 *     responses:
 *       201:
 *         description: URL successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: Successfully created shortened URL
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 124
 *                     original_url:
 *                       type: string
 *                       example: https://example.com/very-long-url-path
 *                     short_code:
 *                       type: string
 *                       example: xyz789
 *                     short_url:
 *                       type: string
 *                       example: https://cylink.id/xyz789
 *                     title:
 *                       type: string
 *                       example: Example Title
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-04-10T12:30:00Z
 *                     expiry_date:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-05-10T00:00:00Z
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Custom code already in use
 *       500:
 *         description: Internal server error
 */
router.post('/', validate({ fields: fields.createUrl }), urlController.createAnonymousUrl);

module.exports = router;
