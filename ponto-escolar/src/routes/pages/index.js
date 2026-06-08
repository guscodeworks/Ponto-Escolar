"use strict";

const { Router } = require("express");
const { createAuthPagesRouter } = require("./auth.routes");
const { createAdminPagesRouter } = require("./admin.routes");
const { createFuncionarioPagesRouter } = require("./funcionario.routes");
const { createLegacyPagesRouter } = require("./legacy.routes");

function createPagesRouter({ sendView }) {
  const router = Router();

  router.use(createAuthPagesRouter({ sendView }));
  router.use(createFuncionarioPagesRouter({ sendView }));
  router.use(createAdminPagesRouter({ sendView }));

  router.get("/ponto", (_req, res) => {
    res.redirect("/ponto/acessar");
  });

  router.get("/bater-ponto", (_req, res) => {
    res.redirect("/ponto/acessar");
  });

  router.get("/ponto/acessar", (_req, res) => {
    sendView(res, "index.html");
  });

  router.use(createLegacyPagesRouter());

  return router;
}

module.exports = { createPagesRouter };
