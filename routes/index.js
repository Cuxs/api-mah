require('dotenv').config();
const jsonwt = require('jsonwebtoken');
const { split } = require('split-object');
const decode = require('jwt-decode');
const moment = require('moment');
const PythonShell = require('python-shell');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt-nodejs');
const NodeCache = require('node-cache');

const {
  User,
  Publication,
  ImageGroup,
  PublicationState,
  PublicationDetail,
  Sliders,
  Provinces,
  Town,
  sequelize,
} = require('../models').mah;
const _ = require('lodash');
const { customFetch, prepareArrayToSharp } = require('../helpers');

const { generateMailAgenciaoParticular, generateSinRegistro, generateForAdmin } = require('../mails');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const miautoEmail = 'contacto@miautohoy.com';
// Helper
const ResponseObj = (status, message, data) => ({ status, message, data });
//-----------------


// using SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs

const login = (req, res) => {
  const { email, password } = req.body;
  User.findOne({ where: { email } })
    .then((user) => {
      if (_.isNull(user)) {
        console.log('usuario inexistente');
        res.status(401).send({
          status: 'error',
          message: 'Usuario inexistente o contraseña incorrecta.',
        });
        return false;
      }
      try {
        if ((_.isNull(user.password))) {
          res.status(401).send({
            status: 'error',
            message: 'Usted ya se encuentra registrado a través de una red social. Ingrese presionando el botón correspondiente.',
          });
          return false;
        }
        if (!user.validPassword(password, user.password)) {
          res.status(401).send({
            status: 'error',
            message: 'Usuario inexistente o contraseña incorrecta.',
          });
          return false;
        }
      } catch (e) {
        if (e === 'Not a valid BCrypt hash.') {
          User.findOne({ where: { email } })
            .then((us) => {
              if (!us) {
                res.status(400).send(ResponseObj('error', 'No existe un usuario registrado con ese email.'));
                return false;
              }
              const hash = User.generateHash(Math.random().toString());
              us.update({
                password: hash,
              })
                .then(() => {
                  const data = {
                    name: us.name,
                    hash,
                  };
                  const msg = {
                    to: us.email,
                    from: miautoEmail,
                    subject: 'Recupero de contraseña',
                    html: generateMailAgenciaoParticular(data, 'recoverPassword'),
                  };
                  sgMail.send(msg)
                    .catch((err) => {
                      console.log(err);
                    });
                });
            });

          res.status(401).send({
            status: 'error',
            message: 'Tu contraseña ha expirado, te enviaremos un mail para que la actualices.',
          });
          return false;
        }
        return res.status(500).send({
          status: 'error',
          message: e,
        });
      }
      let userType;
      if (user.agencyName) {
        userType = 'Agencia';
      } else {
        userType = 'Usuario';
      }
      if (user.isAdmin) {
        userType = 'Admin';
      }
      const MAHtoken = jsonwt.sign(
        {
          id: user.id,
          name: user.agencyName || user.name,
          userType,
        },
        'MAH2018!#',
      );

      res.status(200).send({
        status: 'ok',
        message: MAHtoken,
      });

      return false;
      /*
      if (user.isAdmin === false) {
        res.status(400).send({
          status: 'error',
          message: 'No tienes permisos para acceder aquí.',
        });
        return false;
      }
 */
    })
    .catch(error =>
      res.status(400).send({
        status: 'error',
        message: error,
      }));
};
const loginAdmin = (req, res) => {
  const { email, password } = req.body;
  User.findOne({ where: { email } })
    .then((user) => {
      console.log(user.dataValues);
      if (_.isNull(user)) {
        console.log('usuario inexistente');
        res.status(400).send({
          status: 'error',
          message: 'Usuario inexistente o contraseña incorrecta.',
        });
        return false;
      }
      if (!user.validPassword(password, user.password)) {
        res.status(401).send({
          status: 'error',
          message: 'Usuario inexistente o contraseña incorrecta.',
        });

        return false;
      }
      let userType;
      if (user.agencyName) {
        userType = 'Agencia';
      } else {
        userType = 'Usuario';
      }
      if (user.isAdmin) {
        userType = 'Admin';
      }
      const MAHtoken = jsonwt.sign(
        {
          id: user.id,
          name: user.agencyName || user.name,
          userType,
        },
        'MAH2018!#',
      );
      if (user.isAdmin === false) {
        res.status(400).send({
          status: 'error',
          message: 'No tienes permisos para acceder aquí.',
        });
        return false;
      }

      res.status(200).send({
        status: 'ok',
        message: MAHtoken,
      });
    })
    .catch(error =>
      res.status(400).send({
        status: 'error',
        message: error,
      }));
};
const checkFacebookLogin = (req, res) => {
  const { email } = req.params;
  User.findOne({ where: { email } })
    .then((us) => {
      if (!us) {
        res.status(200).send({ message: 'Usuario no registrado' });
      } else {
        let userType;
        if (us.agencyName) {
          userType = 'Agencia';
        } else {
          userType = 'Usuario';
        }
        if (us.isAdmin) {
          userType = 'Admin';
        }
        const MAHtoken = jsonwt.sign(
          {
            id: us.id,
            name: us.agencyName || us.name,
            userType,
          },
          'MAH2018!#',
        );
        res.status(200).send({
          status: 'ok',
          message: MAHtoken,
        });
      }
    });
};
const loginOrRegisterFacebook = (req, res) => {
  const { data: { email, name } } = req.body;
  User.findOne({ where: { email } })
    .then((us) => {
      if (!us) {
        User.create({
          email,
          name,
          isAgency: false,
        }).then((usr) => {
          const msgToAdmin = {
            to: miautoEmail,
            from: miautoEmail,
            subject: 'Nuevo Usuario Registrado!',
            html: generateForAdmin('Hola!', 'Se ha registrado un nuevo usuario', null, `Se ha registrado un nuevo usuario con email: ${email} a través de Facebook.`),
          };
          sgMail.send(msgToAdmin);
          const userType = 'Usuario';
          const MAHtoken = jsonwt.sign(
            {
              id: usr.id,
              name: usr.agencyName || usr.name,
              userType,
            },
            'MAH2018!#',
          );
          res.status(200).send({
            status: 'ok',
            message: MAHtoken,
          });
        });
      } else {
        let userType;
        if (us.isAgency) {
          userType = 'Agencia';
        } else {
          userType = 'Usuario';
        }
        if (us.isAdmin) {
          userType = 'Admin';
        }
        const MAHtoken = jsonwt.sign(
          {
            id: us.id,
            name: us.agencyName || us.name,
            userType,
          },
          'MAH2018!#',
        );
        res.status(200).send({
          status: 'ok',
          message: MAHtoken,
        });
      }
    });
};

