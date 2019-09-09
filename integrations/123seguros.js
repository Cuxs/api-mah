require('dotenv').config();
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const {
  lead123,
  User,
} = require('../models').mah;
const { startsWith } = require('lodash');

const tokenCache = new NodeCache({ stdTTL: 3600 });
const coberturasCache = new NodeCache({ checkperiod: 10000 });
const canalesCache = new NodeCache();
const carCache = new NodeCache();
const { customFetch } = require('../helpers');

const companias = [
  { id: 1, name: 'Allianz' },
  { id: 2, name: 'Zurich' },
  { id: 7, name: 'Mapfre' },
  { id: 9, name: 'Sancor' },
  { id: 13, name: 'Meridional' },
  // { id: 4, name: 'provincia' },
  // { id: 4, name: 'mercantil' },
  // { id: 2, name: 'orbis' },
];

const get123Token = async () => {
  const token = await tokenCache.get('123token');
  if (!token) {
    try {
      let response = await fetch('https://oauth-staging.123seguro.com/auth/login?email=miauto@123seguro.com.ar&password=miauto123', { method: 'POST' });
      response = await response.json();
      tokenCache.set('123token', response.token, response.expires);
      return response.token;
    } catch (e) {
      console.log('OCURRIO UN ERROR AL OBTENER EL TOKEN', e);
    }
  } else {
    return Promise.resolve(token);
  }
};
const get123Coberturas = async () => {
  const coberturas = await coberturasCache.get('coberturas');
  if (!coberturas) {
    try {
      let response = await fetch('https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/coberturas', { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
      response = await response.json();
      coberturasCache.set('coberturas', response.data);
      return response.data;
    } catch (e) {
      console.log('OCURRIO UN ERROR AL OBTENER LAS COBERTURAS', e);
    }
  } else {
    return Promise.resolve(coberturas);
  }
};
const get123Canales = async (req, res) => {
  try {
    let response = await fetch('https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/canales', { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
    response = await response.json();
    canalesCache.set('canales', response.data);
    return res.send({ status: 'ok', data: response.data });
  } catch (e) {
    console.log('OCURRIO UN ERROR AL OBTENER LAS COBERTURAS', e);
  }
};

const addUserAndCarData = async (req, res) => {
  // console.log(req.body);
  const {
    nombre, apellido, mail, telefono, // crear Usuario
    codigo_postal,
    canal_id = 276,
    // localidad_id, // crear Domicilio 11163
    anio, vehiculo_id, // crear auto 120198
  } = req.body;

  let usuario_id;
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await get123Token()}`,
      'Content-Type': 'application/json',
    },
  };
  const urlCreateUser = 'https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios';
  const getUrlCreateCar = usuario_id => `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios/${usuario_id}/autos`;
  // createUser-------------------------------------
  options.body = JSON.stringify({
    nombre,
    apellido,
    mail,
    telefono,
    codigo_postal,
  });
  fetch(urlCreateUser, options)
    .then(response => response.json())
    .then(async (resData) => {
      if (resData.success === false) {
        if (resData.errors.title.mail) {
          if (startsWith(resData.errors.title.mail[0], 'The mail has already')) {
            return customFetch(`${urlCreateUser}?search=mail:${mail}`, 'GET', await get123Token(), 'application/json')
              .then((responseJson) => {
                if (responseJson.success === false) {
                  throw new Error(JSON.stringify(resData.errors));
                }
                const { id } = responseJson.data.data[0];
                usuario_id = id;
                return usuario_id;
                // createCar-------------------------------------
              });
          }
        }
      } else {
        throw new Error(JSON.stringify(resData.errors));
      }
    })
    .then((resData) => {
      if (resData.success === false) {
        throw new Error(JSON.stringify(resData.errors));
      }
      // createCar-------------------------------------
      options.body = JSON.stringify({
        anio, vehiculo_id, canal_id,
      });
      return fetch(getUrlCreateCar(usuario_id), options);
    })
    .then(response => response.json())
    .then(async (resData) => {
      console.log('3', resData);
      if (resData.success === false) {
        throw new Error(JSON.stringify(resData.errors));
      }
      const companias = [
        { id: 1, name: 'Allianz' },
        { id: 2, name: 'Zurich' },
        { id: 7, name: 'Mapfre' },
        { id: 9, name: 'Sancor' },
        { id: 13, name: 'Meridional' },
        // { id: 4, name: 'provincia' },
        // { id: 4, name: 'mercantil' },
        // { id: 2, name: 'orbis' },
      ];
      resData.data.usuario_id = usuario_id;


      res.send({
        status: 'ok', data: resData.data, companias, coberturas: await get123Coberturas(),
      });
    })
    .catch(e => res.status(400).send({ status: 'error', message: e.message }));
};
const get123CoberturasCompania = async (id) => {
  const coberturas = await coberturasCache.get(id);
  if (!coberturas) {
    try {
      let response = await fetch(`https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/companias/${id}/coberturas`, { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
      response = await response.json();
      coberturasCache.set(id, response.data);
      return response;
    } catch (e) {
      console.log('OCURRIO UN ERROR AL OBTENER LAS COBERTURAS', e);
    }
  } else {
    return Promise.resolve(coberturas);
  }
};

const get123Quotes = (req, res) => {
  const { producto_id, company, company_id } = req.body;
  console.log('BUSCANDO COBERTURA 123SEGURO PARA: ', company);
  get123CoberturasCompania(company_id)
    .then(coberturasCompania => get123Coberturas()
      .then(async (coberturas) => {
        const url = `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/cotizar/${company}?producto_id=${producto_id}`;
        const options = {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await get123Token()}`,
          },
        };
        fetch(url, options)
          .then(response => response.json())
          .then((resData) => {
            res.send({
              status: 'ok', data: resData.data, coberturasCompania, coberturas,
            });
          })
          .catch(e => res.status(400).send({ status: 'error', message: e.message }));
      }));
  // const companies = ['allianz', 'chubb', 'mapfre', 'meridional', 'provincia', 'prudencia', 'sancor', 'sura', 'zurich'];
};
const get123Provinces = async (req, res) => {
  const urlGetProvinces = 'https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/provincias';
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await get123Token()}`,
    },
  };
  fetch(urlGetProvinces, options)
    .then(resp => resp.json())
    .then(({ data }) => { res.send({ status: 'ok', data }); })
    .catch(e => res.status(400).send({ status: 'error', message: e.message }));
};
const get123Localities = async (req, res) => {
  const { province_id } = req.params;
  const urlGetLocalities = `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/provincias/${province_id}/localidades`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await get123Token()}`,
    },
  };
  fetch(urlGetLocalities, options)
    .then(resp => resp.json())
    .then(({ data }) => res.send({ status: 'ok', data }))
    .catch(e => res.status(400).send({ status: 'error', message: e.message }));
};
const assurance123Seguro = async (req, res) => {
  const {
    cobertura_id, cobertura_interna_id, compania_id, prima, premio, nombre, apellido, mail, telefono, user_id, car_id,
  } = req.body;
  const urlAssurance = `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios/${user_id}/autos/${car_id}`;
  const options = {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${await get123Token()}`,
    },
    body: {
      cobertura_id,
      cobertura_interna_id,
      compania_id,
      prima,
      premio,
    },
  };
  fetch(urlAssurance, options)
    .then(resp => resp.json())
    .then((response) => {
      if (response.success === false) {
        throw new Error(JSON.stringify(response.errors));
      }
      console.log(response);
    })
    .then(() => {
      lead123.create({
        name: nombre,
        secondName: apellido,
        email: mail,
        phone: telefono,
        prima,
        premio,
        company: compania_id,
      })
        .then(() => res.send({ status: 'ok', message: 'Lead registrado con éxito' }))
        .catch(e => console.log('No se pudo registrar el Lead:', e));
    })
    .catch((e) => { console.log(e); return res.status(400).send({ status: 'error', message: e.message }); });
};
const get123Leads = (req, res) => {
  const token = req.headers.authorization.slice(7);
  const user_id = decode(token).id;
  const { page } = req.params;
  const LIMIT = 10;

  User.findByPk(user_id)
    .then((us) => {
      if (!us.isAdmin) {
        Promise.reject(new Error('Solo administradores pueden acceder'));
      }
      return lead123.findAll({
        limit: LIMIT,
        offset: parseInt(page, 10) === 0 ? 0 : page * LIMIT,
      });
    })
    .then((leads) => {
      res.send({ status: 'ok', data: leads });
    })
    .catch((e) => {
      console.log(e);
      res.status(400).send({ status: 'error', message: e.message });
    });
};

const get123Brands = async (req, res) => {
  try {
    let response = await fetch('https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/marcas', { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${await get123Token()}` } });
    response = await response.json();
    carCache.set('brands', response.data);
    return res.send({ status: 'ok', data: response.data });
  } catch (e) {
    console.log('OCURRIO UN ERROR AL OBTENER LAS MARCAS', e);
  }
};
const get123Years = async (req, res) => {
  const { brand_id } = req.params;
  try {
    let response = await fetch(`https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/marcas/${brand_id}/anios`, { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
    response = await response.json();
    carCache.set(brand_id, response.data);
    return res.send({ status: 'ok', data: response.data });
  } catch (e) {
    console.log('OCURRIO UN ERROR AL OBTENER LOS AÑOS', e);
  }
};
const get123Family = async (req, res) => {
  const { brand_id, year } = req.params;
  try {
    let response = await fetch(`https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/marcas/${brand_id}/anios/${year}/versiones`, { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
    response = await response.json();
    carCache.set(`${brand_id}-${year}`, response.data);
    return res.send({ status: 'ok', data: response.data });
  } catch (e) {
    console.log('OCURRIO UN ERROR AL OBTENER LAS FAMILIAS', e);
  }
};
const get123Models = async (req, res) => {
  const { brand_id, year, family_id } = req.params;
  try {
    let response = await fetch(`https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/marcas/${brand_id}/anios/${year}/versiones/${family_id}/modelos`, { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
    response = await response.json();
    carCache.set(`${brand_id}-${year}-${family_id}`, response.data);
    return res.send({ status: 'ok', data: response.data });
  } catch (e) {
    console.log('OCURRIO UN ERROR AL OBTENER LAS FAMILIAS', e);
  }
};

module.exports = {
  get123Leads,
  assurance123Seguro,
  get123Canales,
  addUserAndCarData,
  get123Provinces,
  get123Localities,
  get123Token,
  get123Quotes,
  get123Brands,
  get123Years,
  get123Family,
  get123Models,
};
