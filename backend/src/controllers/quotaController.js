import { User, QuotaRequest } from "../models/index.js";

// Constants
const MIN_QUOTA_VALUE = 1;
const VALID_STATUSES = ["approved", "rejected"];

// Helper functions
const getTodayDate = () => new Date().toISOString().slice(0, 10);

const resetQuotaIfNeeded = async (user) => {
  const today = getTodayDate();

  if (user.last_reset_date !== today) {
    user.used_today = 0;
    user.last_reset_date = today;
    await user.save();
  }
};

const calculateResponseMinutes = (createdAt, respondedAt) => {
  if (!createdAt) return 0;
  const diffMs = new Date(respondedAt) - new Date(createdAt);
  return Math.max(0, Math.round(diffMs / 60000));
};

const getMeQuota = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await resetQuotaIfNeeded(user);

    return res.json({
      daily_quota: user.daily_quota,
      used_today: user.used_today,
      remaining: Math.max(user.daily_quota - user.used_today, 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil kuota" });
  }
};

// Admin set quota
const setUserQuota = async (req, res) => {
  try {
    const { userId } = req.params;
    const { daily_quota } = req.body;

    if (!daily_quota || daily_quota < MIN_QUOTA_VALUE) {
      return res.status(400).json({ message: "daily_quota harus > 0" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    user.daily_quota = daily_quota;
    await user.save();

    return res.json({ message: "Kuota diperbarui", daily_quota });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengubah kuota" });
  }
};

// User create request
const createQuotaRequest = async (req, res) => {
  try {
    const { requested_quota, reason } = req.body;

    if (!requested_quota || requested_quota < MIN_QUOTA_VALUE) {
      return res.status(400).json({ message: "requested_quota harus > 0" });
    }

    const existing = await QuotaRequest.findOne({
      where: {
        user_id: req.user.id,
        status: "pending",
      },
    });

    if (existing) {
      return res.status(400).json({
        message:
          "Masih ada permintaan kuota yang pending. Tunggu keputusan admin.",
      });
    }

    const quotaRequest = await QuotaRequest.create({
      user_id: req.user.id,
      requested_quota,
      reason,
      status: "pending",
    });

    return res.status(201).json({
      message: "Permintaan kuota dikirim",
      request: quotaRequest,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal membuat permintaan kuota" });
  }
};

// Admin list all requests
const listQuotaRequests = async (req, res) => {
  try {
    const requests = await QuotaRequest.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["username", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal mengambil permintaan kuota" });
  }
};

// User list own requests
const listMyQuotaRequests = async (req, res) => {
  try {
    const requests = await QuotaRequest.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal mengambil permintaan kuota" });
  }
};

// Admin approve/reject
const updateQuotaRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ message: "Status harus approved/rejected" });
    }

    const quotaRequest = await QuotaRequest.findByPk(id);
    if (!quotaRequest) {
      return res.status(404).json({ message: "Request tidak ditemukan" });
    }

    const respondedAt = new Date();

    quotaRequest.status = status;
    quotaRequest.admin_note = admin_note;
    quotaRequest.responded_at = respondedAt;
    quotaRequest.response_minutes = calculateResponseMinutes(
      quotaRequest.createdAt,
      respondedAt
    );

    await quotaRequest.save();

    // Apply approved quota
    if (status === "approved") {
      const user = await User.findByPk(quotaRequest.user_id);

      if (user) {
        await resetQuotaIfNeeded(user);
        user.daily_quota += quotaRequest.requested_quota;
        user.used_today = Math.max(
          0,
          user.used_today - quotaRequest.requested_quota
        );
        await user.save();
      }
    }

    return res.json({
      message: "Permintaan diperbarui",
      request: quotaRequest,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memperbarui permintaan" });
  }
};

export {
  getMeQuota,
  setUserQuota,
  createQuotaRequest,
  listQuotaRequests,
  updateQuotaRequest,
  listMyQuotaRequests,
};
