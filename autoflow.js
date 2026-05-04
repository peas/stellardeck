// Shim — moved to packages/core/src/autoflow.js (2026-05-04, core extraction).
// Kept to preserve legacy `require('../autoflow.js')` resolution from tests
// and scripts during the @stellardeck/core extraction. Browser callers must
// load packages/core/src/autoflow.js directly (viewer.html already does so).
// This file will be deleted in step 6 of project_core_extraction_plan.md.
module.exports = require('./packages/core/src/autoflow.js');
