"use strict";

const { Router } = require("express");
const { createAuthPagesRouter } = require("./auth.routes");
const { createAdminPagesRouter } = require("./admin.routes");
const { createFuncionarioPagesRouter } = require("./funcionario.routes");
const { createLegacyPagesRouter } = require("./legacy.routes");

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function clearPunchAccess(req) {
  if (req.session) {
    delete req.session.punchAccess;
  }
}

function isStoredPunchAccessValid(punchAccess) {
  const expiresAt = punchAccess && punchAccess.expiresAt;
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

function sendInvalidAccess(res, noCacheHtmlHeaders) {
  res.set(noCacheHtmlHeaders);
  return res
    .status(403)
    .type("html")
    .send(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Acesso</title></head><body><h1>Acesso invalido ou expirado</h1><p>Solicite um novo acesso.</p></body></html>'
    );
}

function createPagesRouter({
  sendView,
  validateQrCode,
  schoolUnitCode,
  noCacheHtmlHeaders,
}) {
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

  router.get("/ponto/acessar", async (req, res, next) => {
    try {
      const qrCode = String(req.query.qr_code || "").trim();
      const effectiveUnitCode = schoolUnitCode;

      if (!qrCode) {
        if (isStoredPunchAccessValid(req.session?.punchAccess)) {
          sendView(res, "index.html");
          return;
        }

        clearPunchAccess(req);
        await saveSession(req);
        sendInvalidAccess(res, noCacheHtmlHeaders);
        return;
      }

      const validation = await validateQrCode(qrCode, {
        unidadeCodigo: effectiveUnitCode,
      });

      if (!validation.valid) {
        clearPunchAccess(req);
        await saveSession(req);
        sendInvalidAccess(res, noCacheHtmlHeaders);
        return;
      }

      if (req.session) {
        req.session.punchAccess = {
          qrCode,
          unidadeCodigo: effectiveUnitCode,
          tokenHint: validation.qrCode?.token_hint || qrCode.slice(0, 12),
          expiresAt:
            validation.qrCode?.expires_at_iso ||
            validation.qrCode?.expira_em ||
            null,
          validatedAt: new Date().toISOString(),
        };
        await saveSession(req);
      }

      res.redirect(303, "/ponto/acessar");
    } catch (error) {
      next(error);
    }
  });

  router.use(createLegacyPagesRouter());

  return router;
}

module.exports = { createPagesRouter };
