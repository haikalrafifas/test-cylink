const router = require('express').Router();

const { getQrCodeByUrlId } = require('../controllers/qrCodeController');
const urlController = require('../controllers/urlController');
const { accessToken } = require('../middlewares/authMiddleware');
const validate = require('../utils/validator');
const fields = require('../validators/urlValidator');

/**
 * URL Routes
 *
 * Defines routes for URL shortening and management
 * @module routes/urlRoutes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Url:
 *       type: object
 *       required:
 *         - original_url
 *       properties:
 *         id:
 *           type: integer
 *           description: The URL ID
 *           example: 123
 *         original_url:
 *           type: string
 *           description: The original URL to shorten
 *           example: https://example.com/very-long-url-path
 *         short_code:
 *           type: string
 *           description: The short code for the URL
 *           example: abc123
 *         short_url:
 *           type: string
 *           description: The complete shortened URL
 *           example: https://cylink.id/abc123
 *         title:
 *           type: string
 *           description: A title for the URL (optional)
 *           example: Example Website
 *         clicks:
 *           type: integer
 *           description: Number of times the URL was clicked
 *           example: 42
 *         user_id:
 *           type: integer
 *           description: ID of the user who created the URL
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         expiry_date:
 *           type: string
 *           format: date-time
 *           description: Expiration date (optional)
 *         is_active:
 *           type: boolean
 *           description: Whether the URL is active
 *           example: true
 */

/**
 * @swagger
 * /api/v1/urls:
 *   get:
 *     summary: Get all URLs for authenticated user
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, clicks, title]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: A list of URLs with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved all URLs
 *                 data:
 *                   type: object
 *                   properties:
 *                     urls:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Url'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 57
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 10
 *                         total_pages:
 *                           type: integer
 *                           example: 6
 *       401:
 *         description: Unauthorized, authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  accessToken,
  validate({ query: fields.getUrls, preserveBodyProps: true }),
  urlController.getAllUrls,
);

/**
 * @swagger
 * /api/v1/urls:
 *   post:
 *     summary: Create a shortened URL for authenticated users
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
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
 *                   $ref: '#/components/schemas/Url'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized, authentication required
 *       409:
 *         description: Custom code already in use
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  accessToken,
  validate({ fields: fields.createUrl, preserveBodyProps: true }),
  urlController.createAuthenticatedUrl,
);

/**
 * @swagger
 * /api/v1/urls/total-clicks:
 *   get:
 *     summary: Get total clicks analytics across all user's URLs
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analysis (format YYYY-MM-DD, default 30 days ago)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analysis (format YYYY-MM-DD, default today)
 *       - in: query
 *         name: comparison
 *         schema:
 *           type: string
 *           enum: ['7', '14', '30', '90', 'custom']
 *           default: '30'
 *         description: Comparison period in days
 *       - in: query
 *         name: custom_comparison_start
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom comparison period start date (required when comparison=custom)
 *       - in: query
 *         name: custom_comparison_end
 *         schema:
 *           type: string
 *           format: date
 *         description: Custom comparison period end date (required when comparison=custom)
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: How to group time series data
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for time series data pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Number of time series data points per page
 *     responses:
 *       200:
 *         description: Successfully retrieved total clicks analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved total clicks analytics
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_clicks:
 *                           type: integer
 *                           example: 14256
 *                         total_urls:
 *                           type: integer
 *                           example: 143
 *                         avg_clicks_per_url:
 *                           type: number
 *                           format: float
 *                           example: 99.69
 *                         analysis_period:
 *                           type: object
 *                           properties:
 *                             start_date:
 *                               type: string
 *                               format: date
 *                               example: 2025-03-19
 *                             end_date:
 *                               type: string
 *                               format: date
 *                               example: 2025-04-18
 *                             days:
 *                               type: integer
 *                               example: 30
 *                         comparison:
 *                           type: object
 *                           properties:
 *                             period_days:
 *                               type: integer
 *                               example: 30
 *                             previous_period:
 *                               type: object
 *                               properties:
 *                                 start_date:
 *                                   type: string
 *                                   format: date
 *                                   example: 2025-02-17
 *                                 end_date:
 *                                   type: string
 *                                   format: date
 *                                   example: 2025-03-18
 *                             total_clicks:
 *                               type: object
 *                               properties:
 *                                 current:
 *                                   type: integer
 *                                   example: 14256
 *                                 previous:
 *                                   type: integer
 *                                   example: 12105
 *                                 change:
 *                                   type: integer
 *                                   example: 2151
 *                                 change_percentage:
 *                                   type: number
 *                                   format: float
 *                                   example: 17.77
 *                             avg_clicks_per_url:
 *                               type: object
 *                               properties:
 *                                 current:
 *                                   type: number
 *                                   format: float
 *                                   example: 99.69
 *                                 previous:
 *                                   type: number
 *                                   format: float
 *                                   example: 91.02
 *                                 change:
 *                                   type: number
 *                                   format: float
 *                                   example: 8.67
 *                                 change_percentage:
 *                                   type: number
 *                                   format: float
 *                                   example: 9.53
 *                             active_urls:
 *                               type: object
 *                               properties:
 *                                 current:
 *                                   type: integer
 *                                   example: 143
 *                                 previous:
 *                                   type: integer
 *                                   example: 133
 *                                 change:
 *                                   type: integer
 *                                   example: 10
 *                                 change_percentage:
 *                                   type: number
 *                                   format: float
 *                                   example: 7.52
 *                     time_series:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 example: 2025-03-20
 *                               clicks:
 *                                 type: integer
 *                                 example: 486
 *                               urls_count:
 *                                 type: integer
 *                                 example: 122
 *                               avg_clicks:
 *                                 type: number
 *                                 format: float
 *                                 example: 3.98
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             total_items:
 *                               type: integer
 *                               example: 30
 *                             total_pages:
 *                               type: integer
 *                               example: 1
 *                             current_page:
 *                               type: integer
 *                               example: 1
 *                             limit:
 *                               type: integer
 *                               example: 30
 *                     top_performing_days:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: 2025-04-05
 *                           clicks:
 *                             type: integer
 *                             example: 689
 *                           urls_count:
 *                             type: integer
 *                             example: 138
 *                           avg_clicks:
 *                             type: number
 *                             format: float
 *                             example: 4.99
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: Invalid parameters
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - end_date must be after start_date
 *                     - comparison value must be one of: 7, 14, 30, 90, custom
 *       401:
 *         description: Unauthorized, authentication required
 *       500:
 *         description: Internal server error
 */
