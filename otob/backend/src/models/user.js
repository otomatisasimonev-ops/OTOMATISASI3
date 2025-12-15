const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("admin", "user"),
        allowNull: false,
        defaultValue: "user",
      },
      daily_quota: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
      },
      used_today: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_reset_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      refresh_token: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "Users",
    }
  );

  return User;
};
