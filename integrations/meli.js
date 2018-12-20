require('dotenv').config();
const { Meli } = require('mercadolibre');
const decode = require('jwt-decode');
const NodeCache = require('node-cache');
const moment = require('moment');

const tokenCache = new NodeCache();


const meliObject = new Meli(process.env.MELI_ID, process.env.MELI_SECRET_KEY);
const {
  Publication,
  User,
  user_meli,
} = require('../models').mah;

const TESTUSERURL = '/users/test_user/';

// Functions
const addTokensToUser = (user_id, code, err, body) => {
  tokenCache.set(user_id, body.access_token, body.expires_in); // guardo el token en cache

  user_meli.findOne({ where: { user_id } })
    .then((um) => {
      if (!um) {
        return user_meli.create({ // creo el user_meli
          user_id,
          ml_user_id: body.user_id,
          user_token: body.access_token,
          user_refresh_token: body.refresh_token,
          user_code: code,
          expires_in: moment().add(body.expires_in, 'seconds').format(),
        });
      }
      return um.update({ // lo actualizo
        user_token: body.access_token,
        user_refresh_token: body.refresh_token,
        expires_in: moment().add(body.expires_in, 'seconds').format(),
      });
    });
};
// ===

// Rutas
const getMeliAuthURL = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;

  const meliToken = await tokenCache.get(user_id);
  if (!meliToken) {
    return user_meli.findOne({ where: { user_id } })
      .then((um) => {
        if (!um) {
          return res.send({ status: 'ok', message: meliObject.getAuthURL(`${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`) });
          // CUANDO YA ESTE LISTO EL FLUJO USAR ESTO  return res.redirect(meliObject.getAuthURL(`${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`));
        }
        if (moment().isAfter(um.expires_in)) {
          meliObject.refreshAccessToken(addTokensToUser.bind(null, user_id, null));
        }
        return res.send(({ status: 'ok' }));
      });
  }
  return res.send(({ status: 'ok', message: 'Token encontrado en cache.' }));
};
const addMeliUserCode = (req, res) => {
  const { code, user_id } = req.query;
  meliObject.authorize(code, `${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`, addTokensToUser.bind(null, user_id, code));
  res.send();
};
const createTestUser = (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;

  user_meli.findOne({ where: { user_id } })
    .then((um) => {
      console.log('token', um.dataValues.user_token);
      meliObject.post(TESTUSERURL, { site_id: 'MLA' }, { access_token: um.dataValues.user_token }, console.log);
      res.send();
    });
};

// ===

module.exports = {
  getMeliAuthURL,
  addMeliUserCode,
  createTestUser,
};
