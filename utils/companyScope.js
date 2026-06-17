/**
 * Builds a Sequelize `where` clause scoped to the caller's company.
 * Platform admin (company_id === null) is not bound to a single company —
 * they may target one via ?company_id= / body.company_id, or omit it to
 * operate unscoped (e.g. listing across all companies).
 */
function companyScopeWhere(req, extra = {}) {
  if (req.user && req.user.company_id == null) {
    const cid = req.query.company_id || req.body.company_id;
    return cid ? { ...extra, company_id: cid } : { ...extra };
  }
  return { ...extra, company_id: req.user.company_id };
}

/**
 * Resolves the company_id to write onto a newly created row.
 * Platform admin must supply company_id explicitly (query or body).
 */
function resolveCompanyId(req) {
  if (req.user && req.user.company_id == null) {
    return req.query.company_id || req.body.company_id || null;
  }
  return req.user.company_id;
}

module.exports = { companyScopeWhere, resolveCompanyId };
