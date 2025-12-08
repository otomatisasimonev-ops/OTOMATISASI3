const sequelize = require('../config/database');
const UserModel = require('./user');
const BadanPublikModel = require('./badanPublik');
const SmtpConfigModel = require('./smtpConfig');
const EmailLogModel = require('./emailLog');

const User = UserModel(sequelize);
const BadanPublik = BadanPublikModel(sequelize);
const SmtpConfig = SmtpConfigModel(sequelize);
const EmailLog = EmailLogModel(sequelize);

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

module.exports = {
  sequelize,
  User,
  BadanPublik,
  SmtpConfig,
  EmailLog
};
