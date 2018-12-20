require('dotenv').config();
const fetch = require('node-fetch');
const NodeCache = require('node-cache');


const tokenCache = new NodeCache();
const coberturasCache = new NodeCache({ checkperiod: 10000 });
const canalesCache = new NodeCache();
const pricesCache = new NodeCache();

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
const get123Canales = async () => {
  const canales = await canalesCache.get('canales');
  if (!canales) {
    try {
      let response = await fetch('https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/coberturas', { method: 'GET', headers: { Authorization: `Bearer ${await get123Token()}` } });
      response = await response.json();
      canalesCache.set('canales', response.data);
      return response.data;
    } catch (e) {
      console.log('OCURRIO UN ERROR AL OBTENER LAS COBERTURAS', e);
    }
  } else {
    return Promise.resolve(canales);
  }
};

const addUserAndCarData = async (req, res) => {
  // console.log(req.body);
  const {
    nombre, apellido, mail, telefono, // crear Usuario
    localidad_id, // crear Domicilio 11163
    anio, vehiculo_id, // crear auto 120198
  } = req.body;
  const canal_id = 262;
  let usuario_id;
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await get123Token()}`,
      'Content-Type': 'application/json',
    },
  };
  const urlCreateUser = 'https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios';
  const getUrlCreateDirection = usuario_id => `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios/${usuario_id}/direcciones`;
  const getUrlCreateCar = usuario_id => `https://test.123cotizarservice-ci.123seguro.com/api/v1/AR/auto/resources/usuarios/${usuario_id}/autos`;
  // createUser-------------------------------------
  options.body = JSON.stringify({
    nombre,
    apellido,
    mail,
    telefono,
  });
  fetch(urlCreateUser, options)
    .then(response => response.json())
    .then(async (resData) => {
      if (resData.success === false) {
        if (resData.errors.title.mail) {
          if (_.startsWith(resData.errors.title.mail[0], 'The mail has already')) {
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
        } else {
          throw new Error(JSON.stringify(resData.errors));
        }
      } else {
        usuario_id = resData.user.id;
        options.body = JSON.stringify({
          localidad_id,
        });
        return fetch(getUrlCreateDirection(usuario_id), options).then(response => response.json());
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
        { id: 7, name: 'allianz' },
        { id: 1, name: 'mapfre' },
        { id: 5, name: 'meridional' },
        { id: 4, name: 'provincia' },
        { id: 4, name: 'mercantil' },
        { id: 2, name: 'orbis' },
        { id: 13, name: 'sancor' },
        { id: 6, name: 'zurich' }];

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
              status: 200, data: resData.data, coberturasCompania, coberturas,
            });
          });
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
    .then(({ data }) => res.send({ status: 'ok', data }))
    .catch(e => res.send({ status: 'error', message: e.message }));
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
    .catch(e => res.send({ status: 'error', message: e.message }));
};


module.exports = {
  addUserAndCarData,
  get123Provinces,
  get123Localities,
  get123Token,
  get123Quotes,
};
