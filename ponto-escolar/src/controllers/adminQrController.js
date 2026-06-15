const { NotFoundError } = require("../utils/errors");
const {
  createQrCode,
  deactivateQrCode,
  listQrCodes,
  validateQrCode,
} = require("../services/qrCodeService");
const { registerAuditLog } = require("../services/auditLogService");
const env = require("../config/env");

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() || req.ip || null
  );
}

function getConfiguredBaseUrl() {
  const rawBaseUrl = String(
    process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || ""
  ).trim();

  if (!rawBaseUrl) {
    return "";
  }

  try {
    const url = new URL(rawBaseUrl);
    if (env.IS_PRODUCTION && url.protocol !== "https:") {
      return "";
    }
    return url.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

function getBaseUrl(req) {
  const configuredBaseUrl = getConfiguredBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (env.IS_PRODUCTION) {
    return "";
  }

  const protocol = req.protocol || "http";
  const host = req.get("host");
  return host ? `${protocol}://${host}` : "";
}

async function generateQrShortcut(req, res, next) {
  try {
    const qrCode = await createQrCode({
      adminId: req.auth.id,
      unidadeCodigo: env.SCHOOL_UNIT_CODE,
      baseUrl: getBaseUrl(req),
    });

    await registerAuditLog({
      evento: "qr_code_gerado",
      adminId: req.auth.id,
      mensagem: "Administrador gerou QR Code como atalho para a tela de ponto",
      ipOrigem: getClientIp(req),
      metadados: {
        qr_code_id: qrCode.id,
        unidade_codigo: qrCode.unidade_codigo,
        expira_em: qrCode.expira_em,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        qrCode,
        qrLink: qrCode,
        // Alias legado: o QR atual e um link de acesso rapido, nao um token de autorizacao.
        qrToken: qrCode,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function listQrShortcuts(req, res, next) {
  try {
    const result = await listQrCodes({
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function deactivateQrShortcut(req, res, next) {
  try {
    const qrCodeId = Number(req.params.id);
    const deactivated = await deactivateQrCode(qrCodeId);

    if (!deactivated) {
      throw new NotFoundError("QR Code nao encontrado ou ja desativado");
    }

    await registerAuditLog({
      evento: "qr_code_desativado",
      adminId: req.auth.id,
      mensagem: "Administrador desativou atalho de QR Code de ponto",
      ipOrigem: getClientIp(req),
      metadados: { qr_code_id: qrCodeId },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: qrCodeId,
        ativo: false,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function validateQrShortcut(req, res, next) {
  try {
    const qrCodeValue = String(
      req.body.qrCode || req.body.qr_code || req.body.qrToken || ""
    ).trim();
    const validation = await validateQrCode(qrCodeValue, {
      unidadeCodigo: env.SCHOOL_UNIT_CODE,
    });

    if (!validation.valid) {
      await registerAuditLog({
        evento: "tentativa_link_ponto_invalido",
        nivel: "WARN",
        adminId: req.auth.id,
        mensagem: "Tentativa de conferir link de ponto invalido",
        ipOrigem: getClientIp(req),
        metadados: { status: validation.status },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        valido: validation.valid,
        status: validation.status,
        qrCode: validation.qrCode,
        qrLink: validation.qrCode,
        // Alias legado: mantido para clientes antigos que ainda leem qrToken.
        qrToken: validation.qrCode,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  generateQrShortcut,
  listQrShortcuts,
  deactivateQrShortcut,
  validateQrShortcut,
};
