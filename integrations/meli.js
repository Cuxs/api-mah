require('dotenv').config();
const { Meli } = require('mercadolibre');
const decode = require('jwt-decode');
const NodeCache = require('node-cache');
const moment = require('moment');
const split = require('split-object');
const { prepareArrayToSharp } = require('../helpers');

const {
  User,
  Publication,
  user_meli,
  ImageGroup,
  sequelize,
} = require('../models').mah;

const meliCache = new NodeCache();

const meliObject = new Meli(process.env.MELI_ID, process.env.MELI_SECRET_KEY);

const TESTUSERURL = '/users/test_user/';
const NOCATEGORIESURL = '/categories/MLA1743';
const CATEGORIESURL = '/categories';
const COUNTRYURL = '/classified_locations/countries/AR';
const STATEURL = '/classified_locations/states';
const CITYURL = '/classified_locations/cities';
const BARRIOURL = '/classified_locations/cities';
const STATUSURL = '/users';
const VALIDATIONURL = '/items/validate';
const PUBLICATIONURL = '/items/';

// Functions
const addTokensToUser = (user_id, code, err, body) => {
  user_meli.findOne({ where: { user_id } }).then((um) => {
    if (!um) {
      return user_meli.create({
        // creo el user_meli
        user_id,
        ml_user_id: body.user_id,
        user_token: body.access_token,
        user_refresh_token: body.refresh_token,
        user_code: code,
        expires_in: moment()
          .add(body.expires_in, 'seconds')
          .format(),
      });
    }
    return um.update({
      // lo actualizo
      user_token: body.access_token,
      user_refresh_token: body.refresh_token,
      expires_in: moment()
        .add(body.expires_in, 'seconds')
        .format(),
    });
  });
};
const handleResponse = (res, url, err, body) => {
  if (url) {
    meliCache.set(url, body);
  }
  if (err) {
    return res.status(400).send({ status: 'error', message: err });
  }
  return res.send({ status: 'ok', data: body });
};
const handleCreatePubResponse = (res, pub, edited, err, body) => {
  if (err) {
    return res.status(400).send({ status: 'error', message: err });
  }
  if (edited) {
    return pub.update({ body })
      .then(() => res.send({ status: 'ok', data: body }));
  }
  pub
    .update({ ml_id: body.id })
    .then(() => res.send({ status: 'ok', data: body }));
};
const validateToken = (um, res, user_id) => {
  if (!um) {
    return res.send({
      status: 'error',
      message: 'Su sesión expiró.',
      url: meliObject.getAuthURL(`${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`),
    });
    // CUANDO YA ESTE LISTO EL FLUJO USAR ESTO  return res.redirect(meliObject.getAuthURL(`${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`));
  }
  if (moment().isAfter(um.expires_in)) {
    meliObject.refreshAccessToken(addTokensToUser.bind(null, user_id, null));
  }
};
const parseMeliCarData = (us, body, images) => {
  const data = {
    title: `${body.brand} ${body.modelName} ${body.title}`,
    site_id: 'MLA',
    location: {
      address_line: body.address,
      zip_code: body.cp,
      neighborhood: {
        id: body.neighborhood,
      },
      city: {
        id: body.city,
      },
      state: {
        id: body.state,
      },
      country: {
        id: 'AR',
      },
    },
    seller_contact: {
      contact: us.name,
      phone: us.phone,
      phone2: us.agencyPhone,
      email: us.email,
    },
    available_quantity: 1,
    description: {
      plain_text: body.description,
    },
    attributes: split(JSON.parse(body.attributes)).map(row => ({
      id: row.key,
      value_name: row.value,
    })),
    pictures: images
      ? split(images).map(row => ({
        source: `${process.env.API_URL}/${row.value}`,
      }))
      : [],
  };
  delete body.title;
  delete body.address;
  delete body.cp;
  delete body.neighborhood;
  delete body.city;
  delete body.state;
  delete body.description;
  delete body.attributes;
  delete body.modelName;
  delete body.brand;
  return { ...data, ...body };
};
// ================================

// Rutas
const getMeliAuthURL = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;
  return user_meli.findOne({ where: { user_id } }).then((um) => {
    validateToken(um, res, user_id);
    return res.send({ status: 'ok' });
  });
};
const addMeliUserCode = (req, res) => {
  const { code, user_id } = req.query;
  meliObject.authorize(
    code,
    `${process.env.API_URL}/addMeliUserCode?user_id=${user_id}`,
    addTokensToUser.bind(null, user_id, code),
  );
  // donde redirijo?
  res.send();
};
const createTestUser = (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;

  user_meli.findOne({ where: { user_id } }).then((um) => {
    console.log('token', um.dataValues.user_token);
    meliObject.post(
      TESTUSERURL,
      { site_id: 'MLA' },
      { access_token: um.dataValues.user_token },
      console.log,
    );
    res.send();
  });
};

const meliCategory = async (req, res) => {
  const { category, attributes } = req.params;
  let categoryURL = category ? `${CATEGORIESURL}/${category}` : NOCATEGORIESURL;
  categoryURL = attributes ? `${categoryURL}/${attributes}` : categoryURL;
  const categoryRes = await meliCache.get(categoryURL);
  if (!categoryRes) {
    return meliObject.get(
      categoryURL,
      handleResponse.bind(null, res, categoryURL),
    );
  }
  handleResponse(res, null, null, categoryRes);
};
const provinceMeli = async (req, res) =>
  meliObject.get(COUNTRYURL, handleResponse.bind(null, res, COUNTRYURL));

