/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Migration removed - cannot set file fields to filename strings in migrations
  // File fields require actual file uploads through the API
  // This migration has been disabled to prevent startup failures
  console.log("Migration 1776031505_001_update_products_by_filter.js - skipped (file field assignment not supported)");
}, (app) => {
  // Rollback: no-op
})
