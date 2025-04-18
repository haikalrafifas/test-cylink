import { Request, Response } from 'express';

const clickModel = require('../models/clickModel');
const urlModel = require('../models/urlModel');
const urlService = require('../services/urlService');
const logger = require('../utils/logger');
const { sendResponse } = require('../utils/response');

/**
 * URL Controller
 *
 * Handles URL-related operations including listing, creating, updating, and deleting shortened URLs
 * @module controllers/urlController
 */

/**
 * URL Database Entity interface
 */
interface UrlEntity {
  id: number;
  user_id: number | null;
  original_url: string;
  short_code: string;
  title: string | null;
  expiry_date: Date | null;
  is_active: boolean;
  has_password: boolean;
  password_hash: string | null;
  redirect_type: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * URL with click statistics interface
 */
interface UrlWithClicks {
  id: number;
  original_url: string;
  short_code: string;
  short_url: string;
  title: string | null;
  clicks: number;
  created_at: string;
  expiry_date: string | null;
  is_active: boolean;
}

/**
 * Pagination interface
 */
interface PaginationData {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * Get all URLs for an authenticated user
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with user's URLs or error
 */
exports.getAllUrls = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    if (!userId) {
      return sendResponse(res, 401, 'Unauthorized: No user ID');
    }

    // Parse query parameters for pagination and sorting
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Get all URLs for the user
    const urls = await urlModel.getUrlsByUser(userId);

    // If no URLs found, return 204 status
    if (!urls || urls.length === 0) {
      return sendResponse(res, 204, 'No URLs are available', []);
    }

    // For each URL, get the click count
    const urlsWithClicks = await Promise.all(
      urls.map(async (url: UrlEntity) => {
        const clickCount = await clickModel.getClickCountByUrlId(url.id);

        // Format expiry_date if it exists
        const expiryDate = url.expiry_date ? new Date(url.expiry_date).toISOString() : null;

        // Generate the full short URL
        const baseUrl = process.env.SHORT_URL_BASE ?? 'https://cylink.id/';
        const shortUrl = baseUrl + url.short_code;

        return {
          id: url.id,
          original_url: url.original_url,
          short_code: url.short_code,
          short_url: shortUrl,
          title: url.title ?? null,
          clicks: clickCount,
          created_at: new Date(url.created_at).toISOString(),
          expiry_date: expiryDate,
          is_active: url.is_active,
        };
      }),
    );

