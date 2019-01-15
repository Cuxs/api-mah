const fetch = require('node-fetch');
const oauth2 = require('simple-oauth2');
const NodeCache = require('node-cache');
const split = require('split-object');
require('dotenv').config();

// Initialize the OAuth2 Library
const tokenCache = new NodeCache();
const infoAutoCache = new NodeCache();
const getInfoAutoToken = async () => {
  let accessToken = await tokenCache.get('infoAutoToken');
  if (!accessToken) {
    const credentials = {
      client: {
        id: process.env.client_id,
        secret: process.env.client_secret,
      },
      auth: {
        tokenHost: 'https://info_auto.gestion.online',
      },
    };
    const tokenConfig = {
      username: process.env.user_name,
      password: process.env.password,
      expires_in: '7200',
    };
    const authentication = oauth2.create(credentials);
    return authentication.ownerPassword.getToken(tokenConfig)
      .then((rslt) => {
        accessToken = authentication.accessToken.create(rslt);
        tokenCache.set('infoAutoToken', accessToken.token, accessToken.token.expires_in);
        return accessToken.token.access_token;
      })
      .catch(err => console.log(err));
  }
  return accessToken.access_token;
  //---------
};
const customFetch = (url, method, token, contentType) => {
  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    method,
  };
  return fetch(url, options)
    .then(response => response.json())
    .then(responseData => responseData)
    .catch(e => Promise.reject(e));
};

const infoAutoResolver = async (type, arg) => {
  const baseUrl = 'https://info_auto.gestion.online/api/custom/public';
  const privateBaseUrl = 'https://info_auto.gestion.online/api/custom/private';
  const baseOpt = {
    headers: {
      Accept: 'application/vnd.gestion.online+json',
      'X-Force-Content-Type': 'application/json',
    },
    method: 'GET',
  };
  switch (type) {
    case 'brand': {
      const brandResp = await infoAutoCache.get('marcas');
      if (!brandResp) {
        return fetch(`${baseUrl}/brands`, baseOpt)
          .then(response => response.json())
          .then((resData) => {
            infoAutoCache.set('marcas', resData);
            return resData.map(row => ({
              ta3_marca: row.name,
              ta3_nmarc: row.id,
            }));
          });
      }
      return brandResp.map(row => ({
        ta3_marca: row.name,
        ta3_nmarc: row.id,
      }));
    }
    case 'group': {
      const groupResp = await infoAutoCache.get(arg);
      if (!groupResp) {
        return fetch(`${baseUrl}/models?brandId=${arg}`, baseOpt)
          .then(response => response.json())
          .then((resData) => {
            infoAutoCache.set(arg, resData);
            return resData.map(row => ({
              gru_cgrup: row.id,
              gru_ngrup: row.name,
              gru_nmarc: arg,
              type: row.type,
            }));
          });
      }
      return groupResp.map(row => ({
        gru_cgrup: row.id,
        gru_ngrup: row.name,
        gru_nmarc: arg,
        type: row.type,
      }));
    }
    case 'model': {
      const modelResp = await infoAutoCache.get(arg);
      if (!modelResp) {
        return fetch(`${baseUrl}/vehicles?modelId=${arg}`, baseOpt)
          .then(response => response.json())
          .then((resData) => {
            infoAutoCache.set(arg, resData);
            return resData.map(row => ({
              ta3_codia: row.id,
              ta3_model: row.name,
              since: row.since,
              to: row.to,
              description: row.description,
            }));
          });
      }
      return modelResp.map(row => ({
        ta3_codia: row.id,
        ta3_model: row.name,
        since: row.since,
        to: row.to,
        description: row.description,
      }));
    }
    case 'prices': {
      baseOpt.headers.Authorization = `Bearer ${await getInfoAutoToken()}`;
      return fetch(`${privateBaseUrl}/vehicleCurrentPrices?vehicleId=${arg}`, baseOpt)
        .then(response => response.json())
        .then((resData) => { infoAutoCache.set(arg, resData); return split(resData).map(row => ({ anio: row.key, precio: row.value * 1000 })); });
    }
    default: return false;
  }
};
module.exports = { customFetch, infoAutoResolver };