const createPublication = (req, res) => {
  split(req.body).map((row) => {
    if (req.body[row.key] === 'SI') req.body[row.key] = true;
    if (req.body[row.key] === 'NO') req.body[row.key] = false;
    if (req.body[row.key] === '.') req.body[row.key] = false;
  });
  const {
    brand,
    group,
    modelName,
    year,
    Combustible,
    observation,
    carState,
    codia,
    name,
    email,
    phone,
    province_id,
    town_id,
    Alimentacion,
    Motor,
    Puertas,
    Clasificacion,
    Cabina,
    Carga,
    PesoTotal,
    VelocidadMax,
    Potencia,
    Direccion,
    AireAcondicionado,
    Traccion,
    Importado,
    Caja,
    FrenosAbs,
    Airbag,
    Climatizador,
    FarosAntiniebla,
    TechoCorredizo,
    SensorEstacionamiento,
    AirbagLateral,
    AirbagCabezaConductor,
    AirbagCortina,
    AirbagRodilla,
    FijacionISOFIX,
    ControlDeTraccion,
    ControlDeEstabilidad,
    ControlDeDescenso,
    SistemaArranqueEnPendiente,
    ControlDinamicoConduccion,
    BloqueoDiferencial,
    RepartidorElectronicoDeFrenado,
    AsistenteDeFrenadoEmergencia,
    ReguladorParFrenado,
    Largo,
    Ancho,
    Alto,
    TapizadoCuero,
    AsientosElectronicos,
    ComputadoraABordo,
    FarosDeXenon,
    LLantasDeAleacion,
    TechoPanoramico,
    SensorDeLluvia,
    SensorCrepuscular,
    IndicadorPresionNeumaticos,
    VolanteConLevas,
    Bluetooth,
    AsientosTermicos,
    RunFlat,
  } = req.body;
  let { price, kms } = req.body;

  if (!price) { price = null; }
  if (!kms) { kms = null; }
  const imageGroup = req.files;
  if (imageGroup.length === 0) {
    res.status(400).send('Por favor elija aunque sea una imágen');
    return false;
  }
  const imageData = {};
  let userId = null;
  let isAdmin = false;
  let userMail = '';
  let agencyEmail = '';
  let ownerEmail = '';
  let userProvince = null;
  let userTown = null;
  if (req.headers.authorization) {
    userId = decode(req.headers.authorization.slice(7)).id;
    User.findById(userId).then((usr) => {
      if (usr.isAdmin) {
        isAdmin = true;
        userId = req.body.userId;
        User.findById(userId)
          .then((us) => {
            agencyEmail = us.dataValues.agencyEmail;
            ownerEmail = us.dataValues.ownerEmail;
            userMail = us.dataValues.email;
            userProvince = us.dataValues.province_id;
            userTown = us.dataValues.town_id;
          })
          .catch(() => res.status(400).send('Cree publicaciones para un usuario desde el superAdmin'));
        return false;
      }
      User.findById(userId)
        .then((us) => {
          agencyEmail = us.dataValues.agencyEmail;
          ownerEmail = us.dataValues.ownerEmail;
          userMail = us.dataValues.email;
          userProvince = us.dataValues.province_id;
          userTown = us.dataValues.town_id;
        });
    });
  }
  let fuel;
  switch (Combustible) {
    case 'NAF':
      fuel = 'Nafta';
      break;
    case 'DSL':
      fuel = 'Diesel';
      break;
    case 'GNC':
      fuel = 'GNC';
      break;
    default:
      fuel = 'No especificado';
  }
  Promise.all(prepareArrayToSharp(imageGroup))
    .then(() => {
      for (let i = 0; i < imageGroup.length; i += 1) {
        const objectName = `image${i + 1}`;
        imageData[objectName] = `opt-${imageGroup[i].filename}`;
      }
      if (!email && !userId) {
        res.status(400).send('Datos incompletos (faltan datos de contacto)');
        return false;
      }
      if (email) {
        Publication.findOne({ where: { email } })
          .then((pub) => {
            if (pub) {
              throw new Error('Solo le permitimos una publicación a los usuarios no registrados.');
            }
          })
          .then(() => ImageGroup.create(imageData))
          .then(resp => Publication.create(
            {
              brand,
              group,
              modelName,
              kms: kms || null,
              price: price || null,
              year,
              fuel,
              observation,
              carState,
              codia,
              imageGroup_id: resp.id,
              name,
              email,
              phone,
              words: `${brand} ${group} ${modelName} ${kms} ${price} ${year} ${name} ${email} ${observation}`,
              province_id,
              town_id,
              user_id: userId,
              publicationDetail: {
                Alimentacion,
                Motor,
                Puertas,
                Clasificacion,
                Cabina,
                Carga,
                PesoTotal,
                VelocidadMax,
                Potencia,
                Direccion,
                AireAcondicionado,
                Traccion,
                Importado,
                Caja,
                FrenosAbs,
                Airbag,
                Climatizador,
                FarosAntiniebla,
                TechoCorredizo,
                SensorEstacionamiento,
                AirbagLateral,
                AirbagCabezaConductor,
                AirbagCortina,
                AirbagRodilla,
                FijacionISOFIX,
                ControlDeTraccion,
                ControlDeEstabilidad,
                ControlDeDescenso,
                SistemaArranqueEnPendiente,
                ControlDinamicoConduccion,
                BloqueoDiferencial,
                RepartidorElectronicoDeFrenado,
                AsistenteDeFrenadoEmergencia,
                ReguladorParFrenado,
                Largo,
                Ancho,
                Alto,
                TapizadoCuero,
                AsientosElectronicos,
                ComputadoraABordo,
                FarosDeXenon,
                LLantasDeAleacion,
                TechoPanoramico,
                SensorDeLluvia,
                SensorCrepuscular,
                IndicadorPresionNeumaticos,
                VolanteConLevas,
                Bluetooth,
                AsientosTermicos,
                RunFlat,
              },
            },
            {
              include: [
                {
                  model: PublicationDetail,
                  as: 'publicationDetail',
                },
              ],
            },
          ))
          .then(publication =>
            PublicationState.findOne({
              where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
            })
              .then((ps) => {
                publication.setPublicationStates(ps, { through: { active: true } });
                res
                  .status(200)
                  .send('Felicitaciones, tu publicación fue creada exitosamente, permanecerá en estado pendiente hasta que sea aprobada por Mi Auto Hoy');
                const msg = {
                  to: publication.email,
                  from: miautoEmail,
                  subject: 'Publicación creada!',
                  html: generateSinRegistro(publication, 'newPublication'),
                };
                sgMail.send(msg);
                const msgToAdmin = {
                  to: miautoEmail,
                  from: miautoEmail,
                  subject: 'Nueva Publicación anónima!',
                  html: generateForAdmin('Hola!', 'Se ha creado una nueva publicación anónima', null, 'Una nueva publicación anónima está en estado Pendiente en el administrador, ingresa a https://www.miautohoy.com/superAdminPublications?stateName=Pendiente para revisarla.'),
                };
                sgMail.send(msgToAdmin);
              }))
          .catch((e) => {
            res.status(400).send(e.message);
            console.log(e);
          })
          .catch((e) => {
            res.status(400).send(e.message);
            console.log(e);
          })
          .catch((e) => {
            res.status(400).send(e.message);
          });
      } else {
        return ImageGroup.create(imageData)
          .then(resp => Publication.create(
            {
              brand,
              group,
              modelName,
              kms: kms || null,
              price: price || null,
              year,
              fuel,
              observation,
              carState,
              codia,
              imageGroup_id: resp.id,
              name,
              email,
              phone,
              province_id: userProvince,
              town_id: userTown,
              user_id: userId,
              words: `${brand} ${group} ${modelName} ${kms} ${price} ${year} ${name} ${email} ${observation} `,
              publicationDetail: {
                Alimentacion,
                Motor,
                Puertas,
                Clasificacion,
                Cabina,
                Carga,
                PesoTotal,
                VelocidadMax,
                Potencia,
                Direccion,
                AireAcondicionado,
                Traccion,
                Importado,
                Caja,
                FrenosAbs,
                Airbag,
                Climatizador,
                FarosAntiniebla,
                TechoCorredizo,
                SensorEstacionamiento,
                AirbagLateral,
                AirbagCabezaConductor,
                AirbagCortina,
                AirbagRodilla,
                FijacionISOFIX,
                ControlDeTraccion,
                ControlDeEstabilidad,
                ControlDeDescenso,
                SistemaArranqueEnPendiente,
                ControlDinamicoConduccion,
                BloqueoDiferencial,
                RepartidorElectronicoDeFrenado,
                AsistenteDeFrenadoEmergencia,
                ReguladorParFrenado,
                Largo,
                Ancho,
                Alto,
                TapizadoCuero,
                AsientosElectronicos,
                ComputadoraABordo,
                FarosDeXenon,
                LLantasDeAleacion,
                TechoPanoramico,
                SensorDeLluvia,
                SensorCrepuscular,
                IndicadorPresionNeumaticos,
                VolanteConLevas,
                Bluetooth,
                AsientosTermicos,
                RunFlat,
              },
            },
            {
              include: [
                {
                  model: PublicationDetail,
                  as: 'publicationDetail',
                },
              ],
            },
          ))
          .then((publication) => {
            PublicationState.findOne({
              where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
            }).then((ps) => {
              publication.setPublicationStates(ps, { through: { active: true } });
              res
                .status(200)
                .send('Felicitaciones, tu publicación fue creada exitosamente, permanecerá en estado pendiente hasta que sea aprobada por Mi Auto Hoy');
              const msg = {
                to: userMail,
                cc: [agencyEmail, ownerEmail],
                from: miautoEmail,
                subject: 'Publicación creada!',
                html: generateMailAgenciaoParticular(publication, 'newPublication'),
              };
              sgMail.send(msg);
              const msgToAdmin = {
                to: miautoEmail,
                from: miautoEmail,
                subject: 'Nueva Publicación!',
                html: generateForAdmin('Hola!', 'Se ha creado una nueva publicación', null, 'Una nueva publicación está en estado Pendiente en el administrador, ingresa a https://www.miautohoy.com/superAdminPublications?stateName=Pendiente para revisarla.'),
              };
              if (!isAdmin) { sgMail.send(msgToAdmin); }
            });
          })
          .catch((e) => {
            res.status(400).send(e);
            console.log(e);
          })
          .catch(() => {
            res.status(400).send('No existe un usuario con ese id');
          });
      }
    })

    .catch((err) => {
      res.status(400).send(`Ocurrio un error al subir las imágenes. ${err}`);
      return false;
    });
};
const editPublication = (req, res) => {
  split(req.body).map((row) => {
    if (req.body[row.key] === 'SI') req.body[row.key] = true;
    if (req.body[row.key] === 'NO') req.body[row.key] = false;
    if (req.body[row.key] === '.') req.body[row.key] = false;
  });
  let { price, kms } = req.body;

  if (!price) { price = null; }
  if (!kms) { kms = null; }
  const {
    publication_id,
    brand,
    group,
    modelName,
    year,
    Combustible,
    observation,
    carState,
    codia,
    name,
    email,
    phone,
    province_id,
    town_id,
    Alimentacion,
    Motor,
    Puertas,
    Clasificacion,
    Cabina,
    Carga,
    PesoTotal,
    VelocidadMax,
    Potencia,
    Direccion,
    AireAcondicionado,
    Traccion,
    Importado,
    Caja,
    FrenosAbs,
    Airbag,
    Climatizador,
    FarosAntiniebla,
    TechoCorredizo,
    SensorEstacionamiento,
    AirbagLateral,
    AirbagCabezaConductor,
    AirbagCortina,
    AirbagRodilla,
    FijacionISOFIX,
    ControlDeTraccion,
    ControlDeEstabilidad,
    ControlDeDescenso,
    SistemaArranqueEnPendiente,
    ControlDinamicoConduccion,
    BloqueoDiferencial,
    RepartidorElectronicoDeFrenado,
    AsistenteDeFrenadoEmergencia,
    ReguladorParFrenado,
    Largo,
    Ancho,
    Alto,
    TapizadoCuero,
    AsientosElectronicos,
    ComputadoraABordo,
    FarosDeXenon,
    LLantasDeAleacion,
    TechoPanoramico,
    SensorDeLluvia,
    SensorCrepuscular,
    IndicadorPresionNeumaticos,
    VolanteConLevas,
    Bluetooth,
    AsientosTermicos,
    RunFlat,
  } = req.body;
  const imageGroup = req.files;
  const imageData = {};
  let userId = null;
  let isAdmin = false;
  let userMail = '';
  if (req.headers.authorization) {
    userId = decode(req.headers.authorization.slice(7)).id;
    User.findById(userId).then((usr) => {
      if (usr.isAdmin) {
        isAdmin = true;
        userId = req.body.userId;
        User.findById(userId)
          .then((us) => { userMail = us.dataValues.email; });
      } else {
        User.findById(userId)
          .then((us) => { userMail = us.dataValues.email; });
      }
    });
  }
  let fuel;
  switch (Combustible) {
    case 'NAF':
      fuel = 'Nafta';
      break;
    case 'DSL':
      fuel = 'Diesel';
      break;
    case 'GNC':
      fuel = 'GNC';
      break;
    default:
      fuel = 'No especificado';
  }
  Publication.findById(publication_id)
    .then((pub) => {
      if (imageGroup.length === 0) {
        pub.update(
          {
            brand,
            group,
            modelName,
            kms: kms || null,
            price: price || null,
            year,
            fuel,
            observation,
            carState,
            codia,
            name,
            email,
            phone,
            province_id,
            town_id,
            words: `${brand} ${group} ${modelName} ${kms} ${price} ${year} ${name} ${email} ${observation} `,
            user_id: userId,
            publicationDetail: {
              Alimentacion,
              Motor,
              Puertas,
              Clasificacion,
              Cabina,
              Carga,
              PesoTotal,
              VelocidadMax,
              Potencia,
              Direccion,
              AireAcondicionado,
              Traccion,
              Importado,
              Caja,
              FrenosAbs,
              Airbag,
              Climatizador,
              FarosAntiniebla,
              TechoCorredizo,
              SensorEstacionamiento,
              AirbagLateral,
              AirbagCabezaConductor,
              AirbagCortina,
              AirbagRodilla,
              FijacionISOFIX,
              ControlDeTraccion,
              ControlDeEstabilidad,
              ControlDeDescenso,
              SistemaArranqueEnPendiente,
              ControlDinamicoConduccion,
              BloqueoDiferencial,
              RepartidorElectronicoDeFrenado,
              AsistenteDeFrenadoEmergencia,
              ReguladorParFrenado,
              Largo,
              Ancho,
              Alto,
              TapizadoCuero,
              AsientosElectronicos,
              ComputadoraABordo,
              FarosDeXenon,
              LLantasDeAleacion,
              TechoPanoramico,
              SensorDeLluvia,
              SensorCrepuscular,
              IndicadorPresionNeumaticos,
              VolanteConLevas,
              Bluetooth,
              AsientosTermicos,
              RunFlat,
            },
          },
          {
            include: [
              {
                model: PublicationDetail,
                as: 'publicationDetail',
              },
            ],
          },
        )
          .then((editedPub) => {
            PublicationState.findOne({
              where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
            }).then((ps) => {
              editedPub.setPublicationStates(ps, { through: { active: true } });
              res
                .status(200)
                .send(ResponseObj('ok', 'Publicación editada con éxito. Nuevamente en estado Pendiente para su revisión.'));
            });
          });
        return false;
      }Promise.all(prepareArrayToSharp(imageGroup))
        .then(() => {
          for (let i = 0; i < 9; i += 1) {
            const objectName = `image${i + 1}`;
            if (imageGroup[i]) {
              imageData[objectName] = `opt-${imageGroup[i].filename}`;
            } else {
              imageData[objectName] = null;
            }
          }
          ImageGroup.findById(pub.imageGroup_id)
            .then((ig) => {
              ig.update(imageData)
                .then((resp) => {
                  pub.update(
                    {
                      brand,
                      group,
                      modelName,
                      kms: kms || null,
                      price: price || null,
                      year,
                      fuel,
                      observation,
                      carState,
                      codia,
                      imageGroup_id: resp.id,
                      name,
                      email,
                      phone,
                      province_id,
                      town_id,
                      user_id: userId,
                      words: `${brand} ${group} ${modelName} ${kms} ${price} ${year} ${name} ${email} ${observation} `,
                      publicationDetail: {
                        Alimentacion,
                        Motor,
                        Puertas,
                        Clasificacion,
                        Cabina,
                        Carga,
                        PesoTotal,
                        VelocidadMax,
                        Potencia,
                        Direccion,
                        AireAcondicionado,
                        Traccion,
                        Importado,
                        Caja,
                        FrenosAbs,
                        Airbag,
                        Climatizador,
                        FarosAntiniebla,
                        TechoCorredizo,
                        SensorEstacionamiento,
                        AirbagLateral,
                        AirbagCabezaConductor,
                        AirbagCortina,
                        AirbagRodilla,
                        FijacionISOFIX,
                        ControlDeTraccion,
                        ControlDeEstabilidad,
                        ControlDeDescenso,
                        SistemaArranqueEnPendiente,
                        ControlDinamicoConduccion,
                        BloqueoDiferencial,
                        RepartidorElectronicoDeFrenado,
                        AsistenteDeFrenadoEmergencia,
                        ReguladorParFrenado,
                        Largo,
                        Ancho,
                        Alto,
                        TapizadoCuero,
                        AsientosElectronicos,
                        ComputadoraABordo,
                        FarosDeXenon,
                        LLantasDeAleacion,
                        TechoPanoramico,
                        SensorDeLluvia,
                        SensorCrepuscular,
                        IndicadorPresionNeumaticos,
                        VolanteConLevas,
                        Bluetooth,
                        AsientosTermicos,
                        RunFlat,
                      },
                    },
                    {
                      include: [
                        {
                          model: PublicationDetail,
                          as: 'publicationDetail',
                        },
                      ],
                    },
                  )
                    .then((editedPub) => {
                      PublicationState.findOne({
                        where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
                      }).then((ps) => {
                        editedPub.setPublicationStates(ps, { through: { active: true } });
                        res
                          .status(200)
                          .send('Publicación editada con éxito. Nuevamente en estado Pendiente para su revisión.');
                      });
                    });
                });
            });
        });
    });
};
const registerAgency = (req, res) => {
  const { data } = req.body;
  data.isAdmin = false;
  data.isAgency = true;
  data.password = User.generateHash(data.password);
  User.findOne({ where: { email: data.email } }).then((user) => {
    if (user) {
      res
        .status(400)
        .send(ResponseObj(
          'error',
          'Ya existe una agencia registrada con ese email.',
        ));
    } else {
      User.create(data)
        .then((usr) => {
          res
            .status(200)
            .send(ResponseObj('ok', 'Agencia registrada con éxito', usr));
          const msg = {
            to: data.email,
            from: miautoEmail,
            subject: 'Bienvenido a Mi auto hoy!',
            html: generateMailAgenciaoParticular(data, 'newAccount'),
          };
          sgMail.send(msg);
          const msgToAdmin = {
            to: miautoEmail,
            from: miautoEmail,
            subject: 'Nueva agencia Registrada!',
            html: generateForAdmin('Hola!', 'Se ha registrado una nueva agencia', null, `Se ha registrado una nueva agencia con email: ${data.email} y nombre ${data.name} `),
          };
          sgMail.send(msgToAdmin);
        })
        .catch((err) => {
          res.status(400).send(ResponseObj('error', err));
        });
    }
  });
};
const registerUser = (req, res) => {
  const { data } = req.body;
  data.isAdmin = false;
  data.isAgency = false;
  data.password = User.generateHash(data.password);
  split(data).map((obj) => {
    if (obj.value === '' || obj.value === null || obj.value === undefined) {
      let field = '';
      switch (obj.key) {
        case 'name':
          field = 'Nombre y apellido';
          break;
        case 'phone':
          field = 'Teléfono';
          break;
        case 'address':
          field = 'Dirección';
          break;
        case 'password':
          field = 'Contraseña';
          break;
        default:
          field = obj.key;
      }
      res
        .status(400)
        .send(ResponseObj('error', `Por favor complete el campo ${field}.`));
      return false;
    }
  });
  User.findOne({ where: { email: data.email } }).then((usr) => {
    if (usr) {
      res
        .status(400)
        .send(ResponseObj('error', 'Ya existe un usuario registrado con ese email.'));
    } else {
      User.create(data)
        .then((user) => {
          res
            .status(200)
            .send(ResponseObj('ok', 'Usuario registrado con éxito', user));
          const msg = {
            to: data.email,
            from: miautoEmail,
            subject: 'Bienvenido a Mi auto hoy!',
            html: generateMailAgenciaoParticular(data, 'newAccount'),
          };
          sgMail.send(msg);
          const msgToAdmin = {
            to: miautoEmail,
            from: miautoEmail,
            subject: 'Nuevo Usuario Registrado!',
            html: generateForAdmin('Hola!', 'Se ha registrado un nuevo usuario', null, `Se ha registrado un nuevo usuario con email: ${data.email} y nombre ${data.name} `),
          };
          sgMail.send(msgToAdmin);
        })
        .catch((err) => {
          res.status(400).send(ResponseObj('error', err));
        });
    }
  });
};
const uploadAgencyImages = (req, res) => {
  const { profileImage, bannerImage } = req.files;
  const { id } = req.params;
  const imageData = {};
  if (profileImage) {
    imageData.profileImage = profileImage[0].filename;
  }
  if (bannerImage) {
    imageData.bannerImage = bannerImage[0].filename;
  }
  User.findById(id).then((user) => {
    if (!user) {
      res
        .status(400)
        .send(ResponseObj('error', 'No existe un usuario con ese id.'));
    }
    user
      .update(imageData)
      .then(() => {
        res.status(200).send({
          status: 'ok',
          message: 'Cambios guardados con éxito.',
        });
      })
      .catch((e) => {
        console.log(e);
        res.status(400).send({
          status: 'error',
          e,
        });
      });
  });
};
// const getFiltersAndTotalResult = async (req, res) => {
//   req.body = req.body.search;
//   let { text } = req.body;
//   const {
//     carState, fuel, year, state, userType, modelName, brand, province,
//   } = req.body;
//   const { Op } = sequelize;
//   text = _.upperFirst(_.lowerCase(text));
//   text = text.split(' ');
//   text = text.map(row => `%${row}%`);
//   text = text.join(' ');
//   const LIMIT = 9;
//   let hasNextPage = true;
//   const options = {};
//   options.where = {
//     [Op.or]: [
//       { words: { [Op.like]: text } },
//     ],
//     [Op.and]: {},
//   };
//   options.include = [
//     { model: Provinces }, { model: User },
//   ];

