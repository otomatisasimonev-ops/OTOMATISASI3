import db from "../config/database.js";

import User from "./user.js";
import BadanPublik from "./badanPublik.js";
import SmtpConfig from "./smtpConfig.js";
import EmailLog from "./emailLog.js";
import Assignment from "./assignment.js";
import QuotaRequest from "./quotaRequest.js";
import AssignmentHistory from "./assignmentHistory.js";
import Holiday from "./holiday.js";
import UjiAksesReport from "./ujiAksesReport.js";

// Relasi antar model

User.hasOne(SmtpConfig, {
  foreignKey: "user_id",
  as: "smtpConfig",
  onDelete: "CASCADE",
});
SmtpConfig.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(EmailLog, { foreignKey: "user_id", as: "emailLogs" });
EmailLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

BadanPublik.hasMany(EmailLog, { foreignKey: "badan_publik_id", as: "emailLogs" });
EmailLog.belongsTo(BadanPublik, { foreignKey: "badan_publik_id", as: "badanPublik" });

User.belongsToMany(BadanPublik, {
  through: Assignment,
  as: "assignments",
  foreignKey: "user_id",
  otherKey: "badan_publik_id",
});
BadanPublik.belongsToMany(User, {
  through: Assignment,
  as: "assignees",
  foreignKey: "badan_publik_id",
  otherKey: "user_id",
});

User.hasMany(QuotaRequest, { foreignKey: "user_id", as: "quotaRequests" });
QuotaRequest.belongsTo(User, { foreignKey: "user_id", as: "user" });

AssignmentHistory.belongsTo(User, { foreignKey: "actor_id", as: "actor" });
AssignmentHistory.belongsTo(User, { foreignKey: "user_id", as: "assignee" });
AssignmentHistory.belongsTo(BadanPublik, { foreignKey: "badan_publik_id", as: "badanPublik" });

User.hasMany(UjiAksesReport, { foreignKey: "user_id", as: "ujiAksesReports" });
UjiAksesReport.belongsTo(User, { foreignKey: "user_id", as: "user" });

BadanPublik.hasMany(UjiAksesReport, { foreignKey: "badan_publik_id", as: "ujiAksesReports" });
UjiAksesReport.belongsTo(BadanPublik, { foreignKey: "badan_publik_id", as: "badanPublik" });

// Export
export {
  db,
  User,
  BadanPublik,
  SmtpConfig,
  EmailLog,
  Assignment,
  QuotaRequest,
  AssignmentHistory,
  Holiday,
  UjiAksesReport,
};
