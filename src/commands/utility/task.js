import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import {
  assignGuildTask,
  completeGuildTask,
  createGuildTask,
  deleteGuildTask,
  listGuildTasks,
  reopenGuildTask,
  updateTaskStatus
} from '../../services/taskService.js';

function parseDueDate(input) {
  if (!input) return null;
  const parsed = dayjs(input);
  if (!parsed.isValid()) return null;
  return parsed.toDate();
}

function formatTask(task) {
  const statusEmoji = task.status === 'done' ? '✅' : '🟡';
  const assignee = task.assignee?.username ?? task.assignee?.discordId ?? '未割当';
  const due = task.dueDate ? dayjs(task.dueDate).format('YYYY/MM/DD HH:mm') : '期限なし';
  return `${statusEmoji} #${task.id} ${task.description}\n担当: ${assignee} / 期限: ${due}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('タスク管理を行います')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('タスクを作成します')
        .addStringOption((option) =>
          option.setName('description').setDescription('タスク内容').setRequired(true)
        )
        .addUserOption((option) =>
          option.setName('assignee').setDescription('担当者').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('due').setDescription('期限 (例: 2025-10-01 21:00)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('assign')
        .setDescription('タスクを担当者に割り当てます')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('タスクID').setRequired(true)
        )
        .addUserOption((option) =>
          option.setName('assignee').setDescription('担当者').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('complete')
        .setDescription('タスクを完了にします')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('タスクID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reopen')
        .setDescription('完了したタスクを再開します')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('タスクID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('タスクのステータスを更新します')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('タスクID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('新しいステータス (open / in_progress / done)')
            .setRequired(true)
            .setChoices(
              { name: 'Open', value: 'open' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Done', value: 'done' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('タスク一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('絞り込みステータス')
            .setChoices(
              { name: 'Open', value: 'open' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Done', value: 'done' }
            )
        )
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数 (最大50)').setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('タスクを削除します')
        .addIntegerOption((option) =>
          option.setName('task_id').setDescription('タスクID').setRequired(true)
        )
    ),
  async execute(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const description = interaction.options.getString('description', true);
      const assigneeUser = interaction.options.getUser('assignee');
      const dueInput = interaction.options.getString('due');
      const dueDate = parseDueDate(dueInput);

      if (dueInput && !dueDate) {
        await interaction.reply({ content: '期限の形式が正しくありません。', ephemeral: true });
        return;
      }

      const task = await createGuildTask(interaction, {
        description,
        dueDate,
        assigneeUser
      });

      await interaction.reply({ content: `📝 タスク #${task.id} を作成しました。`, ephemeral: true });
      return;
    }

    if (subcommand === 'assign') {
      const taskId = interaction.options.getInteger('task_id', true);
      const assigneeUser = interaction.options.getUser('assignee', true);
      const result = await assignGuildTask(interaction, taskId, assigneeUser);
      if (result.count === 0) {
        await interaction.reply({ content: '指定したタスクが見つかりません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `👤 タスク #${taskId} の担当者を更新しました。`, ephemeral: true });
      return;
    }

    if (subcommand === 'complete') {
      const taskId = interaction.options.getInteger('task_id', true);
      const result = await completeGuildTask(interaction.guildId, taskId);
      if (result.count === 0) {
        await interaction.reply({ content: '指定したタスクが見つかりません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `✅ タスク #${taskId} を完了にしました。`, ephemeral: true });
      return;
    }

    if (subcommand === 'reopen') {
      const taskId = interaction.options.getInteger('task_id', true);
      const result = await reopenGuildTask(interaction.guildId, taskId);
      if (result.count === 0) {
        await interaction.reply({ content: '指定したタスクが見つかりません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `🔄 タスク #${taskId} を再開しました。`, ephemeral: true });
      return;
    }

    if (subcommand === 'status') {
      const taskId = interaction.options.getInteger('task_id', true);
      const status = interaction.options.getString('status', true);
      const result = await updateTaskStatus(interaction.guildId, taskId, status);
      if (result.count === 0) {
        await interaction.reply({ content: '指定したタスクが見つかりません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `📝 タスク #${taskId} のステータスを ${status} に更新しました。`, ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const status = interaction.options.getString('status');
      const limit = interaction.options.getInteger('limit') ?? 25;
      const tasks = await listGuildTasks(interaction.guildId, status, limit);

      await interaction.editReply({
        embeds: [
          {
            title: '📋 タスク一覧',
            description: tasks.length ? tasks.map(formatTask).join('\n\n') : 'タスクは登録されていません。',
            color: 0x9b59b6,
            timestamp: new Date().toISOString()
          }
        ]
      });
      return;
    }

    if (subcommand === 'delete') {
      const taskId = interaction.options.getInteger('task_id', true);
      const result = await deleteGuildTask(interaction.guildId, taskId);
      if (result.count === 0) {
        await interaction.reply({ content: '指定したタスクが見つかりません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `🗑️ タスク #${taskId} を削除しました。`, ephemeral: true });
    }
  }
};