router.get(
  '/total-clicks',
  accessToken,
  validate({ query: fields.getTotalClicksAnalytics, preserveBodyProps: true }),
  urlController.getTotalClicksAnalytics,
);

/**
 * @swagger
 * /api/v1/urls/{identifier}:
 *   get:
 *     summary: Get details of a specific URL by ID
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: URL ID or short code
 *     responses:
 *       200:
 *         description: URL details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved URL details
 *                 data:
 *                   $ref: '#/components/schemas/Url'
 *       401:
 *         description: Unauthorized, authentication required
 *       404:
 *         description: URL not found
 *       500:
 *         description: Internal server error
 */
router.get('/:identifier', accessToken, urlController.getUrlDetails);

/**
 * @swagger
 * /api/v1/urls/{id}:
 *   delete:
 *     summary: Delete a URL by ID
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: URL ID to delete
 *     responses:
 *       200:
 *         description: URL successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully deleted URL
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     short_code:
 *                       type: string
 *                       example: abc123
 *                     deleted_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized, authentication required
 *       404:
 *         description: URL not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', accessToken, urlController.deleteUrl);

/**
 * @swagger
 * /api/v1/urls/{id}/analytics:
 *   get:
 *     summary: Get analytics for a specific URL
 *     tags: [URLs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: URL ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (ISO format)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (ISO format)
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Grouping for time series data
 *     responses:
 *       200:
 *         description: URL analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully retrieved URL analytics
 *                 data:
 *                   type: object
 *                   properties:
 *                     url_id:
 *                       type: integer
 *                       example: 123
 *                     short_code:
 *                       type: string
 *                       example: abc123
 *                     total_clicks:
 *                       type: integer
 *                       example: 42
 *                     unique_visitors:
 *                       type: integer
 *                       example: 30
 *                     time_series_data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: 2025-01
 *                           clicks:
 *                             type: integer
 *                             example: 15
 *                     browser_stats:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     device_stats:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     top_referrers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           referrer:
 *                             type: string
 *                             example: google.com
 *                           count:
 *                             type: integer
 *                             example: 10
 *       401:
 *         description: Unauthorized, authentication required
 *       404:
 *         description: URL not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/analytics',
  accessToken,
  validate({ query: fields.getUrlAnalytics, preserveBodyProps: true }),
  urlController.getUrlAnalytics,
);

/**
 * Get QR code for a specific URL by URL ID
 *
 * @route GET /api/v1/urls/:url_id/qr-code
 * @param {string} authorization - Bearer token for user authentication
 * @param {number} url_id - URL ID to get QR code for
 * @returns {object} QR code data
 *
 * @example
 * // Request
 * GET /api/v1/urls/123/qr-code
 * Authorization: Bearer {token}
 *
 * // Response
 * {
 *   "status": 200,
 *   "message": "Successfully retrieved QR code",
 *   "data": {
 *     "id": 45,
 *     "url_id": 123,
 *     "short_code": "abc123",
 *     "short_url": "https://cylink.id/abc123",
 *     "qr_code_url": "https://cylink.id/qr/abc123",
 *     "png_url": "https://cylink.id/qr/abc123.png",
 *     "svg_url": "https://cylink.id/qr/abc123.svg",
 *     "color": "#000000",
 *     "background_color": "#FFFFFF",
 *     "include_logo": true,
 *     "logo_size": 0.25,
 *     "size": 300,
 *     "created_at": "2025-04-15T10:30:00Z"
 *   }
 * }
 */
router.get('/:url_id/qr-code', accessToken, getQrCodeByUrlId);

module.exports = router;
