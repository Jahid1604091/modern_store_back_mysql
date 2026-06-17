'use strict';

/**
 * Idempotent migration:
 *   1. Adds company_id to products / categories if the column is missing.
 *   2. Back-fills NULL company_id rows with the first company's id so existing
 *      data becomes visible after the SaaS migration.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addIfMissing = async (table, column, definition) => {
      const cols = await queryInterface.describeTable(table);
      if (!cols[column]) {
        await queryInterface.addColumn(table, column, definition);
        console.log(`[migration] added ${table}.${column}`);
      }
    };

    const colDef = { type: Sequelize.INTEGER, allowNull: true };

    await addIfMissing('products',   'company_id', colDef);
    await addIfMissing('categories', 'company_id', colDef);

    // Back-fill: assign orphaned rows to the first company that exists
    // QueryTypes.SELECT returns a plain array of rows (not [[rows], meta])
    const rows = await queryInterface.sequelize.query(
      'SELECT id FROM companies ORDER BY id ASC LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const firstCompany = rows[0];

    if (firstCompany) {
      const cid = firstCompany.id;
      await queryInterface.sequelize.query(
        `UPDATE products   SET company_id = ${cid} WHERE company_id IS NULL`
      );
      await queryInterface.sequelize.query(
        `UPDATE categories SET company_id = ${cid} WHERE company_id IS NULL`
      );
      console.log(`[migration] back-filled products + categories → company_id=${cid}`);
    } else {
      console.warn('[migration] no companies found — skipping back-fill');
    }
  },

  async down(queryInterface) {
    // intentionally a no-op: removing company_id would destroy tenant isolation
    console.log('[migration] down: no-op — company_id columns are load-bearing');
  },
};
