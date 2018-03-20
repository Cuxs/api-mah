const jsonwt = require('jsonwebtoken');
const { split } = require('split-object');
const decode = require('jwt-decode');
const moment = require('moment');
const sharp = require('sharp');
const {
  User,
  Publication,
  ImageGroup,
  PublicationState,
  PublicationDetail,
  sequelize,
} = require('../models').mah;
const _ = require('lodash');
const fs = require('fs');

const { generateMailAgenciaoParticular, generateSinRegistro } = require('../mails');
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
const removeOldFile = (file) => {
  fs.unlinkSync(`./images/${file.filename}`);
};
const optimizeImage = file => sharp(`./images/${file.filename}`)
  .resize(752, 500)
  .toFile(`./images/opt-${file.filename}`)
  .then(() => removeOldFile(file));

const prepareArrayToSharp = (imageGroup) => {
  const promiseArray = imageGroup.map(file => optimizeImage(file));
  return promiseArray;
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
    kms,
    price,
    year,
    Combustible,
    observation,
    carState,
    codia,
    name,
    email,
    phone,
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
  if (imageGroup.length === 0) {
    res.status(400).send('Por favor elija aunque sea una imágen');
    return false;
  }
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
          .then(() => ImageGroup.create(imageData)
            .then((resp) => {
              Publication.create(
                {
                  brand,
                  group,
                  modelName,
                  kms,
                  price,
                  year,
                  fuel,
                  observation,
                  carState,
                  codia,
                  imageGroup_id: resp.id,
                  name,
                  email,
                  phone,
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
              ).then((publication) => {
                PublicationState.findOne({
                  where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
                }).then((ps) => {
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
                });
              });
            })
            .catch((e) => {
              res.status(400).send(e.message);
              console.log(e);
            })
            .catch(() => {
              res.status(400).send('No existe un usuario con ese id');
            }))
          .catch((e) => {
            res.status(400).send(e.message);
          });
      } else {
        return ImageGroup.create(imageData)
          .then((resp) => {
            Publication.create(
              {
                brand,
                group,
                modelName,
                kms,
                price,
                year,
                fuel,
                observation,
                carState,
                codia,
                imageGroup_id: resp.id,
                name,
                email,
                phone,
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
            ).then((publication) => {
              PublicationState.findOne({
                where: { stateName: isAdmin ? 'Publicada' : 'Pendiente' },
              }).then((ps) => {
                publication.setPublicationStates(ps, { through: { active: true } });
                res
                  .status(200)
                  .send('Felicitaciones, tu publicación fue creada exitosamente, permanecerá en estado pendiente hasta que sea aprobada por Mi Auto Hoy');
                const msg = {
                  to: userMail,
                  from: miautoEmail,
                  subject: 'Publicación creada!',
                  html: generateMailAgenciaoParticular(publication, 'newPublication'),
                };
                sgMail.send(msg);
              });
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
  const {
    publication_id,
    brand,
    group,
    modelName,
    kms,
    price,
    year,
    Combustible,
    observation,
    carState,
    codia,
    name,
    email,
    phone,
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
            kms,
            price,
            year,
            fuel,
            observation,
            carState,
            codia,
            name,
            email,
            phone,
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
                      kms,
                      price,
                      year,
                      fuel,
                      observation,
                      carState,
                      codia,
                      imageGroup_id: resp.id,
                      name,
                      email,
                      phone,
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
const getFiltersAndTotalResult = (req, res) => {
  req.body = req.body.search;
  let { text } = req.body;
  const {
    carState, fuel, year, state, userType,
  } = req.body;
  const { Op } = sequelize;
  text = _.upperFirst(_.lowerCase(text));
  text += '%';
  const LIMIT = 9;
  let hasNextPage = true;
  const options = {};
  options.where = {
    [Op.or]: [
      { brand: { [Op.like]: text } },
      { group: { [Op.like]: text } },
      { modelName: { [Op.like]: text } },
      { kms: { [Op.like]: text } },
      { fuel: { [Op.like]: text } },
      { name: { [Op.like]: text } },
    ],
    [Op.and]: { carState },
  };
  options.include = [User, PublicationState];
  if (fuel) {
    options.where[Op.and] = Object.assign(options.where[Op.and], { fuel });
  }
  if (year) {
    options.where[Op.and] = Object.assign(options.where[Op.and], { year });
  }
  if (state) {
    options.include = [
      {
        model: PublicationState,
        where: {
          stateName: state,
        },
        through: { where: { active: true } },
      },
      { model: User },
    ];
  }
  if (userType) {
    if (userType === 'Agencia') {
      options.include = [
        {
          model: User,
          where: { isAgency: true, isAdmin: false },
        },
      ];
    } else {
      options.include = [
        {
          model: User,
          where: { isAgency: false, isAdmin: false },
        },
      ];
    }
  }

  Publication.findAll(options).then((results) => {
    if (results === null) {
      results = {};
    }
    const newObj = {};
    newObj.fuel = {};
    newObj.year = {};
    newObj.state = {};
    newObj.userType = {};
    results.map(({ dataValues }) => {
      split(dataValues).map((row) => {
        if (row.key === 'fuel' || row.key === 'year' || row.key === 'state') {
          newObj[row.key][row.value] = 0;
        }
        if (row.key === 'PublicationStates') {
          row.key = 'state';
          row.value = _.last(row.value).dataValues.stateName;
          newObj[row.key][row.value] = 0;
        }
        if (row.key === 'User' && row.value === null) {
          row.key = 'userType';
          row.value = 'Particular';
          newObj[row.key][row.value] = 0;
        } else if (row.key === 'User' && row.value !== null) {
          row.key = 'userType';
          row.value = row.value.dataValues.isAgency ? 'Agencia' : 'Particular';
          newObj[row.key][row.value] = 0;
        }
        return newObj;
      });
    });
    if (results.length < LIMIT) {
      hasNextPage = false;
    } else {
      hasNextPage = true;
    }
    results.map(({ dataValues }) => {
      split(dataValues).map((row) => {
        if (row.key === 'PublicationStates') {
          row.key = 'state';
          row.value = _.last(row.value).dataValues.stateName;
          newObj[row.key][row.value] += 1;
        }
        if (row.key === 'User' && row.value === null) {
          row.key = 'userType';
          row.value = 'Particular';
          newObj[row.key][row.value] += 1;
        } else if (row.key === 'User' && row.value !== null) {
          row.key = 'userType';
          row.value = row.value.dataValues.isAgency ? 'Agencia' : 'Particular';
          newObj[row.key][row.value] += 1;
        }
        switch (row.key) {
          case 'fuel':
            newObj[row.key][row.value] += 1;
            break;
          case 'year':
            newObj[row.key][row.value] += 1;
            break;
          default:
            return '';
        }
      });
    });
    res
      .status(200)
      .send(ResponseObj('ok', null, {
        filters: newObj,
        totalResults: results.length,
        hasNextPage,
      }));
  });
};
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
          res.send(ResponseObj('ok', 'Se envió un link a tu correo para recuperar la contraseña'));
          sgMail.send(msg)
            .catch((err) => {
              console.log(err);
            });
        });
    });
};
module.exports = {
  login,
  loginAdmin,
  recoverPassword,
  createPublication,
  uploadAgencyImages,
  getFiltersAndTotalResult,
  getSoldPublications,
  registerAgency,
  registerUser,
  getImages,
  editPublication,
};
