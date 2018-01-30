const { attributeFields } = require('graphql-sequelize');
const _ = require('lodash');
const { UserError } = require('graphql-errors');
const graphql = require('graphql');
const { User } = require('../models').mah;
const jwtDecode = require('jwt-decode');
const bcrypt = require('bcrypt-nodejs');


const {
  GraphQLObjectType: ObjectGraph,
  GraphQLString: Gstring,
  GraphQLNonNull: NotNull,
  GraphQLBoolean: Gboolean,
  GraphQLList: List,
  GraphQLInt: Int,
} = graphql;

const UserType = new ObjectGraph({
  name: 'User',
  description: 'Usuario que puede ser agencia o un usuario común',
  fields: _.assign(attributeFields(User)),
});

const SearchUserResultType = new ObjectGraph({
  name: 'SearchUserResult',
  fields: {
    Users: { type: List(UserType) },
    totalCount: { type: Int },
    hasNextPage: { type: Gboolean },
  },
});

const UserMutations = {
  modifyUserData: {
    type: UserType,
    description: 'Modifica los datos de un usuario',
    args: {
      MAHtoken: { type: new NotNull(Gstring) },
      name: { type: Gstring },
      address: { type: Gstring },
      phone: { type: Gstring },
    },
    resolve: (value, {
      name, address, phone, MAHtoken,
    }) => {
      const userId = jwtDecode(MAHtoken).id;
      return User.findById(userId)
        .then((us) => {
          if (!us) {
            throw new UserError('El usuario no existe.');
          } else {
            const UpdateData = {};
            if (name) { UpdateData.name = name; }
            if (address) { UpdateData.address = address; }
            if (phone) { UpdateData.phone = phone; }
            return us.update(UpdateData).then(usUp => usUp);
          }
        });
    },

  },
  updatePassword: {
    type: Gstring,
    args: {
      MAHtoken: { type: new NotNull(Gstring) },
      oldPassword: { type: new NotNull(Gstring) },
      newPassword: { type: new NotNull(Gstring) },
    },
    resolve: (value, { MAHtoken, oldPassword, newPassword }) => {
      const userId = jwtDecode(MAHtoken).id;
      return User.findById(userId)
        .then((us) => {
          if (!us) {
            throw new UserError('El usuario no existe.');
          } else if (!us.validPassword(oldPassword, us.password)) {
            throw new UserError('La contraseña actual no es correcta.');
          } else {
            const newPass = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(8), null);
            return us.update({
              password: newPass,
            }).then(() => 'Contraseña actualizada con éxito.');
          }
        });
    },
  },
};

module.exports = { UserType, UserMutations, SearchUserResultType };
