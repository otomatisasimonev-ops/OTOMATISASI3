const sequelize = require('../config/database');
const UserModel = require('./user');
const BadanPublikModel = require('./badanPublik');
const SmtpConfigModel = require('./smtpConfig');
const EmailLogModel = require('./emailLog');
const AssignmentModel = require('./assignment');
const QuotaRequestModel = require('./quotaRequest');
const AssignmentHistoryModel = require('./assignmentHistory');
const HolidayModel = require('./holiday');
const UjiAksesReportModel = require('./ujiAksesReport');

const User = UserModel(sequelize);
const BadanPublik = BadanPublikModel(sequelize);
const SmtpConfig = SmtpConfigModel(sequelize);
const EmailLog = EmailLogModel(sequelize);
const Assignment = AssignmentModel(sequelize);
const QuotaRequest = QuotaRequestModel(sequelize);
const AssignmentHistory = AssignmentHistoryModel(sequelize);
const Holiday = HolidayModel(sequelize);
const UjiAksesReport = UjiAksesReportModel(sequelize);

User.hasOne(SmtpConfig, {
  foreignKey: 'user_id',
  as: 'smtpConfig',
  onDelete: 'CASCADE'
});
SmtpConfig.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(EmailLog, { foreignKey: 'user_id', as: 'emailLogs' });
EmailLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

BadanPublik.hasMany(EmailLog, { foreignKey: 'badan_publik_id', as: 'emailLogs' });
EmailLog.belongsTo(BadanPublik, { foreignKey: 'badan_publik_id', as: 'badanPublik' });

User.belongsToMany(BadanPublik, {
  through: Assignment,
  as: 'assignments',
  foreignKey: 'user_id',
  otherKey: 'badan_publik_id'
});
BadanPublik.belongsToMany(User, {
  through: Assignment,
  as: 'assignees',
  foreignKey: 'badan_publik_id',
  otherKey: 'user_id'
});

User.hasMany(QuotaRequest, { foreignKey: 'user_id', as: 'quotaRequests' });
QuotaRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

AssignmentHistory.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
AssignmentHistory.belongsTo(User, { foreignKey: 'user_id', as: 'assignee' });
AssignmentHistory.belongsTo(BadanPublik, { foreignKey: 'badan_publik_id', as: 'badanPublik' });

User.hasMany(UjiAksesReport, { foreignKey: 'user_id', as: 'ujiAksesReports' });
UjiAksesReport.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

BadanPublik.hasMany(UjiAksesReport, { foreignKey: 'badan_publik_id', as: 'ujiAksesReports' });
UjiAksesReport.belongsTo(BadanPublik, { foreignKey: 'badan_publik_id', as: 'badanPublik' });

module.exports = {
  sequelize,
  User,
  BadanPublik,
  SmtpConfig,
  EmailLog,
  Assignment,
  QuotaRequest,
  AssignmentHistory,
  Holiday,
  UjiAksesReport
};
