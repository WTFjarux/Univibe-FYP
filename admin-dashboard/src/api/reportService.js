// src/api/reportService.js

import api from "./axios";

/**
 * Reports API Service
 *
 * Handles all report-related API calls for the admin dashboard.
 * Uses the pre-configured axios instance with automatic token handling.
 */

/**
 * Fetch reports with filtering and pagination
 *
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Items per page (default: 15)
 * @param {string} params.status - Filter by status: pending, reviewing, resolved, dismissed, all
 * @param {string} params.targetType - Filter by content type: Post, Comment, User, Event, Group, Message, all
 * @param {string} params.search - Search by reporter name or description
 * @returns {Promise<Object>} Reports data with pagination
 */
export const getReports = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.status) queryParams.append("status", params.status);
    if (params.targetType && params.targetType !== "all")
      queryParams.append("targetType", params.targetType);
    if (params.search) queryParams.append("search", params.search);

    const response = await api.get(
      `/api/admin/reports?${queryParams.toString()}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw error;
  }
};

/**
 * Get report statistics
 *
 * @returns {Promise<Object>} Statistics including counts by status and type
 */
export const getReportStats = async () => {
  try {
    const response = await api.get("/api/admin/reports/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching report stats:", error);
    throw error;
  }
};

/**
 * Resolve a report with an action
 *
 * @param {string} reportId - Report ID to resolve
 * @param {Object} data - Resolution data
 * @param {string} data.resolution - Resolution type: content_removed, user_warned, user_banned, no_action
 * @param {string} data.resolutionNote - Admin notes about the resolution
 * @returns {Promise<Object>} Updated report data
 */
export const resolveReport = async (reportId, data) => {
  try {
    const response = await api.put(`/api/admin/reports/${reportId}/resolve`, {
      resolution: data.resolution,
      resolutionNote: data.resolutionNote || "",
    });
    return response.data;
  } catch (error) {
    console.error("Error resolving report:", error);
    throw error;
  }
};

/**
 * Dismiss a report
 *
 * @param {string} reportId - Report ID to dismiss
 * @param {string} reason - Reason for dismissal
 * @returns {Promise<Object>} Updated report data
 */
export const dismissReport = async (reportId, reason) => {
  try {
    const response = await api.put(`/api/admin/reports/${reportId}/dismiss`, {
      reason: reason || "Report dismissed",
    });
    return response.data;
  } catch (error) {
    console.error("Error dismissing report:", error);
    throw error;
  }
};

/**
 * Mark a report as under review
 *
 * @param {string} reportId - Report ID to review
 * @returns {Promise<Object>} Updated report data
 */
export const reviewReport = async (reportId) => {
  try {
    const response = await api.put(`/api/admin/reports/${reportId}/review`);
    return response.data;
  } catch (error) {
    console.error("Error reviewing report:", error);
    throw error;
  }
};

export default {
  getReports,
  getReportStats,
  resolveReport,
  dismissReport,
  reviewReport,
};
