

module.exports = (sequelize, DataTypes) => {
  const PublicationDetail = sequelize.define('PublicationDetail', {
    Alimentacion: DataTypes.STRING,
    Motor: DataTypes.STRING,
    Puertas: DataTypes.INTEGER,
    Clasificacion: DataTypes.STRING,
    Cabina: DataTypes.STRING,
    Carga: DataTypes.STRING,
    PesoTotal: DataTypes.STRING,
    VelocidadMax: DataTypes.STRING,
    Potencia: DataTypes.STRING,
    Direccion: DataTypes.STRING,
    AireAcondicionado: DataTypes.BOOLEAN,
    Traccion: DataTypes.STRING,
    Importado: DataTypes.BOOLEAN,
    Caja: DataTypes.STRING,
    FrenosAbs: DataTypes.BOOLEAN,
    Airbag: DataTypes.BOOLEAN,
    Climatizador: DataTypes.BOOLEAN,
    FarosAntiniebla: DataTypes.BOOLEAN,
    TechoCorredizo: DataTypes.BOOLEAN,
    SensorEstacionamiento: DataTypes.BOOLEAN,
    AirbagLateral: DataTypes.BOOLEAN,
    AirbagCabezaConductor: DataTypes.BOOLEAN,
    AirbagCortina: DataTypes.BOOLEAN,
    AirbagRodilla: DataTypes.BOOLEAN,
    FijacionISOFIX: DataTypes.BOOLEAN,
    ControlDeTraccion: DataTypes.BOOLEAN,
    ControlDeEstabilidad: DataTypes.BOOLEAN,
    ControlDeDescenso: DataTypes.BOOLEAN,
    SistemaArranqueEnPendiente: DataTypes.BOOLEAN,
    ControlDinamicoConduccion: DataTypes.BOOLEAN,
    BloqueoDiferencial: DataTypes.BOOLEAN,
    RepartidorElectronicoDeFrenado: DataTypes.BOOLEAN,
    AsistenteDeFrenadoEmergencia: DataTypes.BOOLEAN,
    ReguladorParFrenado: DataTypes.BOOLEAN,
    Largo: DataTypes.FLOAT,
    Ancho: DataTypes.FLOAT,
    Alto: DataTypes.FLOAT,
    TapizadoCuero: DataTypes.BOOLEAN,
    AsientosElectronicos: DataTypes.BOOLEAN,
    ComputadoraABordo: DataTypes.BOOLEAN,
    FarosDeXenon: DataTypes.BOOLEAN,
    LLantasDeAleacion: DataTypes.BOOLEAN,
    TechoPanoramico: DataTypes.BOOLEAN,
    SensorDeLluvia: DataTypes.BOOLEAN,
    SensorCrepuscular: DataTypes.BOOLEAN,
    IndicadorPresionNeumaticos: DataTypes.BOOLEAN,
    VolanteConLevas: DataTypes.BOOLEAN,
    Bluetooth: DataTypes.BOOLEAN,
    AsientosTermicos: DataTypes.BOOLEAN,
    RunFlat: DataTypes.BOOLEAN,
  }, {
    timestamps: false,
  });
  return PublicationDetail;
};