//   if (fuel) {
//     options.where[Op.and] = Object.assign(options.where[Op.and], { fuel });
//   }
//   if (modelName) {
//     options.where[Op.and] = Object.assign(options.where[Op.and], {
//       modelName,
//     });
//   }
//   if (year) {
//     options.where[Op.and] = Object.assign(options.where[Op.and], { year });
//   }
//   if (brand) {
//     options.where[Op.and] = Object.assign(options.where[Op.and], { brand });
//   }
//   if (province) {
//     const provinceIns = await Provinces.findOne({ where: { name: province } });
//     const province_id = provinceIns.dataValues.id;
//     options.where[Op.and] = Object.assign(options.where[Op.and], {
//       province_id,
//     });
//   }
//   if (state) {
//     if (state === 'Activas') {
//       options.include.push({
//         model: PublicationState,
//         where: {
//           [Op.or]: [
//             { stateName: 'Publicada' },
//             { stateName: 'Destacada' },
//             { stateName: 'Vendida' },
//             { stateName: 'Apto para garantía' },
//           ],
//         },
//         through: { where: { active: true } },
//       });
//     } else {
//       options.include.push({
//         model: PublicationState,
//         where: {
//           stateName: state,
//         },
//         through: { where: { active: true } },
//       });
//     }
//   } else {
//     options.include.push({ model: PublicationState });
//   }
//   if (userType) {
//     if (userType === 'Agencia') {
//       options.include[1].where = { isAgency: true, isAdmin: false };
//     } else {
//       options.include[1].where = { isAgency: false };
//     }
//   }
//   Publication.findAll(options).then((results) => {
//     if (results === null) {
//       results = {};
//     }
//     const newObj = {};
//     newObj.fuel = {};
//     newObj.year = {};
//     newObj.brand = {};
//     newObj.userType = {};
//     newObj.modelName = {};
//     newObj.province = {};
//     results.map(({ dataValues }) => {
//       split(dataValues).map((row) => {
//         if (row.key === 'fuel' || row.key === 'year' || row.key === 'state' || row.key === 'modelName' || row.key === 'brand') {
//           newObj[row.key][row.value] = 0;
//         }
//         /*   if (row.key === 'PublicationStates') {
//           row.key = 'state';
//           row.value = _.last(row.value).dataValues.stateName;
//           newObj[row.key][row.value] = 0;
//         } */
//         if (row.key === 'Province' && !_.isNull(row.value)) {
//           if (!_.isNull(row.value.dataValues)) {
//             newObj.province[row.value.dataValues.name] = 0;
//           }
//         }
//         if (row.key === 'User' && _.isNull(row.value)) {
//           row.key = 'userType';
//           row.value = 'Particular';
//           newObj[row.key][row.value] = 0;
//         } else if (row.key === 'User' && !_.isNull(row.value)) {
//           row.key = 'userType';
//           row.value = row.value.dataValues.isAgency ? 'Agencia' : 'Particular';
//           newObj[row.key][row.value] = 0;
//         }
//         return newObj;
//       });
//     });
//     if (results.length < LIMIT) {
//       hasNextPage = false;
//     } else {
//       hasNextPage = true;
//     }
//     results.map(({ dataValues }) => {
//       split(dataValues).map((row) => {
//         /*  if (row.key === 'PublicationStates') {
//           row.key = 'state';
//           row.value = _.last(row.value).dataValues.stateName;
//           newObj[row.key][row.value] += 1;
//         } */
//         if (row.key === 'Province' && !_.isNull(row.value)) {
//           if (!_.isNull(row.value.dataValues)) {
//             newObj.province[row.value.dataValues.name] += 1;
//           }
//         }
//         if (row.key === 'User' && _.isNull(row.value)) {
//           row.key = 'userType';
//           row.value = 'Particular';
//           newObj[row.key][row.value] += 1;
//         } else if (row.key === 'User' && !_.isNull(row.value)) {
//           row.key = 'userType';
//           row.value = row.value.dataValues.isAgency ? 'Agencia' : 'Particular';
//           newObj[row.key][row.value] += 1;
//         }
//         switch (row.key) {
//           case 'fuel':
//             newObj[row.key][row.value] += 1;
//             break;
//           case 'modelName':
//             newObj[row.key][row.value] += 1;
//             break;
//           case 'year':
//             newObj[row.key][row.value] += 1;
//             break;
//           case 'brand':
//             newObj[row.key][row.value] += 1;
//             break;
//           default:
//             return '';
//         }
//       });
//     });
//     res
//       .status(200)
//       .send(ResponseObj('ok', null, {
//         filters: newObj,
//         totalResults: results.length,
//         hasNextPage,
//       }));
//   });
// };
const getSoldPublications = (req, res) => {
  const userId = decode(req.headers.authorization.slice(7)).id;

  Publication.findAll({
    attributes: [],
    where: { user_id: userId },
    include: [
      {
        model: PublicationState,
        where: {
          stateName: 'Vendida',
        },
        through: { where: { active: true } },
      },
    ],
  }).then((results) => {
    const vendidos = {};
    results.map((result) => {
      const date = moment(result.dataValues.PublicationStates[0].HistoryState.dataValues.createdAt).format('MM/YY');
      vendidos[date] = 0;
    });
    results.map((result) => {
      const date = moment(result.dataValues.PublicationStates[0].HistoryState.dataValues.createdAt).format('MM/YY');
      vendidos[date] += 1;
    });
    res.status(200).send(ResponseObj('ok', undefined, vendidos));
  });
};
const getImages = (req, res) => {
  const { publication_id } = req.params;
  Publication.findOne({ where: { id: publication_id } })
    .then((pub) => {
      ImageGroup.findById(pub.imageGroup_id)
        .then((ig) => {
          const imageArray = [];
          split(ig.dataValues).map((row) => {
            if (row.value !== null && row.key !== 'id') {
              imageArray.push(row.value);
            }
          });
          res.status(200).send(ResponseObj('ok', undefined, imageArray));
        });
    });
};
const recoverPassword = (req, res) => {
  const { email } = req.body;
  User.findOne({ where: { email } })
    .then((us) => {
      if (!us) {
        res.status(400).send(ResponseObj('error', 'No existe un usuario registrado con ese email.'));
        return false;
      }
      const hash = User.generateHash(Math.random().toString());
      us.update({
        password_hash: hash,
      })
        .then(() => {
          const data = {
            name: us.name,
            hash,
          };
          const msg = {
            to: us.email,
            from: miautoEmail,
            subject: 'Recupero de contraseña',
            html: generateMailAgenciaoParticular(data, 'recoverPassword'),
          };
          res.send(ResponseObj('ok', 'Se envió un link a tu correo para recuperar la contraseña'));
          sgMail.send(msg)
            .catch((err) => {
              console.log(err);
            });
        });
    });
};
const changePassword = (req, res) => {
  const { id } = decode(req.headers.authorization.slice(7));
  User.findById(id)
    .then((us) => {
      if (!us.isAdmin) {
        res.status(400).send({ status: 'error', message: 'Solo  administradores pueden realizar esta acción' });
      } else {
        const { userId, newPassword } = req.body;
        User.findById(userId)
          .then((us) => {
            if (!us) {
              res.status(400).send({ status: 'error', message: 'Usuario no encontrado' });
            } else {
              const newPass = bcrypt.hashSync(
                newPassword,
                bcrypt.genSaltSync(8),
                null,
              );
              return us
                .update({
                  password: newPass,
                })
                .then(() => res.send({ status: 'ok', message: 'Contraseña actualizada con éxito' }));
            }
          });
      }
    });
};
const requestCredit = (req, res) => {
  const datos = req.body;
  let html = '';
  datos.DNI = datos.dni;
  delete datos.dni;
  datos.Nombre = datos.name;
  delete datos.name;
  datos.Domicilio = datos.address;
  delete datos.address;
  datos.Ingresos = datos.ganancy;
  delete datos.ganancy;
  datos.MontoAFinanciar = datos.financyAmount;
  delete datos.financyAmount;
  datos.DestinoDelCredito = datos.creditReason;
  delete datos.creditReason;
  datos.Telefono = datos.phone;
  delete datos.phone;
  datos.Mensaje = datos.message;
  delete datos.message;
  if (datos.personalShopper) {
    const carData = {};
    carData.Año = datos.year;
    delete datos.year;
    carData.Precio = datos.price;
    delete datos.price;
    carData.Marca = datos.brand;
    delete datos.brand;
    carData.Versión = datos.group;
    delete datos.group;
    carData.Observaciones = datos.observation;
    delete datos.observation;
    datos.Trabajo = datos.job;
    delete datos.job;
    delete datos.personalShopper;
    html = generateForAdmin(datos, carData, 'personalShopper');
  } else {
    html = generateForAdmin(datos, null, 'solicitudCredito');
  }

  const msg = {
    to: 'contacto@miautohoy.com',
    from: datos.email,
    subject: 'Solicitud de Crédito',
    html,
  };
  // return false;
  sgMail.send(msg)
    .catch((err) => {
      console.log(err);
    });
  res.status(200).send({ status: 'ok' });
};
const uploadSliders = (req, res) => {
  let { slider, sliderResponsive } = req.files;
  slider = slider[0];
  sliderResponsive = sliderResponsive[0];
  const { sliderNumber } = req.body;
  const sliderName = `slider${sliderNumber}`;
  optimizeImage(slider)
    .then(() => Sliders.upsert({
      id: sliderNumber,
      name: sliderName,
      image: `opt-${slider.filename}`,
    }))
    .then(() =>
      optimizeImage(sliderResponsive))
    .then(() => {
      const id = parseInt(sliderNumber, 10) + 1;
      return Sliders.upsert({
        id,
        name: sliderName,
        image: `opt-${sliderResponsive.filename}`,
      });
    })
    .then((result) => {
      res.status(200).send({ status: 'ok', message: 'Sliders actualizados con éxito', data: result });
    })
    .catch((err) => {
      console.log(err);
      res.status(400).send({ status: 'error', message: 'No se han podido actualizar los sliders', data: err });
    });
};
const getSliders = (req, res) => {
  Sliders.findAll()
    .then((result) => {
      res.status(200).send({ status: 'ok', data: result });
    })
    .catch((err) => {
      res.status(400).send({ status: 'error', message: 'Hubo un problema, intente mas tarde.', data: err });
    });
};
const deleteSlider = (req, res) => {
  const sliderNumber = req.params.id;
  Sliders.findById(sliderNumber)
    .then(sld => sld.destroy()
      .then(() => res.status(200).send({ status: 'ok' }))
      .catch(err => res.status(400).send({ status: 'error', message: err.message })))
    .catch(err => res.status(400).send({ status: 'error', message: err.message }));
};
const getToken = (req, res) => {
  PythonShell.run('service-account.py', { scriptPath: __dirname, pythonPath: '/usr/bin/python' }, (err, results) => {
    if (err) throw err;
    res.status(200).send({ status: 'ok', message: results });
  });
};

