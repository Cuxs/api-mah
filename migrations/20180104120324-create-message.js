

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('Messages', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    from_id: {
      type: Sequelize.INTEGER,
    },
    content: {
      type: Sequelize.TEXT,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    commentThread_id: {
      type: Sequelize.INTEGER,
      references: {
        model: 'CommentThreads',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  }),
  down: (queryInterface, Sequelize) => queryInterface.dropTable('Messages'),
};
