module.exports = (sequelize, DataTypes) => {
  return sequelize.define('huellas', {
    imagen: {
      type: DataTypes.STRING(73728),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo imágen no puede estar vacío'
        }
      }
    },
    plantilla: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo plantilla no puede estar vacío'
        }
      }
    }
  }, {
    timestamps: true,
    paranoid: false,
    comment: 'Huellas registradas en el sistema',
    name: {
      plural: 'Huellas',
      singular: 'Huella'
    },
    classMethods: {
      associate: function(modelo) {
        this.belongsTo(modelo.Persona, {
          foreignKey: 'id'
        });
      }
    }
  });
};