const stateMeli = async (req, res) => {
  const { province_id } = req.params;
  const stateUrl = `${STATEURL}/${province_id}`;

  meliObject.get(stateUrl, handleResponse.bind(null, res, stateUrl));
};
const cityMeli = async (req, res) => {
  const { state_id } = req.params;
  const cityUrl = `${CITYURL}/${state_id}`;

  meliObject.get(cityUrl, handleResponse.bind(null, res, cityUrl));
};
const neighborhoodMeli = (req, res) => {
  const { city_id } = req.params;
  const barrioUrl = `${BARRIOURL}/${city_id}`;

  meliObject.get(barrioUrl, handleResponse.bind(null, res, barrioUrl));
};
const userStatusMeli = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;
  return user_meli.findOne({ where: { user_id } }).then((um) => {
    validateToken(um, res, user_id);

    meliObject.get(
      `${STATUSURL}/${um.dataValues.ml_user_id}/classifieds_promotion_packs`,
      { package_content: 'ALL', access_token: um.dataValues.user_token },
      handleResponse.bind(null, res, null),
    );
  });
};
const validatePublicationMeli = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;

  return user_meli.findOne({ where: { user_id } }).then((um) => {
    validateToken(um, res, user_id);
    return User.findByPk(um.user_id).then((us) => {
      const carData = parseMeliCarData(us, req.body);

      return meliObject.post(
        VALIDATIONURL,
        carData,
        { access_token: um.user_token },
        handleResponse.bind(null, res, null),
      );
    });
  });
};
const publicationMeli = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;
  const imageGroup = req.files;
  const imageData = {};

  if (!imageGroup || imageGroup.length === 0) {
    res
      .status(400)
      .send({
        status: 'error',
        message: 'Por favor elija aunque sea una imágen',
      });
    return false;
  }

  sequelize.transaction().then(t =>
    user_meli.findOne({ where: { user_id } }).then((um) => {
      validateToken(um, res, user_id);
      return Promise.all(prepareArrayToSharp(imageGroup))
        .then(() => {
          for (let i = 0; i < imageGroup.length; i += 1) {
            const objectName = `image${i + 1}`;
            imageData[objectName] = `opt-${imageGroup[i].filename}`;
          }
          return ImageGroup.create(imageData, { transaction: t });
        })
        .then(resp =>
          Publication.create(
            {
              brand: req.body.brand,
              group: JSON.parse(req.body.attributes).TRIM,
              modelName: req.body.modelName,
              kms: JSON.parse(req.body.attributes).KILOMETERS || null,
              price: req.body.price || null,
              year: JSON.parse(req.body.attributes).VEHICLE_YEAR,
              fuel: JSON.parse(req.body.attributes).FUEL_TYPE,
              observation: req.body.description,
              carState: req.body.condition === 'used' ? 'Usado' : 'Nuevo',
              imageGroup_id: resp.id,
              words: `${req.body.brand} ${
                JSON.parse(req.body.attributes).TRIM
              } ${req.body.modelName} ${
                JSON.parse(req.body.attributes).VEHICLE_YEAR
              }`,
              ml_detail: req.body.attributes,
              user_id,
            },
            { transaction: t },
          ))
        .then(newPub =>
          User.findByPk(um.user_id).then((us) => {
            const carData = parseMeliCarData(us, req.body, imageData);
            return meliObject.post(
              PUBLICATIONURL,
              carData,
              { access_token: um.user_token },
              handleCreatePubResponse.bind(null, res, newPub, false),
            );
          }))
        .then(() => t.commit())
        .catch((err) => {
          console.log(err);
          t.rollback();
          return res.headersSent ? false : res.status(400).send({ status: 'error', message: err });
        });
    }));
};
const updatePublicationMeli = async (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;
  const { id } = req.body;
  Publication.findByPk(id)
    .then((pub) => {
      if (!pub) {
        return Promise.reject(new Error('No existe una publicación con ese id o no esta correctamente asociada.'));
      }
      return user_meli.findOne({ where: { user_id } })
        .then((um) => {
          validateToken(um, res, user_id);
          meliObject.put(
            `${PUBLICATIONURL}${pub.dataValues.ml_id}`,
            req.body,
            { access_token: um.dataValues.user_token },
            handleCreatePubResponse.bind(null, res, pub, true),
          );
        });
    })
    .catch((err) => {
      if (res.headersSent) {
        console.log(err);
      } else {
        console.log(err);
        res.status(400).send({ status: 'error', message: err.message });
      }
    });
};
// Título
// Precio
// Video
// Imágenes
// Descripción*
// Envío
// Location
// Atributos de la publicación (array “attributes”)
// Categoría

// ===

module.exports = {
  getMeliAuthURL,
  addMeliUserCode,
  createTestUser,
  meliCategory,
  provinceMeli,
  stateMeli,
  cityMeli,
  neighborhoodMeli,
  userStatusMeli,
  validatePublicationMeli,
  publicationMeli,
  updatePublicationMeli,
};
