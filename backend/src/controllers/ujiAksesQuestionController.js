import { db, UjiAksesQuestion, UjiAksesOption } from "../models/index.js";
import { seedUjiAksesQuestions } from "../utils/seedUjiAksesQuestions.js";

// Constants
const KEY_PREFIX = {
  QUESTION: "q",
  OPTION: "opt",
};

// Helper functions
const extractNumber = (key, prefix) => {
  const match = String(key).match(new RegExp(`^${prefix}(\\d+)$`, "i"));
  return match ? Number(match[1]) : null;
};

const generateNextKey = (existingKeys, prefix) => {
  const numbers = existingKeys
    .map((key) => extractNumber(key, prefix))
    .filter((n) => Number.isFinite(n));

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${next}`;
};

const getNextQuestionKey = async () => {
  const questions = await UjiAksesQuestion.findAll({ attributes: ["key"] });
  const keys = questions.map((q) => q.key);
  return generateNextKey(keys, KEY_PREFIX.QUESTION);
};

const getNextOptionKey = (existingKeys = []) => {
  return generateNextKey(existingKeys, KEY_PREFIX.OPTION);
};

const mapQuestion = (question) => ({
  id: question.id,
  key: question.key,
  section: question.section,
  text: question.text,
  order: question.order,
  options: (question.options || []).map((option) => ({
    id: option.id,
    key: option.key,
    label: option.label,
    score: option.score,
    order: option.order,
  })),
});

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) return [];

  return options
    .map((opt, idx) => ({
      id: opt.id,
      key: opt.key,
      label: String(opt.label || "").trim(),
      score: Number(opt.score) || 0,
      order: Number(opt.order) || idx + 1,
    }))
    .filter((opt) => opt.label);
};

const listQuestions = async (req, res) => {
  try {
    const questions = await UjiAksesQuestion.findAll({
      include: [{ model: UjiAksesOption, as: "options" }],
      order: [
        ["order", "ASC"],
        [{ model: UjiAksesOption, as: "options" }, "order", "ASC"],
      ],
    });

    return res.json(questions.map(mapQuestion));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mengambil pertanyaan" });
  }
};

const createQuestion = async (req, res) => {
  try {
    const { text, section, order, options } = req.body;
    const trimmedText = String(text || "").trim();

    if (!trimmedText) {
      return res.status(400).json({ message: "Pertanyaan wajib diisi" });
    }

    const cleanedOptions = normalizeOptions(options);
    if (!cleanedOptions.length) {
      return res.status(400).json({ message: "Opsi jawaban wajib diisi" });
    }

    const key = await getNextQuestionKey();
    const questionOrder = Number(order) || (await UjiAksesQuestion.count()) + 1;

    const question = await UjiAksesQuestion.create({
      key,
      section: section || null,
      text: trimmedText,
      order: questionOrder,
    });

    const usedKeys = [];
    const optionsPayload = cleanedOptions.map((opt, idx) => {
      const optKey = opt.key || getNextOptionKey(usedKeys);
      usedKeys.push(optKey);

      return {
        question_id: question.id,
        key: optKey,
        label: opt.label,
        score: opt.score,
        order: opt.order || idx + 1,
      };
    });

    await UjiAksesOption.bulkCreate(optionsPayload);

    const savedQuestion = await UjiAksesQuestion.findByPk(question.id, {
      include: [{ model: UjiAksesOption, as: "options" }],
      order: [[{ model: UjiAksesOption, as: "options" }, "order", "ASC"]],
    });

    return res.status(201).json(mapQuestion(savedQuestion));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal membuat pertanyaan" });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const question = await UjiAksesQuestion.findByPk(req.params.id, {
      include: [{ model: UjiAksesOption, as: "options" }],
    });

    if (!question) {
      return res.status(404).json({ message: "Pertanyaan tidak ditemukan" });
    }

    const { text, section, order, options } = req.body;
    const trimmedText = String(text || "").trim();

    if (!trimmedText) {
      return res.status(400).json({ message: "Pertanyaan wajib diisi" });
    }

    await question.update({
      section: section ?? question.section,
      text: trimmedText,
      order: Number(order) || question.order,
    });

    const cleanedOptions = normalizeOptions(options);
    if (!cleanedOptions.length) {
      return res.status(400).json({ message: "Opsi jawaban wajib diisi" });
    }

    const existingById = new Map(question.options.map((o) => [o.id, o]));
    const keepIds = new Set();
    const usedKeys = new Set(question.options.map((o) => o.key));

    for (const [idx, opt] of cleanedOptions.entries()) {
      if (opt.id && existingById.has(opt.id)) {
        // Update existing option
        const target = existingById.get(opt.id);
        keepIds.add(target.id);

        await target.update({
          label: opt.label,
          score: opt.score,
          order: opt.order || idx + 1,
        });
      } else {
        // Create new option
        const optKey =
          opt.key && !usedKeys.has(opt.key)
            ? opt.key
            : getNextOptionKey(Array.from(usedKeys));

        usedKeys.add(optKey);

        const created = await UjiAksesOption.create({
          question_id: question.id,
          key: optKey,
          label: opt.label,
          score: opt.score,
          order: opt.order || idx + 1,
        });

        keepIds.add(created.id);
      }
    }

    // Delete removed options
    const deleteIds = question.options
      .filter((o) => !keepIds.has(o.id))
      .map((o) => o.id);

    if (deleteIds.length) {
      await UjiAksesOption.destroy({ where: { id: deleteIds } });
    }

    const savedQuestion = await UjiAksesQuestion.findByPk(question.id, {
      include: [{ model: UjiAksesOption, as: "options" }],
      order: [[{ model: UjiAksesOption, as: "options" }, "order", "ASC"]],
    });

    return res.json(mapQuestion(savedQuestion));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal memperbarui pertanyaan" });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const question = await UjiAksesQuestion.findByPk(req.params.id);

    if (!question) {
      return res.status(404).json({ message: "Pertanyaan tidak ditemukan" });
    }

    await UjiAksesOption.destroy({ where: { question_id: question.id } });
    await question.destroy();

    return res.json({ message: "Pertanyaan dihapus" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal menghapus pertanyaan" });
  }
};

const deleteAllQuestions = async (req, res) => {
  try {
    await db.transaction(async (transaction) => {
      await UjiAksesOption.destroy({ where: {}, transaction });
      await UjiAksesQuestion.destroy({ where: {}, transaction });
    });

    return res.json({ message: "Semua pertanyaan dihapus" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Gagal menghapus semua pertanyaan" });
  }
};

const resetQuestions = async (req, res) => {
  try {
    const result = await seedUjiAksesQuestions({ force: true });

    return res.json({
      message: "Pertanyaan dipulihkan ke template",
      count: result?.count || 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Gagal mereset pertanyaan" });
  }
};

export {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deleteAllQuestions,
  resetQuestions,
};
