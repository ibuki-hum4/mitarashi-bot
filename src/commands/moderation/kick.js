import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { canModerate, getLogChannel, logAction } from '../../services/moderationService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('ユーザーをキックします')
    .addUserOption((option) =>
      option.setName('target').setDescription('キックするユーザー').setRequired(true)
    )
    .addStringOption((option) => option.setName('reason').setDescription('理由').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(client, interaction) {
    const targetMember = await interaction.guild.members.fetch(
      interaction.options.getUser('target', true)
    );
    const reason = interaction.options.getString('reason') || '理由は指定されていません';

    if (!canModerate(interaction.member, targetMember)) {
      await interaction.reply({ content: 'このユーザーをキックする権限がありません。', ephemeral: true });
      return;
    }

    await targetMember.kick(reason);

    const moderator = await getOrCreateUser(interaction.user);
    const targetUser = await getOrCreateUser(targetMember.user);

    await logAction({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: moderator.id,
      actionType: 'KICK',
      reason
    });

    const logChannel = await getLogChannel(interaction.guild);
    if (logChannel) {
      await logChannel.send({
        embeds: [
          {
            title: '👢 メンバーをキックしました',
            description: `ユーザー: ${targetMember.user.tag}\nモデレーター: ${interaction.user.tag}\n理由: ${reason}`,
            color: 0xffa500,
            timestamp: new Date().toISOString()
          }
        ]
      });
    }

    await interaction.reply({ content: `${targetMember.user.tag} をキックしました。`, ephemeral: true });
  }
};
