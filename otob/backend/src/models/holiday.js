const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Holiday = sequelize.define(
    'Holiday',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      tableName: 'Holidays'
    }
  );

  return Holiday;
};