    // Apply sorting based on sortBy and sortOrder parameters
    const sortedUrls = [...urlsWithClicks].sort((a: UrlWithClicks, b: UrlWithClicks) => {
      let comparison = 0;

      // Handle different sortBy fields
      if (sortBy === 'clicks') {
        comparison = a.clicks - b.clicks;
      } else if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'title') {
        comparison = (a.title ?? '').localeCompare(b.title ?? '');
      } else {
        // Default to sorting by created_at
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      // Apply sort direction
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const paginatedUrls = sortedUrls.slice(offset, offset + limit);

    // Calculate pagination data
    const totalUrls = sortedUrls.length;
    const totalPages = Math.ceil(totalUrls / limit);

    // Construct pagination object
    const pagination: PaginationData = {
      total: totalUrls,
      page,
      limit,
      total_pages: totalPages,
    };

    logger.info(`Successfully retrieved ${paginatedUrls.length} URLs for user ${userId}`);

    // Return the response in the requested format
    return sendResponse(res, 200, 'Successfully retrieved all URLs', paginatedUrls, pagination);
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof TypeError) {
      logger.error('URL error: Type error while retrieving URLs:', error.message);
      return sendResponse(res, 400, 'Invalid data format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to retrieve URLs:', error.message);
      return sendResponse(res, 500, 'Failed to retrieve URLs', []);
    } else {
      logger.error('URL error: Unknown error while retrieving URLs:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};

/**
 * Utility function to validate a URL
 *
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is valid
 */
function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (error: unknown) {
    // URL constructor throws TypeError for invalid URLs
    if (error instanceof TypeError) {
      logger.debug('Invalid URL format:', url);
    }
    return false;
  }
}

/**
 * Create a shortened URL for anonymous users
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with created URL or error
 */
exports.createAnonymousUrl = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { original_url, custom_code, title, expiry_date, goal_id } = req.body;

    // Validate the URL
    if (!isValidUrl(original_url)) {
      return sendResponse(res, 400, 'Invalid URL provided');
    }

    // Create options object for URL creation
    const urlOptions = {
      originalUrl: original_url,
      customShortCode: custom_code,
      title,
      expiryDate: expiry_date ? new Date(expiry_date) : undefined,
      goalId: goal_id ? parseInt(goal_id) : undefined,
    };

    try {
      // Create the shortened URL
      const newUrl = await urlService.createShortenedUrl(urlOptions);

      // Generate the full short URL
      const baseUrl = process.env.SHORT_URL_BASE ?? 'https://cylink.id/';
      const shortUrl = baseUrl + newUrl.short_code;

      // Format the response
      const response = {
        id: newUrl.id,
        original_url: newUrl.original_url,
        short_code: newUrl.short_code,
        short_url: shortUrl,
        title: newUrl.title ?? null,
        created_at: new Date(newUrl.created_at).toISOString(),
        expiry_date: newUrl.expiry_date ? new Date(newUrl.expiry_date).toISOString() : null,
        is_active: newUrl.is_active,
        goal_id: goal_id ? parseInt(goal_id) : null,
      };

      logger.info(`Successfully created anonymous shortened URL: ${shortUrl}`);

      return sendResponse(res, 201, 'Successfully created shortened URL', response);
    } catch (error) {
      // Handle custom code already taken error
      if (error instanceof Error && error.message === 'This custom short code is already taken') {
        return sendResponse(res, 409, 'Custom code already in use');
      } else if (error instanceof TypeError) {
        logger.error('URL error: Type error while creating anonymous URL:', error.message);
        return sendResponse(res, 400, 'Invalid data format');
      } else if (error instanceof Error) {
        logger.error('URL error: Failed to create anonymous URL:', error.message);
        return sendResponse(res, 500, 'Internal Server Error');
      } else {
        logger.error('URL error: Unknown error while creating anonymous URL:', String(error));
        return sendResponse(res, 500, 'Internal server error');
      }
    }
  } catch (error: unknown) {
    // Handle specific error types
    if (error instanceof TypeError) {
      logger.error('URL error: Type error while creating shortened URL:', error.message);
      return sendResponse(res, 400, 'Invalid data format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to create shortened URL:', error.message);
      return sendResponse(res, 500, 'Internal Server Error');
    } else {
      logger.error('URL error: Unknown error while creating shortened URL:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};

/**
 * Create a shortened URL for authenticated users
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with created URL or error
 */
exports.createAuthenticatedUrl = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    // Extract request data
    const { original_url, custom_code, title, expiry_date, goal_id } = req.body;

    // Validate the URL
    if (!isValidUrl(original_url)) {
      return sendResponse(res, 400, 'Invalid URL provided');
    }

    // Create options object for URL creation
    const urlOptions = {
      userId,
      originalUrl: original_url,
      customShortCode: custom_code,
      title,
      expiryDate: expiry_date ? new Date(expiry_date) : undefined,
      goalId: goal_id ? parseInt(goal_id) : undefined,
    };

    try {
      // Create the shortened URL
      const newUrl = await urlService.createShortenedUrl(urlOptions);

      // Generate the full short URL
      const baseUrl = process.env.SHORT_URL_BASE ?? 'https://cylink.id/';
      const shortUrl = baseUrl + newUrl.short_code;

      // Format the response
      const response = {
        id: newUrl.id,
        original_url: newUrl.original_url,
        short_code: newUrl.short_code,
        short_url: shortUrl,
        title: newUrl.title ?? null,
        created_at: new Date(newUrl.created_at).toISOString(),
        expiry_date: newUrl.expiry_date ? new Date(newUrl.expiry_date).toISOString() : null,
        is_active: newUrl.is_active,
        goal_id: goal_id ? parseInt(goal_id) : null,
      };

      logger.info(
        `Successfully created authenticated shortened URL: ${shortUrl} for user ${userId}`,
      );

      return sendResponse(res, 201, 'Successfully created shortened URL', response);
    } catch (error: unknown) {
      // Handle custom code already taken error
      if (error instanceof Error && error.message === 'This custom short code is already taken') {
        return sendResponse(res, 409, 'Custom code already in use');
      } else if (error instanceof TypeError) {
        logger.error('URL error: Type error while creating authenticated URL:', error.message);
        return sendResponse(res, 400, 'Invalid data format');
      } else if (error instanceof Error) {
        logger.error('URL error: Failed to create authenticated URL:', error.message);
        return sendResponse(res, 500, 'Internal Server Error');
      } else {
        logger.error('URL error: Unknown error while creating authenticated URL:', String(error));
        return sendResponse(res, 500, 'Internal server error');
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('URL error: Failed to create shortened URL:', errorMessage);
    return sendResponse(res, 500, 'Internal Server Error');
  }
};

/**
 * Recent click information interface
 */
interface RecentClick {
  clicked_at: Date;
  device_type: string;
}

/**
 * Get URL details by ID or short code
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with URL details or error
 */
exports.getUrlDetails = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    // Get identifier (could be an ID or a short code)
    const { identifier } = req.params;

    // Determine if it's an ID (number) or a short code (string)
    const isId = !isNaN(Number(identifier));

    // Get the URL details
    let url;
    if (isId) {
      url = await urlModel.getUrlById(Number(identifier));
    } else {
      url = await urlModel.getUrlByShortCode(identifier);
    }

    // Check if URL exists
    if (!url) {
      return sendResponse(res, 404, 'URL not found');
    }

    // Check if the URL belongs to the authenticated user
    if (url.user_id && url.user_id !== userId) {
      return sendResponse(res, 401, 'Unauthorized');
    }

    // Get click count
    const clickCount = await clickModel.getClickCountByUrlId(url.id);

    // Get analytics
    const analytics = await urlService.getUrlAnalytics(url.id);

    // Get recent clicks (last 10)
    const recentClicks = await clickModel.getRecentClicksByUrlId(url.id, 10);

    // Format recent clicks
    const formattedRecentClicks = recentClicks.map((click: RecentClick) => ({
      timestamp: new Date(click.clicked_at).toISOString(),
      device_type: click.device_type ?? 'unknown',
    }));

    // Generate the full short URL
    const baseUrl = process.env.SHORT_URL_BASE ?? 'https://cylink.id/';
    const shortUrl = baseUrl + url.short_code;

    // Format dates
    const createdAt = new Date(url.created_at).toISOString();
    const updatedAt = url.updated_at ? new Date(url.updated_at).toISOString() : createdAt;
    const expiryDate = url.expiry_date ? new Date(url.expiry_date).toISOString() : null;

    // Construct response
    const response = {
      id: url.id,
      original_url: url.original_url,
      short_code: url.short_code,
      short_url: shortUrl,
      title: url.title ?? null,
      clicks: clickCount,
      created_at: createdAt,
      updated_at: updatedAt,
      expiry_date: expiryDate,
      is_active: url.is_active,
      analytics: {
        browser_stats: analytics.browserStats,
        device_stats: analytics.deviceStats,
        recent_clicks: formattedRecentClicks,
      },
    };

    logger.info(
      `Successfully retrieved URL details for ${isId ? 'ID' : 'short code'} ${identifier}`,
    );

    return sendResponse(res, 200, 'Successfully retrieved URL', response);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      logger.error('URL error: Type error while retrieving URL details:', error.message);
      return sendResponse(res, 400, 'Invalid request format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to retrieve URL details:', error.message);
      return sendResponse(res, 500, 'Internal Server Error');
    } else {
      logger.error('URL error: Unknown error while retrieving URL details:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};

/**
 * Delete a URL by ID (soft delete)
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with deletion result or error
 */
exports.deleteUrl = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    // Get URL ID from request parameters
    const urlId = parseInt(req.params.id);

    if (isNaN(urlId)) {
      return sendResponse(res, 400, 'Invalid URL ID');
    }

    // Check if URL exists
    const url = await urlModel.getUrlById(urlId);

    if (!url) {
      return sendResponse(res, 404, 'URL not found');
    }

    // Check if the URL belongs to the authenticated user
    if (url.user_id && url.user_id !== userId) {
      return sendResponse(res, 401, 'Unauthorized');
    }

    // Perform soft delete
    const isDeleted = await urlModel.deleteUrl(urlId);

    if (!isDeleted) {
      return sendResponse(res, 500, 'Failed to delete URL');
    }

    // Get the updated URL to return the deleted_at timestamp (including soft deleted URLs)
    const deletedUrl = await urlModel.getUrlById(urlId, true);

    // Format response
    const response = {
      id: deletedUrl.id,
      short_code: deletedUrl.short_code,
      deleted_at: new Date(deletedUrl.deleted_at).toISOString(),
    };

    logger.info(`Successfully deleted URL with ID ${urlId}`);

    return sendResponse(res, 200, 'Successfully deleted URL', response);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      logger.error('URL error: Type error while deleting URL:', error.message);
      return sendResponse(res, 400, 'Invalid request format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to delete URL:', error.message);
      return sendResponse(res, 500, 'Internal Server Error');
    } else {
      logger.error('URL error: Unknown error while deleting URL:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};

/**
 * Analytics filter options interface
 */
interface AnalyticsOptions {
  startDate?: string;
  endDate?: string;
  groupBy?: unknown;
}

/**
 * Get analytics for a specific URL
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with URL analytics or error
 */
exports.getUrlAnalytics = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    // Get URL ID from request parameters
    const urlId = parseInt(req.params.id);

    if (isNaN(urlId)) {
      return sendResponse(res, 400, 'Invalid URL ID');
    }

    // Check if URL exists
    const url = await urlModel.getUrlById(urlId);

    if (!url) {
      return sendResponse(res, 404, 'URL not found');
    }

    // Check if the URL belongs to the authenticated user
    if (url.user_id && url.user_id !== userId) {
      return sendResponse(res, 401, 'Unauthorized');
    }

    // Extract query parameters for analytics
    const { start_date, end_date, group_by } = req.query;

    // Prepare options for the analytics service
    const options: AnalyticsOptions = {};

    if (start_date) {
      options.startDate = start_date as string;
    }

    if (end_date) {
      options.endDate = end_date as string;
    }

    if (group_by && ['day', 'week', 'month'].includes(group_by as string)) {
      options.groupBy = group_by;
    }

    // Get analytics data with filters
    const analytics = await urlService.getUrlAnalyticsWithFilters(urlId, options);

    logger.info(`Successfully retrieved analytics for URL ID ${urlId}`);

    return sendResponse(res, 200, 'Successfully retrieved URL analytics', analytics);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'URL not found') {
      return sendResponse(res, 404, 'URL not found');
    } else if (error instanceof TypeError) {
      logger.error('URL error: Type error while retrieving analytics:', error.message);
      return sendResponse(res, 400, 'Invalid request format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to retrieve URL analytics:', error.message);
      return sendResponse(res, 500, 'Internal Server Error');
    } else {
      logger.error('URL error: Unknown error while retrieving analytics:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};

/**
 * Response for total clicks analytics
 */
interface TotalClicksAnalyticsResponse {
  summary: {
    total_clicks: number;
    total_urls: number;
    avg_clicks_per_url: number;
    analysis_period: {
      start_date: string;
      end_date: string;
      days: number;
    };
    comparison: {
      period_days: number;
      previous_period: {
        start_date: string;
        end_date: string;
      };
      total_clicks: {
        current: number;
        previous: number;
        change: number;
        change_percentage: number;
      };
      avg_clicks_per_url: {
        current: number;
        previous: number;
        change: number;
        change_percentage: number;
      };
      active_urls: {
        current: number;
        previous: number;
        change: number;
        change_percentage: number;
      };
    };
  };
  time_series: {
    data: Array<{
      date: string;
      clicks: number;
      urls_count: number;
      avg_clicks: number;
    }>;
    pagination: {
      total_items: number;
      total_pages: number;
      current_page: number;
      limit: number;
    };
  };
  top_performing_days: Array<{
    date: string;
    clicks: number;
    urls_count: number;
    avg_clicks: number;
  }>;
}

/**
 * Summary data interface for click analytics
 */
interface ClicksSummary {
  total_clicks?: number;
  total_urls?: number;
  avg_clicks_per_url?: number;
}

/**
 * Parse and validate date parameters for analytics
 *
 * @param startDateString Optional start date string
 * @param endDateString Optional end date string
 * @returns Object with validated dates or error response
 */
const parseAnalyticsDates = (startDateString?: string, endDateString?: string) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  // Parse start date
  if (startDateString) {
    startDate = new Date(startDateString);
    if (isNaN(startDate.getTime())) {
      return { error: 'Invalid start_date format. Use YYYY-MM-DD' };
    }
  } else {
    // Default to 30 days ago
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  }

  // Parse end date
  if (endDateString) {
    endDate = new Date(endDateString);
    if (isNaN(endDate.getTime())) {
      return { error: 'Invalid end_date format. Use YYYY-MM-DD' };
    }
  }

  // Validate date range
  if (endDate < startDate) {
    return { error: 'end_date must be after start_date' };
  }

  return { startDate, endDate };
};

/**
 * Determine comparison period for analytics
 *
 * @param comparison Comparison type
 * @param startDate Analysis start date
 * @param customStartString Custom comparison start date
 * @param customEndString Custom comparison end date
 * @returns Object with comparison period info or error
 */
const determineComparisonPeriod = (
  comparison: string,
  startDate: Date,
  customStartString?: string,
  customEndString?: string,
) => {
  let comparisonPeriodDays: number;
  let previousPeriodStartDate: Date;
  let previousPeriodEndDate: Date;

  if (comparison === 'custom') {
    // Custom comparison period
    if (!customStartString || !customEndString) {
      return {
        error:
          'custom_comparison_start and custom_comparison_end are required when comparison=custom',
      };
    }

    previousPeriodStartDate = new Date(customStartString);
    previousPeriodEndDate = new Date(customEndString);

    if (isNaN(previousPeriodStartDate.getTime()) || isNaN(previousPeriodEndDate.getTime())) {
      return { error: 'Invalid custom comparison date format. Use YYYY-MM-DD' };
    }

    if (previousPeriodEndDate < previousPeriodStartDate) {
      return { error: 'custom_comparison_end must be after custom_comparison_start' };
    }

    comparisonPeriodDays =
      Math.ceil(
        (previousPeriodEndDate.getTime() - previousPeriodStartDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;
  } else {
    // Standard comparison periods
    comparisonPeriodDays = parseInt(comparison) || 30;

    if (![7, 14, 30, 90].includes(comparisonPeriodDays)) {
      return { error: 'comparison must be one of: 7, 14, 30, 90, custom' };
    }

    // Calculate previous period dates
    previousPeriodEndDate = new Date(startDate);
    previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1);

    previousPeriodStartDate = new Date(previousPeriodEndDate);
    previousPeriodStartDate.setDate(previousPeriodStartDate.getDate() - (comparisonPeriodDays - 1));
  }

  return {
    comparisonPeriodDays,
    previousPeriodStartDate,
    previousPeriodEndDate,
  };
};

/**
 * Calculate comparison metrics for analytics
 *
 * @param current Current period data
 * @param previous Previous period data
 * @param activeUrlsCount Current period active URLs
 * @param previousActiveUrlsCount Previous period active URLs
 * @returns Comparison metrics
 */
const calculateComparisonMetrics = (
  current: ClicksSummary,
  previous: ClicksSummary,
  activeUrlsCount: number,
  previousActiveUrlsCount: number,
) => {
  const currentTotalClicks = current?.total_clicks ?? 0;
  const previousTotalClicks = previous?.total_clicks ?? 0;
  const clicksChange = currentTotalClicks - previousTotalClicks;
  const clicksChangePercentage =
    previousTotalClicks === 0
      ? 0
      : parseFloat(((clicksChange / previousTotalClicks) * 100).toFixed(2));

  const currentAvgClicks = current?.avg_clicks_per_url ?? 0;
  const previousAvgClicks = previous?.avg_clicks_per_url ?? 0;
  const avgClicksChange = currentAvgClicks - previousAvgClicks;
  const avgClicksChangePercentage =
    previousAvgClicks === 0
      ? 0
      : parseFloat(((avgClicksChange / previousAvgClicks) * 100).toFixed(2));

  const urlsChange = activeUrlsCount - previousActiveUrlsCount;
  const urlsChangePercentage =
    previousActiveUrlsCount === 0
      ? 0
      : parseFloat(((urlsChange / previousActiveUrlsCount) * 100).toFixed(2));

  return {
    total_clicks: {
      current: currentTotalClicks,
      previous: previousTotalClicks,
      change: clicksChange,
      change_percentage: clicksChangePercentage,
    },
    avg_clicks_per_url: {
      current: currentAvgClicks,
      previous: previousAvgClicks,
      change: avgClicksChange,
      change_percentage: avgClicksChangePercentage,
    },
    active_urls: {
      current: activeUrlsCount,
      previous: previousActiveUrlsCount,
      change: urlsChange,
      change_percentage: urlsChangePercentage,
    },
  };
};

/**
 * Get total clicks analytics for all URLs of a user
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Promise<Response>} Response with analytics data
 */
exports.getTotalClicksAnalytics = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user ID from authentication token
    const userId = req.body.id;

    if (!userId) {
      return sendResponse(res, 401, 'Unauthorized: No user ID');
    }

    // Parse query parameters
    const startDateString = req.query.start_date as string;
    const endDateString = req.query.end_date as string;
    const comparison = (req.query.comparison as string) ?? '30';
    const customComparisonStartString = req.query.custom_comparison_start as string;
    const customComparisonEndString = req.query.custom_comparison_end as string;
    const groupBy = (req.query.group_by as 'day' | 'week' | 'month') ?? 'day';
    const page = parseInt(req.query.page as string) ?? 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 90); // Cap at 90 data points

    // Parse and validate dates
    const dateResult = parseAnalyticsDates(startDateString, endDateString);
    if ('error' in dateResult) {
      return sendResponse(res, 400, dateResult.error);
    }
    const { startDate, endDate } = dateResult;

    // Calculate days in the analysis period
    const analysisPeriodDays =
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Determine comparison period
    const comparisonResult = determineComparisonPeriod(
      comparison,
      startDate,
      customComparisonStartString,
      customComparisonEndString,
    );

    if ('error' in comparisonResult) {
      return sendResponse(res, 400, comparisonResult.error);
    }

    const { comparisonPeriodDays, previousPeriodStartDate, previousPeriodEndDate } =
      comparisonResult;

    // Prepare query options
    const options = { startDate, endDate, groupBy };
    const previousPeriodOptions = {
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
    };

    // Fetch analytics data
    const [
      clicksAnalytics,
      summary,
      topPerformingDays,
      activeUrlsCount,
      previousSummary,
      previousActiveUrlsCount,
    ] = await Promise.all([
      clickModel.getTotalClicksAnalytics(userId, options),
      clickModel.getTotalClicksSummary(userId, options),
      clickModel.getTopPerformingDays(userId, options),
      clickModel.getActiveUrlsCount(userId, options),
      clickModel.getTotalClicksSummary(userId, previousPeriodOptions),
      clickModel.getActiveUrlsCount(userId, previousPeriodOptions),
    ]);

    // Apply pagination to time series data
    const totalItems = clicksAnalytics.length;
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;
    const paginatedTimeSeries = clicksAnalytics.slice(offset, offset + limit);

    // Format dates for response
    const analysisStartDateStr = startDate.toISOString().split('T')[0];
    const analysisEndDateStr = endDate.toISOString().split('T')[0];
    const prevStartDateStr = previousPeriodStartDate.toISOString().split('T')[0];
    const prevEndDateStr = previousPeriodEndDate.toISOString().split('T')[0];

    // Calculate comparison metrics
    const comparisonMetrics = calculateComparisonMetrics(
      summary,
      previousSummary,
      activeUrlsCount,
      previousActiveUrlsCount,
    );

    // Construct the response
    const responseData: TotalClicksAnalyticsResponse = {
      summary: {
        total_clicks: summary?.total_clicks ?? 0,
        total_urls: summary?.total_urls ?? 0,
        avg_clicks_per_url: summary?.avg_clicks_per_url ?? 0,
        analysis_period: {
          start_date: analysisStartDateStr,
          end_date: analysisEndDateStr,
          days: analysisPeriodDays,
        },
        comparison: {
          period_days: comparisonPeriodDays,
          previous_period: {
            start_date: prevStartDateStr,
            end_date: prevEndDateStr,
          },
          ...comparisonMetrics,
        },
      },
      time_series: {
        data: paginatedTimeSeries,
        pagination: {
          total_items: totalItems,
          total_pages: totalPages,
          current_page: page,
          limit,
        },
      },
      top_performing_days: topPerformingDays,
    };

    logger.info(`Successfully retrieved total clicks analytics for user ${userId}`);
    return sendResponse(res, 200, 'Successfully retrieved total clicks analytics', responseData);
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      logger.error('URL error: Type error while retrieving total clicks analytics:', error.message);
      return sendResponse(res, 400, 'Invalid request format');
    } else if (error instanceof Error) {
      logger.error('URL error: Failed to retrieve total clicks analytics:', error.message);
      return sendResponse(res, 500, 'Failed to retrieve total clicks analytics');
    } else {
      logger.error('URL error: Unknown error while retrieving total clicks:', String(error));
      return sendResponse(res, 500, 'Internal server error');
    }
  }
};
