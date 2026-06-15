"use strict";

const punchService = require("../services/punchService");
const { validateQrCode } = require("../services/qrCodeService");
const env = require("../config/env");
const { buildClearAdminAuthCookie } = require("../utils/authCookie");
const { ForbiddenError } = require("../utils/errors");

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() || req.ip || null;
}

function getGovbrFakeHomeUrl() {
  return String(process.env.GOVBR_FAKE_BASE_URL || "http://localhost:4000").trim();
}

function getQrCode(req) {
  return String(
    req.body?.qrCode ||
      req.body?.qr_code ||
      req.body?.qrToken ||
      req.session?.punchAccess?.qrCode ||
      ""
  ).trim();
}

async function requireValidQrCode(req) {
  const validation = await validateQrCode(getQrCode(req), {
    unidadeCodigo: env.SCHOOL_UNIT_CODE,
  });

  if (!validation.valid) {
    throw new ForbiddenError("QR Code invalido ou expirado. Solicite um novo acesso.");
  }
}

function loginAdmin(_req, res) {
  return res.status(410).json({
    success: false,
    error: {
      code: "ADMIN_GOVBR_REQUIRED",
      message: "Login administrativo local desativado. Use Gov.br.",
    },
  });
}

async function loginFuncionario(req, res, next) {
  try {
    await requireValidQrCode(req);
    const result = await punchService.loginFuncionario(req.body, {
      ipOrigem: getClientIp(req),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

function logoutAdmin(req, res) {
  res.setHeader("Set-Cookie", buildClearAdminAuthCookie());
  res.clearCookie("ponto_escolar_sid", { path: "/" });
  res.clearCookie("connect.sid", { path: "/" });

  if (req.session && typeof req.session.destroy === "function") {
    req.session.destroy(() => {});
  }

  const redirectTo = getGovbrFakeHomeUrl();

  if (req.method === "GET") {
    return res.redirect(redirectTo);
  }

  return res.status(200).json({
    success: true,
    message: "Logout realizado com sucesso",
    redirectTo,
  });
}

module.exports = {
  loginAdmin,
  loginFuncionario,
  logoutAdmin,
};
