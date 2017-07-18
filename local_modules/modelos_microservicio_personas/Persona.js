module.exports = (sequelize, DataTypes) => {
  return sequelize.define('persona', {
    persona: {
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo usuario no puede estar vacío'
        }
      }
    }
  }, {
    timestamps: true,
    paranoid: false,
    comment: 'Personas registradas en el sistema',
    name: {
      plural: 'Personas',
      singular: 'Persona'
    },
    classMethods: {
      associate: function(modelo) {
        this.hasOne(modelo.Huella, {
          foreignKey: 'id'
        });
      }
    }
  });
};
