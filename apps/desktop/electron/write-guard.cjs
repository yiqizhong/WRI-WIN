"use strict";

const approvedPaths = new Set();

function approvePath(filePath) {
  approvedPaths.add(filePath);
}

/** Returns true if filePath was approved by a dialog. Non-consuming — path stays approved for repeated saves. */
function consumePath(filePath) {
  return approvedPaths.has(filePath);
}

function isApproved(filePath) {
  return approvedPaths.has(filePath);
}

/** For tests: clear all approvals. */
function clearAll() {
  approvedPaths.clear();
}

module.exports = { approvePath, consumePath, isApproved, clearAll };