const tokenCache = new NodeCache();
const coberturasCache = new NodeCache({ checkperiod: 10000 });
const canalesCache = new NodeCache();
// Integración 123Seguro=====================================================================================================================
const get123Token = async () => {
  const token = await tokenCache.get('123token');
  if (!token) {
    try {
      let response = await fetch('https://oauth-staging.123seguro.com/auth/login?email=admin@123seguro.com.ar&password=123seguro', { method: 'POST' });
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
  const canal_id = 1;
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
  const { province_id } = req.body;
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

//= =====================================================================================================================================

const getProvinces = (req, res) => {
  Provinces.findAll()
    .then(provs => res.send({ status: 'ok', data: provs }))
    .catch(e => res.status(400).send({ status: 'error', message: e.message }));
};
const getTowns = (req, res) => {
  const province_id = req.body;
  Town.findAll({ where: province_id })
    .then(towns => res.send({ status: 'ok', data: towns }))
    .catch(e => res.status(400).send({ status: 'error', message: e.message }));
};
module.exports = {
  login,
  loginAdmin,
  recoverPassword,
  changePassword,
  createPublication,
  uploadAgencyImages,
  getSoldPublications,
  registerAgency,
  registerUser,
  getImages,
  editPublication,
  checkFacebookLogin,
  loginOrRegisterFacebook,
  requestCredit,
  uploadSliders,
  getSliders,
  deleteSlider,
  getToken,
  // 123 seguro
  addUserAndCarData,
  get123Provinces,
  get123Localities,
  get123Token,
  get123Quotes,
  //---
  getProvinces,
  getTowns,
};
