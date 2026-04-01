const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Admin: réparation de schéma user_tasks
router.post('/admin/tasks/fix-schema', authenticateToken, async (req, res) => {
  try {
    try { await db.query(`ALTER TABLE IF EXISTS user_tasks ADD COLUMN IF NOT EXISTS timestamp_started TIMESTAMP`); } catch (_) {}
    try { await db.query(`ALTER TABLE IF EXISTS user_tasks ADD COLUMN IF NOT EXISTS timestamp_approved TIMESTAMP`); } catch (_) {}
    try { await db.query(`ALTER TABLE IF EXISTS user_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`); } catch (_) {}
    try { await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tasks_unique ON user_tasks (user_id, task_id)`); } catch (_) {}
    res.json({ repaired: true });
  } catch (e) {
    console.error('Fix schema error:', e);
    res.status(500).json({ error: 'Erreur réparation schéma' });
  }
});

// Public: lister les tasks actives
router.get('/tasks', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title, description, type, link_url, reward_points, reward_airdrop_bonus_percent
       FROM tasks
       WHERE ${db.isSQLite ? 'active = 1' : 'active = TRUE'}
       ORDER BY created_at DESC`
    );
    res.json({ tasks: result.rows });
  } catch (e) {
    console.error('Public tasks error:', e);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Utilisateur: déclarer une task (validation immédiate + crédit points)
router.post('/user/tasks/approve', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.body || {};
    if (!taskId) return res.status(400).json({ error: 'taskId requis' });

    const t = await db.query(
      `SELECT id, reward_points, reward_airdrop_bonus_percent 
       FROM tasks WHERE id = $1 AND ${db.isSQLite ? 'active = 1' : 'active = TRUE'}`,
      [parseInt(taskId)]
    );
    if (t.rows.length === 0) return res.status(404).json({ error: 'Task introuvable' });
    const rewardPoints = parseInt(t.rows[0].reward_points || 0);

    const existing = await db.query(
      `SELECT id, status FROM user_tasks WHERE user_id = $1 AND task_id = $2 ORDER BY id DESC LIMIT 1`,
      [userId, parseInt(taskId)]
    );
    if (existing.rows.length > 0) {
      const ut = existing.rows[0];
      if (ut.status !== 'approved') {
        await db.query('UPDATE user_tasks SET status = $1, timestamp_approved = NOW() WHERE id = $2', ['approved', ut.id]);
        if (rewardPoints > 0) {
          await db.query(
            `INSERT INTO rewards_ledger (user_id, amount, reason, details) VALUES ($1, $2, $3, $4)`,
            [userId, rewardPoints, 'task', JSON.stringify({ task_id: parseInt(taskId) })]
          );
        }
      }
      return res.json({ success: true, status: 'approved', userTaskId: ut.id });
    }

    // Insert + approve
    const ins = await db.query(
      `INSERT INTO user_tasks (user_id, task_id, status)
       VALUES ($1, $2, 'approved')
       RETURNING id`,
      [userId, parseInt(taskId)]
    );
    const userTaskId = ins.rows[0].id;
    if (rewardPoints > 0) {
      await db.query(
        `INSERT INTO rewards_ledger (user_id, amount, reason, details) VALUES ($1, $2, $3, $4)`,
        [userId, rewardPoints, 'task', JSON.stringify({ task_id: parseInt(taskId) })]
      );
    }
    res.json({ success: true, status: 'approved', userTaskId });
  } catch (e) {
    console.error('User task approve error:', e);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Utilisateur: statut des tasks
router.get('/user/tasks/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const r = await db.query(
      `SELECT task_id, status FROM user_tasks WHERE user_id = $1 ORDER BY id DESC`,
      [userId]
    );
    const map = {};
    for (const row of r.rows) {
      if (!map[row.task_id]) map[row.task_id] = row.status;
    }
    const statuses = Object.entries(map).map(([taskId, status]) => ({ taskId: parseInt(taskId), status }));
    res.json({ statuses });
  } catch (e) {
    console.error('User tasks status error:', e);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Bonus minage cumulé
router.get('/user/tasks/bonus', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const r = await db.query(
      `SELECT COALESCE(SUM(t.reward_airdrop_bonus_percent), 0) AS bonus
       FROM user_tasks ut
       JOIN tasks t ON ut.task_id = t.id
       WHERE ut.user_id = $1 AND ut.status = 'approved'`,
      [userId]
    );
    res.json({ bonusPercent: Number(r.rows[0]?.bonus) || 0 });
  } catch (e) {
    console.error('User tasks bonus error:', e);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
